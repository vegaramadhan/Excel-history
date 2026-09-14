import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { compareSheets } from "@/lib/compare";
import { buildExportWorkbook } from "@/lib/export";
import { sheetFrom } from "./helpers";

const HEADER = ["Dealer ID", "Dealer Name", "Area", "Status"];

function sampleResult() {
  const oldSheet = sheetFrom([
    HEADER,
    ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
    ["0002", "Dealer Demo 002", "Bandung", "Aktif"],
    ["0003", "Dealer Demo 003", "Medan", "Aktif"],
  ], "lama.xlsx");
  const newSheet = sheetFrom([
    HEADER,
    ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
    ["0002", "Dealer Demo Dua", "Surabaya", "Pending"],
    ["0004", "Dealer Demo 004", "Bekasi", "Aktif"],
  ], "baru.xlsx");

  return compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID", ignoredColumns: [] });
}

/** Menulis lalu membaca ulang workbook, meniru file yang benar-benar diunduh. */
function roundTrip(workbook: XLSX.WorkBook): XLSX.WorkBook {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as Uint8Array;
  return XLSX.read(buffer, { type: "array", cellFormula: true });
}

function rowsOf(workbook: XLSX.WorkBook, sheetName: string): string[][] {
  return XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
    header: 1,
    raw: false,
    defval: "",
    blankrows: true,
  });
}

describe("buildExportWorkbook", () => {
  it("membuat empat sheet sesuai spesifikasi", () => {
    const workbook = roundTrip(buildExportWorkbook(sampleResult()));

    expect(workbook.SheetNames).toEqual([
      "Ringkasan",
      "Ditambahkan",
      "Dihapus",
      "Detail_Perubahan",
    ]);
  });

  it("sheet Ringkasan memuat jumlah per kategori dan pengaturan", () => {
    const workbook = roundTrip(buildExportWorkbook(sampleResult()));
    const text = rowsOf(workbook, "Ringkasan")
      .map((row) => row.join("|"))
      .join("\n");

    expect(text).toMatch(/Ditambahkan\|1/);
    expect(text).toMatch(/Dihapus\|1/);
    expect(text).toMatch(/Berubah\|1/);
    expect(text).toMatch(/Tetap\|1/);
    expect(text).toMatch(/Kolom ID\|Dealer ID/);
    expect(text).toMatch(/lama\.xlsx/);
    expect(text).toMatch(/baru\.xlsx/);
  });

  it("sheet Ditambahkan dan Dihapus memuat isi record lengkap", () => {
    const workbook = roundTrip(buildExportWorkbook(sampleResult()));

    const added = rowsOf(workbook, "Ditambahkan");
    expect(added[0]).toEqual(HEADER);
    expect(added[1]).toEqual(["0004", "Dealer Demo 004", "Bekasi", "Aktif"]);

    const removed = rowsOf(workbook, "Dihapus");
    expect(removed[0]).toEqual(HEADER);
    expect(removed[1]).toEqual(["0003", "Dealer Demo 003", "Medan", "Aktif"]);
  });

  it("sheet Detail_Perubahan memuat satu baris per kolom yang berubah", () => {
    const workbook = roundTrip(buildExportWorkbook(sampleResult()));
    const detail = rowsOf(workbook, "Detail_Perubahan");

    expect(detail[0]).toEqual(["ID", "Kolom", "Nilai Lama", "Nilai Baru"]);
    expect(detail.slice(1)).toEqual([
      ["0002", "Dealer Name", "Dealer Demo 002", "Dealer Demo Dua"],
      ["0002", "Area", "Bandung", "Surabaya"],
      ["0002", "Status", "Aktif", "Pending"],
    ]);
  });

  it("menulis nilai sebagai data, bukan formula, dan mempertahankan awalan nol", () => {
    const workbook = roundTrip(buildExportWorkbook(sampleResult()));

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      for (const address of Object.keys(sheet)) {
        if (address.startsWith("!")) continue;
        const cell = sheet[address] as XLSX.CellObject;
        expect(cell.f).toBeUndefined();
        expect(cell.t).toBe("s");
      }
    }

    const added = rowsOf(workbook, "Ditambahkan");
    expect(added[1][0]).toBe("0004");
  });

  it("mengekspor seluruh hasil, bukan hanya satu halaman tabel", () => {
    const oldRows = Array.from({ length: 120 }, (_, i) => [
      String(i + 1).padStart(4, "0"),
      `Dealer Demo ${i + 1}`,
      "Jakarta",
      "Aktif",
    ]);
    const newRows = oldRows.map((row) => [row[0], row[1], "Bandung", row[3]]);

    const result = compareSheets(
      sheetFrom([HEADER, ...oldRows]),
      sheetFrom([HEADER, ...newRows]),
      { idColumn: "Dealer ID" },
    );
    expect(result.summary.changed).toBe(120);

    const workbook = roundTrip(buildExportWorkbook(result));
    const detail = rowsOf(workbook, "Detail_Perubahan");

    // 120 record berubah, masing-masing satu kolom, ditambah baris header.
    expect(detail).toHaveLength(121);
  });
});
