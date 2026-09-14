import { describe, expect, it } from "vitest";
import { compareSheets } from "@/lib/compare";
import { AppError } from "@/lib/errors";
import { sheetFrom } from "./helpers";

const HEADER = ["Dealer ID", "Dealer Name", "Area", "Status"];

function build(rows: string[][]) {
  return sheetFrom([HEADER, ...rows]);
}

describe("compareSheets", () => {
  it("mengelompokkan record menjadi ditambahkan, dihapus, berubah, dan tetap", () => {
    const oldSheet = build([
      ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
      ["0002", "Dealer Demo 002", "Bandung", "Aktif"],
      ["0003", "Dealer Demo 003", "Medan", "Aktif"],
    ]);
    const newSheet = build([
      ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
      ["0002", "Dealer Demo 002", "Surabaya", "Aktif"],
      ["0004", "Dealer Demo 004", "Bekasi", "Aktif"],
    ]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
  });

  it("mencocokkan berdasarkan ID meski urutan baris berbeda", () => {
    const oldSheet = build([
      ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
      ["0002", "Dealer Demo 002", "Bandung", "Aktif"],
      ["0003", "Dealer Demo 003", "Medan", "Aktif"],
    ]);
    const newSheet = build([
      ["0003", "Dealer Demo 003", "Medan", "Aktif"],
      ["0001", "Dealer Demo 001", "Jakarta", "Aktif"],
      ["0002", "Dealer Demo 002", "Bandung", "Aktif"],
    ]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 3 });
  });

  it("menghitung satu record dengan tiga kolom berubah sebagai satu record Berubah", () => {
    const oldSheet = build([["0001", "Dealer Demo 001", "Jakarta", "Aktif"]]);
    const newSheet = build([["0001", "Dealer Demo Satu", "Denpasar", "Pending"]]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary.changed).toBe(1);
    const record = result.records.find((item) => item.id === "0001");
    expect(record?.changes).toHaveLength(3);
    expect(record?.changes.map((change) => change.column).sort()).toEqual([
      "Area",
      "Dealer Name",
      "Status",
    ]);
  });

  it("tidak menghitung kolom yang diabaikan sebagai perubahan", () => {
    const oldSheet = build([["0001", "Dealer Demo 001", "Jakarta", "Aktif"]]);
    const newSheet = build([["0001", "Dealer Demo 001", "Denpasar", "Aktif"]]);

    const withArea = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });
    expect(withArea.summary.changed).toBe(1);

    const ignoringArea = compareSheets(oldSheet, newSheet, {
      idColumn: "Dealer ID",
      ignoredColumns: ["Area"],
    });
    expect(ignoringArea.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1 });
    expect(ignoringArea.comparedColumns).toEqual(["Dealer Name", "Status"]);
  });

  it("menganggap perbedaan huruf besar/kecil sebagai perubahan", () => {
    const oldSheet = build([["0001", "Dealer Demo 001", "Jakarta", "Aktif"]]);
    const newSheet = build([["0001", "Dealer Demo 001", "Jakarta", "aktif"]]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary.changed).toBe(1);
  });

  it("mengabaikan spasi awal/akhir saat membandingkan", () => {
    const oldSheet = build([["0001", "Dealer Demo 001", "Jakarta", "Aktif"]]);
    const newSheet = build([["  0001 ", " Dealer Demo 001", "Jakarta  ", " Aktif "]]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1 });
  });

  it("membedakan kode berawalan nol dari angka biasa", () => {
    const oldSheet = build([["0001", "Dealer Demo 001", "Jakarta", "Aktif"]]);
    const newSheet = build([["1", "Dealer Demo 001", "Jakarta", "Aktif"]]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 1, removed: 1, changed: 0, unchanged: 0 });
  });

  it("menghentikan perbandingan saat ada ID ganda dan menyebut nomor barisnya", () => {
    const oldSheet = build([["0001", "A", "Jakarta", "Aktif"]]);
    const newSheet = build([
      ["0001", "A", "Jakarta", "Aktif"],
      ["0001", "B", "Bandung", "Aktif"],
    ]);

    try {
      compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });
      throw new Error("seharusnya gagal");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.message).toMatch(/ID ganda/i);
      expect(appError.details.join(" ")).toMatch(/"0001" muncul di baris 2, 3/);
    }
  });

  it("menghentikan perbandingan saat ada ID kosong dan menyebut nomor barisnya", () => {
    const oldSheet = build([["0001", "A", "Jakarta", "Aktif"]]);
    const newSheet = build([
      ["0001", "A", "Jakarta", "Aktif"],
      ["", "B", "Bandung", "Aktif"],
    ]);

    try {
      compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });
      throw new Error("seharusnya gagal");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.message).toMatch(/kosong/i);
      expect(appError.details.join(" ")).toMatch(/diperbaiki: 3/);
    }
  });

  it("menolak struktur kolom yang berbeda dan menyebut kolom bermasalah", () => {
    const oldSheet = sheetFrom([
      ["Dealer ID", "Area", "Status"],
      ["0001", "Jakarta", "Aktif"],
    ]);
    const newSheet = sheetFrom([
      ["Dealer ID", "Area", "PIC"],
      ["0001", "Jakarta", "PIC Demo 001"],
    ]);

    try {
      compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });
      throw new Error("seharusnya gagal");
    } catch (error) {
      const appError = error as AppError;
      expect(appError.message).toMatch(/Struktur kolom/i);
      expect(appError.details.join(" ")).toMatch(/Status/);
      expect(appError.details.join(" ")).toMatch(/PIC/);
    }
  });

  it("menerima urutan kolom yang berbeda selama namanya sama", () => {
    const oldSheet = sheetFrom([
      ["Dealer ID", "Area", "Status"],
      ["0001", "Jakarta", "Aktif"],
    ]);
    const newSheet = sheetFrom([
      ["Status", "Dealer ID", "Area"],
      ["Aktif", "0001", "Jakarta"],
    ]);

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 1 });
  });

  it("menolak jika semua kolom pembanding diabaikan", () => {
    const oldSheet = build([["0001", "A", "Jakarta", "Aktif"]]);
    const newSheet = build([["0001", "A", "Jakarta", "Aktif"]]);

    expect(() =>
      compareSheets(oldSheet, newSheet, {
        idColumn: "Dealer ID",
        ignoredColumns: ["Dealer Name", "Area", "Status"],
      }),
    ).toThrowError(/tidak ada kolom yang tersisa/i);
  });
});
