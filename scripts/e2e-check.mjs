/**
 * Pemeriksaan end-to-end di browser sungguhan (Chromium).
 *
 * Playwright sengaja tidak dijadikan dependency proyek supaya build produksi
 * tetap ringan. Jalankan seperti ini:
 *
 *   npm run build && npm start          # terminal 1
 *   npm install --no-save playwright    # sekali saja
 *   npm run e2e                         # terminal 2
 *
 * Atur BASE_URL untuk menguji hasil deploy, misalnya:
 *   BASE_URL=https://contoh.vercel.app npm run e2e
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as XLSX from "xlsx";

XLSX.set_fs(fs);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EXECUTABLE_PATH = process.env.CHROMIUM_PATH;
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ecd-e2e-"));

const results = [];
function check(name, pass, extra = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
}

const HEADER = ["Dealer ID", "Dealer Name", "Area", "Status", "PIC"];

function writeFixture(rows, fileName, header = HEADER) {
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
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
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Dealer Master");
  const target = path.join(workDir, fileName);
  XLSX.writeFile(workbook, target);
  return target;
}

const fixtures = {
  base: writeFixture(
    [
      ["0001", "A", "Jakarta", "Aktif", "P1"],
      ["0002", "B", "Bandung", "Aktif", "P2"],
    ],
    "base.xlsx",
  ),
  duplicateId: writeFixture(
    [
      ["0001", "A", "Jakarta", "Aktif", "P1"],
      ["0001", "B", "Bandung", "Aktif", "P2"],
    ],
    "dup_id.xlsx",
  ),
  emptyId: writeFixture(
    [
      ["0001", "A", "Jakarta", "Aktif", "P1"],
      ["", "B", "Bandung", "Aktif", "P2"],
    ],
    "empty_id.xlsx",
  ),
  otherColumns: writeFixture(
    [["0001", "A", "Jakarta", "Aktif", "P1"]],
    "beda_kolom.xlsx",
    ["Dealer ID", "Dealer Name", "Wilayah", "Status", "PIC"],
  ),
};
fixtures.notExcel = path.join(workDir, "bukan_excel.csv");
fs.writeFileSync(fixtures.notExcel, "Dealer ID,Nama\n0001,A\n");

// Di lingkungan yang mewajibkan proxy keluar, teruskan ke browser lewat
// HTTPS_PROXY/HTTP_PROXY supaya pengujian ke URL produksi bisa jalan.
const proxyServer = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const launchOptions = {};
if (EXECUTABLE_PATH) launchOptions.executablePath = EXECUTABLE_PATH;
if (proxyServer && !BASE.includes("localhost")) launchOptions.proxy = { server: proxyServer };
const browser = await chromium.launch(launchOptions);
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();

// Audit privasi: catat setiap request yang dibuat halaman.
const requests = [];
page.on("request", (r) => requests.push({ method: r.method(), url: r.url(), postData: r.postData() }));
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(String(e)));

const inputs = page.locator('input[type="file"]');
const alertBox = page.locator('div[role="alert"].t-input');
const detailHeading = page.getByRole("heading", { name: "Detail perubahan" });

/** Angka kartu dirender per digit, nilai utuhnya ada di aria-label grup. */
async function cardCount(label) {
  const card = page.locator("button", { has: page.getByText(label, { exact: true }) }).first();
  const value = await card.locator(".t-digit-group").getAttribute("aria-label");
  return value === null ? null : Number(value.replace(/\./g, ""));
}

async function summary() {
  return {
    added: await cardCount("Ditambahkan"),
    removed: await cardCount("Dihapus"),
    changed: await cardCount("Berubah"),
    unchanged: await cardCount("Tetap"),
  };
}

async function resetApp() {
  await page.getByRole("button", { name: "Reset" }).click();
  await page.waitForTimeout(300);
}

await page.goto(BASE, { waitUntil: "networkidle" });

// ---------- Tampilan awal ----------
check(
  "Judul dan subjudul tampil",
  (await page.getByRole("heading", { name: "Excel Change Detector" }).count()) === 1 &&
    (await page.getByText("Bandingkan dua Excel. Temukan apa yang berubah.").count()) === 1,
);
check(
  "Pesan privasi tampil",
  (await page.getByText("File diproses di browser Anda, tidak diunggah ke server.").count()) === 1,
);
check("Empty state tampil", (await page.getByText("Belum ada hasil").count()) === 1);

