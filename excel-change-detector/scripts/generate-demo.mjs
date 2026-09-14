/**
 * Membuat dua file Excel demo yang seluruh datanya fiktif.
 *
 * Target hasil perbandingan (Kolom ID = "Dealer ID"):
 *   5 Ditambahkan, 3 Dihapus, 6 Berubah, 21 Tetap.
 *
 * Jalankan: npm run generate:demo
 */
import * as fs from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

// Build ESM SheetJS tidak otomatis terhubung ke fs saat dijalankan di Node.
XLSX.set_fs(fs);

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "public", "demo");

const COLUMNS = ["Dealer ID", "Dealer Name", "Area", "Status", "PIC"];
const AREAS = ["Jakarta", "Bandung", "Surabaya", "Medan", "Makassar", "Semarang"];
const STATUSES = ["Aktif", "Nonaktif", "Pending"];

/** ID dibuat sebagai teks berawalan nol untuk menguji aturan "jangan jadikan angka". */
const pad = (n) => String(n).padStart(4, "0");
const label = (n) => String(n).padStart(3, "0");

const REMOVED_IDS = [5, 14, 27];          // hanya ada di file lama  -> 3 Dihapus
const ADDED_IDS = [31, 32, 33, 34, 35];   // hanya ada di file baru  -> 5 Ditambahkan

/** 6 record berubah; 0012 sengaja berubah di tiga kolom sekaligus. */
const CHANGES = {
  3: { Area: "Bekasi" },
  9: { Status: "Nonaktif" },
  12: { Area: "Denpasar", Status: "Pending", PIC: "PIC Demo 112" },
  18: { "Dealer Name": "Dealer Demo 018 Cabang Utara" },
  21: { PIC: "PIC Demo 121" },
  30: { Status: "aktif" }, // beda huruf besar/kecil tetap dihitung sebagai perubahan
};

function baseRecord(n) {
  return {
    "Dealer ID": pad(n),
    "Dealer Name": `Dealer Demo ${label(n)}`,
    Area: AREAS[n % AREAS.length],
    Status: STATUSES[n % STATUSES.length],
    PIC: `PIC Demo ${label(n)}`,
  };
}

const oldRecords = [];
for (let n = 1; n <= 30; n += 1) oldRecords.push(baseRecord(n));

const newRecords = [];
for (let n = 1; n <= 30; n += 1) {
  if (REMOVED_IDS.includes(n)) continue;
  const record = baseRecord(n);
  const change = CHANGES[n];
  if (change) Object.assign(record, change);
  newRecords.push(record);
}
for (const n of ADDED_IDS) newRecords.push(baseRecord(n));

/** Pengacakan deterministik (LCG) supaya file demo selalu sama tiap dibuat ulang. */
function shuffle(items, seed) {
  const result = [...items];
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Urutan baris file baru diacak untuk menguji pencocokan berdasarkan ID,
// bukan posisi baris.
const shuffledNew = shuffle(newRecords, 20240917);

function writeWorkbook(records, sheetName, fileName) {
  const aoa = [COLUMNS, ...records.map((record) => COLUMNS.map((column) => record[column]))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);

  // Paksa seluruh sel menjadi teks agar "0001" tidak berubah menjadi 1.
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell) {
        cell.t = "s";
        cell.v = String(cell.v);
      }
    }
  }
  sheet["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 16 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  mkdirSync(outDir, { recursive: true });
  const target = resolve(outDir, fileName);
  XLSX.writeFile(workbook, target, { bookType: "xlsx", compression: true });
  console.log(`${fileName.padEnd(24)} ${String(records.length).padStart(2)} record  sheet "${sheetName}"`);
}

writeWorkbook(oldRecords, "Dealer Master", "dealer_master_old.xlsx");
writeWorkbook(shuffledNew, "Dealer Master", "dealer_master_new.xlsx");

console.log(
  `\nTarget: ${ADDED_IDS.length} Ditambahkan, ${REMOVED_IDS.length} Dihapus, ` +
    `${Object.keys(CHANGES).length} Berubah, ${30 - REMOVED_IDS.length - Object.keys(CHANGES).length} Tetap`,
);
