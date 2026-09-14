import * as XLSX from "xlsx";
import { AppError } from "./errors";
import type { ParsedRow, ParsedSheet } from "./types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 5000;

/** Dipakai untuk pesan ukuran file yang ramah dibaca. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isBlank(value: string): boolean {
  return value.trim() === "";
}

/**
 * Membaca sheet pertama dari workbook .xlsx.
 *
 * Semua nilai dibaca sebagai teks terformat (`raw: false`) supaya kode
 * berawalan nol seperti "007" tidak berubah menjadi angka 7. Spasi di awal
 * dan akhir dibuang, tetapi perbedaan huruf besar/kecil dipertahankan.
 */
export function parseWorkbook(data: ArrayBuffer | Uint8Array, fileName: string): ParsedSheet {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(data, { type: "array", cellFormula: true, cellDates: false });
  } catch {
    throw new AppError(`"${fileName}" tidak dapat dibaca sebagai file .xlsx.`, [
      "Pastikan file benar-benar berformat .xlsx dan tidak rusak atau terproteksi password.",
    ]);
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new AppError(`"${fileName}" tidak memiliki sheet apa pun.`);
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"]) {
    throw new AppError(`Sheet "${sheetName}" pada "${fileName}" kosong.`, [
      "Isi sheet pertama dengan header di baris pertama dan minimal satu baris data.",
    ]);
  }

  assertNoFormulas(sheet, fileName, sheetName);

  const range = XLSX.utils.decode_range(sheet["!ref"]);
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });

  // Nomor baris Excel sebenarnya, supaya pesan error menunjuk baris yang tepat.
  const excelRowNumber = (index: number) => range.s.r + index + 1;

  const headerIndex = matrix.findIndex((row) => row.some((cell) => !isBlank(String(cell ?? ""))));
  if (headerIndex === -1) {
    throw new AppError(`Sheet "${sheetName}" pada "${fileName}" tidak berisi data.`);
  }

  const columns = normalizeHeader(matrix[headerIndex], fileName, sheetName, excelRowNumber(headerIndex));

  const rows: ParsedRow[] = [];
  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const raw = matrix[i] ?? [];
    const values: Record<string, string> = {};
    let hasValue = false;

    columns.forEach((column, columnIndex) => {
      const cell = String(raw[columnIndex] ?? "").trim();
      values[column] = cell;
      if (cell !== "") hasValue = true;
    });

    // Baris yang seluruhnya kosong diabaikan.
    if (!hasValue) continue;

    rows.push({ rowNumber: excelRowNumber(i), values });

    if (rows.length > MAX_DATA_ROWS) {
      throw new AppError(
        `"${fileName}" melebihi batas ${MAX_DATA_ROWS.toLocaleString("id-ID")} baris data.`,
        ["Versi ini dibatasi agar pemrosesan tetap ringan di browser. Pecah file menjadi beberapa bagian."],
      );
    }
  }

  if (rows.length === 0) {
    throw new AppError(`"${fileName}" hanya berisi header, tanpa baris data.`);
  }

  return { fileName, sheetName, columns, rows };
}

function normalizeHeader(
  headerRow: string[],
  fileName: string,
  sheetName: string,
  rowNumber: number,
): string[] {
  const columns = headerRow.map((cell) => String(cell ?? "").trim());

  // Buang kolom kosong yang menggantung di kanan header.
  while (columns.length > 0 && columns[columns.length - 1] === "") {
    columns.pop();
  }

  if (columns.length === 0) {
    throw new AppError(`Header pada "${fileName}" kosong.`, [
      `Isi baris ${rowNumber} di sheet "${sheetName}" dengan nama kolom.`,
    ]);
  }

  const emptyPositions = columns
    .map((column, index) => (column === "" ? XLSX.utils.encode_col(index) : null))
    .filter((value): value is string => value !== null);

  if (emptyPositions.length > 0) {
    throw new AppError(`Ada kolom tanpa nama pada header "${fileName}".`, [
      `Beri nama kolom di posisi ${emptyPositions.join(", ")} (baris ${rowNumber}, sheet "${sheetName}").`,
    ]);
  }

  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  columns.forEach((column) => {
    const count = (seen.get(column) ?? 0) + 1;
    seen.set(column, count);
    if (count === 2) duplicates.push(column);
  });

  if (duplicates.length > 0) {
    throw new AppError(`Nama kolom ganda pada "${fileName}": ${duplicates.join(", ")}.`, [
      `Pastikan setiap kolom di baris ${rowNumber} memiliki nama yang unik.`,
    ]);
  }

  return columns;
}

/**
 * Perbandingan memakai nilai statis. Jika masih ada sel rumus, hasilnya bisa
 * menyesatkan, jadi proses dihentikan dan pengguna diminta menyimpan ulang
 * sebagai values-only.
 */
function assertNoFormulas(sheet: XLSX.WorkSheet, fileName: string, sheetName: string): void {
  const formulaCells: string[] = [];

  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address] as XLSX.CellObject;
    if (cell && typeof cell.f === "string" && cell.f.length > 0) {
      formulaCells.push(address);
      if (formulaCells.length >= 5) break;
    }
  }

  if (formulaCells.length > 0) {
    throw new AppError(`"${fileName}" masih berisi sel rumus.`, [
      `Contoh sel: ${formulaCells.join(", ")} di sheet "${sheetName}".`,
      "Salin seluruh data lalu Paste Special → Values, simpan sebagai .xlsx, dan unggah ulang.",
    ]);
  }
}

/** Validasi ekstensi dan ukuran sebelum file dibaca. */
export function assertFileAcceptable(name: string, size: number): void {
  if (!name.toLowerCase().endsWith(".xlsx")) {
    throw new AppError(`"${name}" bukan file .xlsx.`, [
      "Versi ini hanya mendukung .xlsx. Simpan ulang file Anda melalui Excel: Save As → Excel Workbook (.xlsx).",
    ]);
  }

  if (size > MAX_FILE_BYTES) {
    throw new AppError(`"${name}" berukuran ${formatBytes(size)}, melebihi batas 5 MB.`, [
      "Hapus sheet atau kolom yang tidak diperlukan, lalu simpan ulang filenya.",
    ]);
  }
}

/** Membaca File dari input browser. Seluruh proses terjadi di memori browser. */
export async function readExcelFile(file: File): Promise<ParsedSheet> {
  assertFileAcceptable(file.name, file.size);
  const buffer = await file.arrayBuffer();
  return parseWorkbook(buffer, file.name);
}