// ---------- Alur unggah manual ----------
await inputs.nth(0).setInputFiles("public/demo/dealer_master_old.xlsx");
await inputs.nth(1).setInputFiles("public/demo/dealer_master_new.xlsx");
await page.getByText("Sheet: Dealer Master").first().waitFor({ timeout: 15000 });
check("Kedua file terbaca beserta nama sheet", (await page.getByText("Sheet: Dealer Master").count()) === 2);
check("Kolom ID terisi otomatis", (await page.locator("select").inputValue()) === "Dealer ID");

await page.getByRole("button", { name: "Bandingkan" }).click();
await detailHeading.waitFor({ timeout: 20000 });
const manual = await summary();
check(
  "Unggah manual menghasilkan 5 / 3 / 6 / 21",
  manual.added === 5 && manual.removed === 3 && manual.changed === 6 && manual.unchanged === 21,
  JSON.stringify(manual),
);

await resetApp();
check(
  "Reset membersihkan file dan hasil",
  (await page.getByText("Belum ada hasil").count()) === 1 &&
    (await page.getByText("Sheet: Dealer Master").count()) === 0,
);

// ---------- Tombol Coba Data Demo ----------
await page.getByRole("button", { name: "Coba Data Demo" }).click();
await detailHeading.waitFor({ timeout: 20000 });
const demo = await summary();
check(
  "Coba Data Demo menghasilkan 5 / 3 / 6 / 21",
  demo.added === 5 && demo.removed === 3 && demo.changed === 6 && demo.unchanged === 21,
  JSON.stringify(demo),
);

// ---------- Filter dan pagination ----------
await page.getByRole("button", { name: /^Berubah/ }).nth(1).click();
await page.waitForTimeout(300);
check("Filter Berubah menampilkan 6 baris", (await page.locator("tbody tr").count()) === 6);

await page.getByRole("button", { name: /^Ditambahkan/ }).nth(1).click();
await page.waitForTimeout(300);
check("Filter Ditambahkan menampilkan 5 baris", (await page.locator("tbody tr").count()) === 5);

await page.getByRole("button", { name: /^Semua/ }).click();
await page.waitForTimeout(300);
check("Halaman 1 berisi 25 baris", (await page.locator("tbody tr").count()) === 25);
await page.getByRole("button", { name: "Berikutnya" }).click();
await page.waitForTimeout(300);
check("Halaman 2 berisi 10 baris sisanya", (await page.locator("tbody tr").count()) === 10);

// ---------- Unduh hasil dan periksa isinya ----------
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.getByRole("button", { name: "Unduh Hasil" }).click(),
]);
check("Nama berkas unduhan adalah changes.xlsx", download.suggestedFilename() === "changes.xlsx");

const savedPath = path.join(workDir, "changes.xlsx");
await download.saveAs(savedPath);
const workbook = XLSX.read(new Uint8Array(fs.readFileSync(savedPath)), {
  type: "array",
  cellFormula: true,
});
const rowsOf = (name) =>
  XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: false, defval: "" });

check(
  "changes.xlsx berisi empat sheet sesuai spesifikasi",
  JSON.stringify(workbook.SheetNames) ===
    JSON.stringify(["Ringkasan", "Ditambahkan", "Dihapus", "Detail_Perubahan"]),
  workbook.SheetNames.join(", "),
);

const ringkasan = rowsOf("Ringkasan").map((row) => row.join("|")).join("\n");
check(
  "Sheet Ringkasan memuat jumlah dan pengaturan",
  /Ditambahkan\|5/.test(ringkasan) &&
    /Dihapus\|3/.test(ringkasan) &&
    /Berubah\|6/.test(ringkasan) &&
    /Tetap\|21/.test(ringkasan) &&
    /Kolom ID\|Dealer ID/.test(ringkasan),
);

const added = rowsOf("Ditambahkan");
const removed = rowsOf("Dihapus");
const detail = rowsOf("Detail_Perubahan");
check("Sheet Ditambahkan berisi 5 record", added.length === 6);
check("Sheet Dihapus berisi 3 record", removed.length === 4);
check(
  "Detail_Perubahan memakai header ID | Kolom | Nilai Lama | Nilai Baru",
  JSON.stringify(detail[0]) === JSON.stringify(["ID", "Kolom", "Nilai Lama", "Nilai Baru"]),
);
// Enam record berubah, salah satunya menyentuh tiga kolom: 5 + 3 = 8 baris.
check("Ekspor memuat seluruh hasil, bukan satu halaman tabel", detail.length === 9, `${detail.length - 1} baris`);
check(
  "Ekspor mempertahankan kode berawalan nol",
  added.slice(1).every((row) => /^\d{4}$/.test(String(row[0]))),
);

