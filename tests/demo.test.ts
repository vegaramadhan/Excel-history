import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compareSheets } from "@/lib/compare";
import { readFixture } from "./helpers";

const demoDir = resolve(__dirname, "..", "public", "demo");

function loadDemo() {
  const oldSheet = readFixture(resolve(demoDir, "dealer_master_old.xlsx"), "dealer_master_old.xlsx");
  const newSheet = readFixture(resolve(demoDir, "dealer_master_new.xlsx"), "dealer_master_new.xlsx");
  return { oldSheet, newSheet };
}

describe("data demo", () => {
  it("punya 30 record lama dan 32 record baru dengan kolom yang ditentukan", () => {
    const { oldSheet, newSheet } = loadDemo();

    expect(oldSheet.columns).toEqual(["Dealer ID", "Dealer Name", "Area", "Status", "PIC"]);
    expect(newSheet.columns).toEqual(["Dealer ID", "Dealer Name", "Area", "Status", "PIC"]);
    expect(oldSheet.rows).toHaveLength(30);
    expect(newSheet.rows).toHaveLength(32);
    expect(oldSheet.sheetName).toBe("Dealer Master");
  });

  it("menghasilkan tepat 5 Ditambahkan, 3 Dihapus, 6 Berubah, 21 Tetap", () => {
    const { oldSheet, newSheet } = loadDemo();

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 5, removed: 3, changed: 6, unchanged: 21 });
  });

  it("mempertahankan Dealer ID berawalan nol", () => {
    const { oldSheet } = loadDemo();

    expect(oldSheet.rows[0].values["Dealer ID"]).toBe("0001");
  });

  it("berisi satu record dengan lebih dari satu kolom berubah", () => {
    const { oldSheet, newSheet } = loadDemo();

    const result = compareSheets(oldSheet, newSheet, { idColumn: "Dealer ID" });
    const multiColumn = result.records.filter(
      (record) => record.status === "changed" && record.changes.length > 1,
    );

    expect(multiColumn.length).toBeGreaterThanOrEqual(1);
    expect(multiColumn[0].changes.length).toBe(3);
  });

  it("baris file baru tidak berurutan, sehingga menguji pencocokan lewat ID", () => {
    const { newSheet } = loadDemo();

    const ids = newSheet.rows.map((row) => row.values["Dealer ID"]);
    const sorted = [...ids].sort();

    expect(ids).not.toEqual(sorted);
  });

  it("hasilnya tetap sama walau urutan file baru diacak ulang", () => {
    const { oldSheet, newSheet } = loadDemo();
    const reversed = { ...newSheet, rows: [...newSheet.rows].reverse() };

    const result = compareSheets(oldSheet, reversed, { idColumn: "Dealer ID" });

    expect(result.summary).toEqual({ added: 5, removed: 3, changed: 6, unchanged: 21 });
  });

  it("kolom yang diabaikan mengurangi jumlah record Berubah", () => {
    const { oldSheet, newSheet } = loadDemo();

    const result = compareSheets(oldSheet, newSheet, {
      idColumn: "Dealer ID",
      ignoredColumns: ["Status"],
    });

    // Dua dari enam perubahan hanya menyentuh kolom Status saja.
    expect(result.summary.changed).toBe(4);
    expect(result.summary.unchanged).toBe(23);
    expect(result.summary.added).toBe(5);
    expect(result.summary.removed).toBe(3);
  });
});
