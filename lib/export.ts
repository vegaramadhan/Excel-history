import * as XLSX from "xlsx";
import type { CompareResult, DiffRecord } from "./types";

export const EXPORT_FILE_NAME = "changes.xlsx";

/**
 * Semua nilai ditulis sebagai teks (tipe sel "s"), bukan formula, supaya
 * kode berawalan nol tetap utuh dan tidak ada rumus yang ikut terbawa.
 */
function sheetFromAoa(rows: string[][]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet(rows, { cellDates: false });

  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[address] as XLSX.CellObject | undefined;
      if (!cell) continue;
      cell.t = "s";
      cell.v = String(cell.v ?? "");
      delete cell.f;
      delete cell.z;
    }
  }

  sheet["!cols"] = columnWidths(rows);
  return sheet;
}

function columnWidths(rows: string[][]): XLSX.ColInfo[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      const length = String(cell ?? "").length;
      widths[index] = Math.max(widths[index] ?? 10, Math.min(length + 2, 50));
    });
  }
  return widths.map((width) => ({ wch: width }));
}

function recordRows(records: DiffRecord[], columns: string[], side: "old" | "new"): string[][] {
  return records.map((record) => {
    const values = side === "old" ? record.oldValues : record.newValues;
    return columns.map((column) => values?.[column] ?? "");
  });
}

/**
 * Membangun changes.xlsx berisi seluruh hasil perbandingan — bukan hanya
 * halaman tabel yang sedang terlihat.
 */
export function buildExportWorkbook(result: CompareResult): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const { columns, summary } = result;

  const added = result.records.filter((record) => record.status === "added");
  const removed = result.records.filter((record) => record.status === "removed");
  const changed = result.records.filter((record) => record.status === "changed");

  const summaryRows: string[][] = [
    ["Excel Change Detector — Ringkasan"],
    [],
    ["Kategori", "Jumlah Record"],
    ["Ditambahkan", String(summary.added)],
    ["Dihapus", String(summary.removed)],
    ["Berubah", String(summary.changed)],
    ["Tetap", String(summary.unchanged)],
    ["Total record unik", String(summary.added + summary.removed + summary.changed + summary.unchanged)],
    [],
    ["Pengaturan", "Nilai"],
    ["File lama", result.oldFileName],
    ["Sheet file lama", result.oldSheetName],
    ["File baru", result.newFileName],
    ["Sheet file baru", result.newSheetName],
    ["Kolom ID", result.idColumn],
    ["Kolom diabaikan", result.ignoredColumns.length > 0 ? result.ignoredColumns.join(", ") : "(tidak ada)"],
    ["Kolom dibandingkan", result.comparedColumns.join(", ")],
  ];

  const detailRows: string[][] = [["ID", "Kolom", "Nilai Lama", "Nilai Baru"]];
  for (const record of changed) {
    for (const change of record.changes) {
      detailRows.push([record.id, change.column, change.oldValue, change.newValue]);
    }
  }

  XLSX.utils.book_append_sheet(workbook, sheetFromAoa(summaryRows), "Ringkasan");
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromAoa([columns, ...recordRows(added, columns, "new")]),
    "Ditambahkan",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    sheetFromAoa([columns, ...recordRows(removed, columns, "old")]),
    "Dihapus",
  );
  XLSX.utils.book_append_sheet(workbook, sheetFromAoa(detailRows), "Detail_Perubahan");

  return workbook;
}

/** Menyusun dan mengunduh changes.xlsx sepenuhnya di browser. */
export function downloadResult(result: CompareResult, fileName: string = EXPORT_FILE_NAME): void {
  const workbook = buildExportWorkbook(result);
  XLSX.writeFile(workbook, fileName, { bookType: "xlsx", compression: true });
}