let hasFormula = false;
for (const name of workbook.SheetNames) {
  for (const address of Object.keys(workbook.Sheets[name])) {
    if (!address.startsWith("!") && workbook.Sheets[name][address].f) hasFormula = true;
  }
}
check("Ekspor berisi nilai, bukan formula", !hasFormula);

// ---------- Privasi ----------
const thirdParty = requests.filter((r) => !r.url.startsWith(BASE));
check("Tidak ada request ke domain pihak ketiga", thirdParty.length === 0,
  thirdParty.map((r) => r.url).join(", ") || "tidak ada");
const nonGet = requests.filter((r) => r.method !== "GET");
check("Tidak ada request non-GET, jadi tidak ada unggahan", nonGet.length === 0,
  nonGet.map((r) => `${r.method} ${r.url}`).join(", ") || "tidak ada");
const leaked = requests.filter(
  (r) => (r.postData && /dealer/i.test(r.postData)) ||
    (/dealer_master/i.test(r.url) && !r.url.includes("/demo/")),
);
check("Nama dan isi file pengguna tidak pernah dikirim", leaked.length === 0);
const storage = await page.evaluate(() => ({
  local: Object.keys(localStorage).length,
  session: Object.keys(sessionStorage).length,
}));
check("localStorage dan sessionStorage tetap kosong", storage.local === 0 && storage.session === 0,
  JSON.stringify(storage));
check("Tidak ada error di console", consoleErrors.length === 0, consoleErrors.join(" | ") || "tidak ada");

// ---------- Hasil lama dibuang saat pengaturan berubah ----------
await page.getByRole("checkbox", { name: "Area" }).click();
await page.waitForTimeout(400);
check(
  "Mengubah kolom diabaikan menghapus hasil lama",
  (await detailHeading.count()) === 0 && (await page.getByText("Belum ada hasil").count()) === 1,
);
await page.getByRole("button", { name: "Bandingkan" }).click();
await detailHeading.waitFor({ timeout: 20000 });
const ignored = await summary();
check(
  "Mengabaikan kolom Area: Berubah 5, Tetap 22",
  ignored.changed === 5 && ignored.unchanged === 22 && ignored.added === 5 && ignored.removed === 3,
  JSON.stringify(ignored),
);
await resetApp();

// ---------- Penanganan error ----------
await inputs.nth(0).setInputFiles(fixtures.notExcel);
await page.waitForTimeout(600);
check("File non-.xlsx ditolak dengan pesan jelas",
  /bukan file \.xlsx/i.test(await alertBox.innerText()));
await resetApp();

async function expectCompareError(file, matcher, name) {
  await inputs.nth(0).setInputFiles(fixtures.base);
  await inputs.nth(1).setInputFiles(file);
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Bandingkan" }).click();
  await page.waitForTimeout(600);
  const text = (await alertBox.count()) > 0 ? await alertBox.innerText() : "";
  check(name, matcher.test(text) && (await detailHeading.count()) === 0,
    text.replace(/\n/g, " ").slice(0, 110));
  await resetApp();
}

await expectCompareError(fixtures.duplicateId, /ID ganda[\s\S]*baris 2, 3/i,
  "ID duplikat menghentikan perbandingan dan menyebut nomor baris");
await expectCompareError(fixtures.emptyId, /kosong[\s\S]*diperbaiki: 3/i,
  "ID kosong menghentikan perbandingan dan menyebut nomor baris");
await expectCompareError(fixtures.otherColumns, /Struktur kolom[\s\S]*Area[\s\S]*Wilayah/i,
  "Struktur kolom berbeda menyebut kolom yang bermasalah");

// ---------- Responsif ----------
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check("Tidak ada scroll horizontal pada lebar ponsel 390px", overflow <= 0, `${overflow}px`);

await browser.close();
fs.rmSync(workDir, { recursive: true, force: true });

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pemeriksaan lolos  (${BASE})`);
if (failed.length > 0) {
  console.log("GAGAL: " + failed.map((f) => f.name).join("; "));
  process.exit(1);
}
