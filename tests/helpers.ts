import * as fs from "node:fs";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/lib/excel";
import type { ParsedSheet } from "@/lib/types";

// Build ESM SheetJS perlu dihubungkan ke fs saat dipakai di Node (test).
XLSX.set_fs(fs);

/** Membuat buffer .xlsx dari array-of-arrays, seluruh sel bertipe teks. */
export function makeXlsx(rows: string[][], sheetName = "Sheet1"): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
}

export function sheetFrom(rows: string[][], fileName = "test.xlsx", sheetName = "Sheet1"): ParsedSheet {
  return parseWorkbook(makeXlsx(rows, sheetName), fileName);
}

export function readFixture(path: string, fileName: string): ParsedSheet {
  return parseWorkbook(new Uint8Array(fs.readFileSync(path)), fileName);
}

/** Workbook yang sengaja menyimpan sel rumus, untuk menguji penolakan formula. */
export function makeXlsxWithFormula(): Uint8Array {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Kode", "Qty", "Total"],
    ["A1", "2", ""],
  ]);
  sheet.C2 = { t: "n", v: 4, f: "B2*2" };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
}
