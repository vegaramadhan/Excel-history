import { describe, expect, it } from "vitest";
import { assertFileAcceptable, parseWorkbook } from "@/lib/excel";
import { AppError } from "@/lib/errors";
import { makeXlsxWithFormula, sheetFrom } from "./helpers";

describe("parseWorkbook", () => {
  it("membaca header, nama sheet, dan baris data", () => {
    const sheet = sheetFrom(
      [
        ["Dealer ID", "Area"],
        ["0001", "Jakarta"],
        ["0002", "Bandung"],
      ],
      "lama.xlsx",
      "Master",
    );

    expect(sheet.sheetName).toBe("Master");
    expect(sheet.columns).toEqual(["Dealer ID", "Area"]);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[0].values).toEqual({ "Dealer ID": "0001", Area: "Jakarta" });
  });

  it("mempertahankan kode berawalan nol sebagai teks", () => {
    const sheet = sheetFrom([
      ["Kode", "Nama"],
      ["007", "Demo"],
      ["0010", "Demo"],
    ]);

    expect(sheet.rows.map((row) => row.values.Kode)).toEqual(["007", "0010"]);
  });

  it("membuang spasi awal/akhir tapi mempertahankan huruf besar/kecil", () => {
    const sheet = sheetFrom([
      ["Kode", "Status"],
      ["  A1  ", "  Aktif "],
    ]);

    expect(sheet.rows[0].values).toEqual({ Kode: "A1", Status: "Aktif" });
  });

  it("melewati baris yang seluruhnya kosong dan tetap mencatat nomor baris asli", () => {
    const sheet = sheetFrom([
      ["Kode", "Nama"],
      ["A1", "Satu"],
      ["", ""],
      ["A2", "Dua"],
    ]);

    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows.map((row) => row.rowNumber)).toEqual([2, 4]);
  });

  it("menolak file yang masih berisi sel rumus", () => {
    expect(() => parseWorkbook(makeXlsxWithFormula(), "rumus.xlsx")).toThrowError(/sel rumus/i);
  });

  it("menyebutkan alamat sel rumus dan saran values-only", () => {
    try {
      parseWorkbook(makeXlsxWithFormula(), "rumus.xlsx");
      throw new Error("seharusnya gagal");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.details.join(" ")).toMatch(/C2/);
      expect(appError.details.join(" ")).toMatch(/Values/i);
    }
  });

  it("menolak nama kolom ganda", () => {
    expect(() =>
      sheetFrom([
        ["Kode", "Kode"],
        ["A1", "A2"],
      ]),
    ).toThrowError(/ganda/i);
  });

  it("menolak kolom tanpa nama di tengah header", () => {
    expect(() =>
      sheetFrom([
        ["Kode", "", "Nama"],
        ["A1", "x", "Satu"],
      ]),
    ).toThrowError(/tanpa nama/i);
  });

  it("menolak file yang hanya berisi header", () => {
    expect(() => sheetFrom([["Kode", "Nama"]])).toThrowError(/tanpa baris data/i);
  });
});

describe("assertFileAcceptable", () => {
  it("menolak ekstensi selain .xlsx", () => {
    expect(() => assertFileAcceptable("data.xls", 1000)).toThrowError(AppError);
    expect(() => assertFileAcceptable("data.csv", 1000)).toThrowError(/bukan file \.xlsx/i);
  });

  it("menolak file lebih dari 5 MB", () => {
    expect(() => assertFileAcceptable("data.xlsx", 6 * 1024 * 1024)).toThrowError(/5 MB/);
  });

  it("menerima .xlsx berukuran wajar", () => {
    expect(() => assertFileAcceptable("data.XLSX", 1024)).not.toThrow();
  });
});
