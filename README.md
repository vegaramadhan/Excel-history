# Excel Change Detector

Bandingkan dua Excel. Temukan apa yang berubah.

Aplikasi satu halaman untuk membandingkan dua versi file `.xlsx` dan melihat
record mana yang **Ditambahkan**, **Dihapus**, **Berubah**, atau **Tetap**.
Seluruh pembacaan, perbandingan, dan ekspor terjadi di browser — tidak ada file
yang diunggah ke server.

## Fitur

- Dua kotak file berdampingan dengan drag-and-drop dan tombol pilih file.
- Pencocokan record berdasarkan **kolom ID**, bukan posisi baris.
- Kolom yang diabaikan bisa dicentang dan tidak memengaruhi hasil.
- Empat kartu ringkasan yang menghitung **record unik**, bukan jumlah sel.
- Filter per kategori dan tabel detail dengan pagination 25 baris per halaman.
- Ekspor `changes.xlsx` berisi sheet Ringkasan, Ditambahkan, Dihapus, dan
  Detail_Perubahan — seluruh hasil, bukan hanya halaman yang terlihat.
- Data demo yang dijalankan lewat jalur baca dan bandingkan yang sama dengan
  file pengguna.

## Menjalankan secara lokal

```bash
npm install
npm run dev
```

Buka http://localhost:3000.

Perintah lain:

| Perintah | Kegunaan |
| --- | --- |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit test (Vitest) |
| `npm run build` | Build produksi |
| `npm run generate:demo` | Membuat ulang dua file Excel demo |
| `npm run e2e` | Pemeriksaan end-to-end di browser (lihat catatan di bawah) |

`npm run e2e` memakai Playwright yang sengaja tidak dijadikan dependency proyek
agar build produksi tetap ringan:

```bash
npm run build && npm start          # terminal 1
npm install --no-save playwright    # sekali saja
npm run e2e                         # terminal 2
```

Tambahkan `BASE_URL=https://alamat-produksi` untuk menguji hasil deploy.

## Aturan perbandingan

- Hanya `.xlsx`, maksimal **5 MB** dan **5.000 baris data** per file.
- Hanya sheet pertama yang dibaca; namanya ditampilkan di kartu file.
- Baris pertama dianggap header. Baris yang seluruhnya kosong diabaikan.
- Nama kolom kedua file harus sama; urutan kolom boleh berbeda. Jika berbeda,
  aplikasi menyebutkan kolom yang bermasalah dan berhenti — pemetaan kolom
  tidak pernah ditebak.
- File yang masih berisi sel rumus ditolak; simpan ulang sebagai values-only.
- ID kosong atau ganda menghentikan perbandingan, disertai nomor baris yang
  perlu diperbaiki.
- Spasi di awal/akhir diabaikan; perbedaan huruf besar/kecil tetap dihitung
  sebagai perubahan.
- Kode berawalan nol dipertahankan sebagai teks (`0001` tidak menjadi `1`).
- Satu record dengan tiga kolom berubah tetap dihitung sebagai **satu** record
  Berubah.
- Hasil lama dibuang setiap kali file atau pengaturan diganti.

## Data demo

Dua file Excel demo (seluruh datanya fiktif) ada di:

- `public/demo/dealer_master_old.xlsx` — 30 record
- `public/demo/dealer_master_new.xlsx` — 32 record, urutan baris diacak

Kolom: `Dealer ID | Dealer Name | Area | Status | PIC`.
Membandingkannya dengan kolom ID `Dealer ID` menghasilkan
**5 Ditambahkan, 3 Dihapus, 6 Berubah, 21 Tetap**. Salah satu record (`0012`)
berubah di tiga kolom sekaligus, dan satu record lain hanya berbeda huruf
besar/kecil.

Kedua file dibuat ulang secara deterministik lewat `npm run generate:demo`
(lihat `scripts/generate-demo.mjs`).

## Privasi

- File dibaca, dibandingkan, dan diekspor sepenuhnya di browser.
- Data hanya disimpan sementara di memori; menutup atau memuat ulang halaman
  akan menghapusnya.
- Tidak ada penulisan ke `localStorage`, `sessionStorage`, database, atau log.
- Tidak ada analytics, session recording, atau skrip pihak ketiga yang dimuat
  saat runtime. Font memakai stack sistem sehingga tidak ada permintaan font
  eksternal.
- `.gitignore` memblokir `*.xlsx` milik pengguna; hanya dua Excel demo yang
  disertakan di repository.

## Struktur

```
app/                 Halaman, layout, dan style global
components/          Komponen tampilan
lib/
  excel.ts           Pembacaan .xlsx (validasi ukuran, header, formula)
  compare.ts         Mesin perbandingan berbasis kolom ID
  export.ts          Penyusunan changes.xlsx
  types.ts           Tipe bersama
public/demo/         Dua Excel demo
scripts/             Pembuat data demo dan pemeriksaan end-to-end
tests/               Unit test Vitest
transitions/         Resep micro-interaction dari transitions.dev (set gratis)
```

Fungsi pembacaan, perbandingan, dan ekspor sengaja dipisahkan dari komponen
tampilan agar bisa diuji tanpa merender UI.

## Teknologi

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- [SheetJS CE](https://docs.sheetjs.com/) — dipasang dari CDN resminya sesuai
  dokumentasi, bukan dari paket npm lama
- Micro-interaction dari [transitions.dev](https://transitions.dev) (set gratis,
  ditambahkan lewat `npx transitions-dev add --free`); resepnya tersimpan di
  `transitions/` dan CSS yang dipakai ada di `app/transitions.css`
