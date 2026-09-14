import { AppError } from "./errors";
import type {
  ChangedField,
  CompareResult,
  DiffRecord,
  ParsedRow,
  ParsedSheet,
  RowValues,
} from "./types";

export interface CompareOptions {
  idColumn: string;
  ignoredColumns?: string[];
}

/**
 * Memastikan kedua file punya nama kolom yang sama. Urutan kolom boleh
 * berbeda. Kalau strukturnya beda, kolom bermasalah disebutkan satu per satu
 * dan proses berhenti — pemetaan kolom tidak pernah ditebak.
 */
export function assertSameStructure(oldSheet: ParsedSheet, newSheet: ParsedSheet): void {
  const oldColumns = new Set(oldSheet.columns);
  const newColumns = new Set(newSheet.columns);

  const missingInNew = oldSheet.columns.filter((column) => !newColumns.has(column));
  const missingInOld = newSheet.columns.filter((column) => !oldColumns.has(column));

  if (missingInNew.length === 0 && missingInOld.length === 0) return;

  const details: string[] = [];
  if (missingInNew.length > 0) {
    details.push(`Ada di file lama tapi hilang di file baru: ${missingInNew.join(", ")}.`);
  }
  if (missingInOld.length > 0) {
    details.push(`Ada di file baru tapi tidak ada di file lama: ${missingInOld.join(", ")}.`);
  }
  details.push("Samakan dulu nama kolom kedua file, lalu bandingkan lagi. Urutan kolom boleh berbeda.");

  throw new AppError("Struktur kolom kedua file berbeda.", details);
}

/**
 * Membangun indeks ID → baris. ID kosong atau ganda menghentikan
 * perbandingan, disertai nomor baris yang perlu diperbaiki.
 */
function indexById(sheet: ParsedSheet, idColumn: string, label: string): Map<string, ParsedRow> {
  const byId = new Map<string, ParsedRow>();
  const emptyRows: number[] = [];
  const duplicates = new Map<string, number[]>();

  for (const row of sheet.rows) {
    const id = (row.values[idColumn] ?? "").trim();

    if (id === "") {
      emptyRows.push(row.rowNumber);
      continue;
    }

    const existing = byId.get(id);
    if (existing) {
      const rows = duplicates.get(id) ?? [existing.rowNumber];
      rows.push(row.rowNumber);
      duplicates.set(id, rows);
      continue;
    }

    byId.set(id, row);
  }

  if (emptyRows.length > 0) {
    throw new AppError(
      `Kolom "${idColumn}" kosong pada ${emptyRows.length} baris di ${label} ("${sheet.fileName}").`,
      [
        `Baris yang perlu diperbaiki: ${formatList(emptyRows.map(String))}.`,
        "Setiap record harus punya ID agar bisa dicocokkan antar file.",
      ],
    );
  }

  if (duplicates.size > 0) {
    const details = Array.from(duplicates.entries())
      .slice(0, 10)
      .map(([id, rows]) => `"${id}" muncul di baris ${rows.join(", ")}.`);

    if (duplicates.size > 10) {
      details.push(`…dan ${duplicates.size - 10} ID ganda lainnya.`);
    }
    details.push(`Pastikan setiap nilai "${idColumn}" hanya muncul sekali, lalu bandingkan lagi.`);

    throw new AppError(
      `Ditemukan ${duplicates.size} ID ganda di ${label} ("${sheet.fileName}").`,
      details,
    );
  }

  return byId;
}

function formatList(items: string[], max = 20): string {
  if (items.length <= max) return items.join(", ");
  return `${items.slice(0, max).join(", ")}, …dan ${items.length - max} lainnya`;
}

/**
 * Membandingkan dua sheet berdasarkan kolom ID, bukan posisi baris.
 *
 * - Hanya di file baru  → Ditambahkan
 * - Hanya di file lama  → Dihapus
 * - Ada di keduanya, ada nilai berbeda → Berubah (satu record tetap satu record,
 *   berapa pun jumlah kolom yang berubah)
 * - Ada di keduanya, semua nilai sama → Tetap
 */
export function compareSheets(
  oldSheet: ParsedSheet,
  newSheet: ParsedSheet,
  options: CompareOptions,
): CompareResult {
  const { idColumn } = options;
  const ignoredColumns = options.ignoredColumns ?? [];

  assertSameStructure(oldSheet, newSheet);

  if (!newSheet.columns.includes(idColumn)) {
    throw new AppError(`Kolom ID "${idColumn}" tidak ada di file yang dibandingkan.`, [
      `Kolom yang tersedia: ${newSheet.columns.join(", ")}.`,
    ]);
  }

  const ignoredSet = new Set(ignoredColumns);
  const comparedColumns = newSheet.columns.filter(
    (column) => column !== idColumn && !ignoredSet.has(column),
  );

  if (comparedColumns.length === 0) {
    throw new AppError("Tidak ada kolom yang tersisa untuk dibandingkan.", [
      "Kurangi kolom yang diabaikan, atau pilih kolom ID yang lain.",
    ]);
  }

  const oldById = indexById(oldSheet, idColumn, "file lama");
  const newById = indexById(newSheet, idColumn, "file baru");

  const records: DiffRecord[] = [];
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0 };

  // Urut mengikuti file baru supaya hasil stabil dan mudah ditelusuri.
  for (const row of newSheet.rows) {
    const id = row.values[idColumn].trim();
    const oldRow = oldById.get(id);

    if (!oldRow) {
      records.push({ id, status: "added", newValues: row.values, changes: [] });
      summary.added += 1;
      continue;
    }

    const changes = diffRow(oldRow.values, row.values, comparedColumns);

    if (changes.length > 0) {
      records.push({
        id,
        status: "changed",
        oldValues: oldRow.values,
        newValues: row.values,
        changes,
      });
      summary.changed += 1;
    } else {
      records.push({
        id,
        status: "unchanged",
        oldValues: oldRow.values,
        newValues: row.values,
        changes: [],
      });
      summary.unchanged += 1;
    }
  }

  for (const row of oldSheet.rows) {
    const id = row.values[idColumn].trim();
    if (newById.has(id)) continue;
    records.push({ id, status: "removed", oldValues: row.values, changes: [] });
    summary.removed += 1;
  }

  return {
    idColumn,
    ignoredColumns: [...ignoredColumns],
    comparedColumns,
    columns: newSheet.columns,
    oldSheetName: oldSheet.sheetName,
    newSheetName: newSheet.sheetName,
    oldFileName: oldSheet.fileName,
    newFileName: newSheet.fileName,
    summary,
    records,
  };
}

/**
 * Spasi awal/akhir sudah dibuang saat file dibaca, jadi di sini perbandingan
 * bersifat persis — termasuk huruf besar/kecil, yang tetap dihitung sebagai
 * perubahan.
 */
function diffRow(oldValues: RowValues, newValues: RowValues, columns: string[]): ChangedField[] {
  const changes: ChangedField[] = [];

  for (const column of columns) {
    const oldValue = oldValues[column] ?? "";
    const newValue = newValues[column] ?? "";
    if (oldValue !== newValue) {
      changes.push({ column, oldValue, newValue });
    }
  }

  return changes;
}
