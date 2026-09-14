"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { compareSheets } from "@/lib/compare";
import { AppError, toAppError } from "@/lib/errors";
import { readExcelFile } from "@/lib/excel";
import { downloadResult } from "@/lib/export";
import type { CompareResult, ParsedSheet } from "@/lib/types";
import { FileDrop } from "./file-drop";
import { AlertIcon, DownloadIcon, LockIcon } from "./icons";
import { ResultTable } from "./result-table";
import { SettingsPanel } from "./settings-panel";
import { SummaryCards } from "./summary-cards";
import type { FilterKey } from "./status-styles";

type Slot = "old" | "new";

const DEMO_FILES: Record<Slot, string> = {
  old: "/demo/dealer_master_old.xlsx",
  new: "/demo/dealer_master_new.xlsx",
};

/** Kolom ID default: kolom pertama yang namanya mengandung "id". */
function guessIdColumn(columns: string[]): string {
  const byName = columns.find((column) => /\bid\b/i.test(column) || /id$/i.test(column));
  return byName ?? columns[0] ?? "";
}

export function ChangeDetector() {
  const [oldSheet, setOldSheet] = useState<ParsedSheet | null>(null);
  const [newSheet, setNewSheet] = useState<ParsedSheet | null>(null);
  const [loadingSlot, setLoadingSlot] = useState<Slot | null>(null);

  const [idColumn, setIdColumn] = useState("");
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([]);

  const [result, setResult] = useState<CompareResult | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [error, setError] = useState<AppError | null>(null);
  const [comparing, setComparing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const errorRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bothLoaded = oldSheet !== null && newSheet !== null;

  const columns = useMemo(() => {
    if (!bothLoaded) return [];
    // Struktur kedua file divalidasi saat Bandingkan; di sini cukup pakai
    // kolom file baru sebagai daftar pilihan.
    return newSheet.columns;
  }, [bothLoaded, newSheet]);

  // Kolom ID diturunkan dari daftar kolom, bukan disinkronkan lewat effect:
  // kalau pilihan lama tidak ada di file yang sekarang, pakai tebakan default.
  const effectiveIdColumn = useMemo(() => {
    if (columns.length === 0) return "";
    return idColumn && columns.includes(idColumn) ? idColumn : guessIdColumn(columns);
  }, [columns, idColumn]);

  /** Hasil lama dibuang setiap kali file atau pengaturan berubah. */
  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setFilter("all");
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function reportError(caught: unknown) {
    const appError = toAppError(caught);
    setError(appError);
    // Shake sekali saat pesan error muncul (resep error-state-shake).
    const node = errorRef.current;
    if (node) {
      node.classList.remove("is-shaking");
      void node.offsetHeight;
      node.classList.add("is-shaking");
    }
  }

  async function loadFile(slot: Slot, file: File) {
    clearResult();
    setLoadingSlot(slot);
    try {
      const sheet = await readExcelFile(file);
      if (slot === "old") setOldSheet(sheet);
      else setNewSheet(sheet);
    } catch (caught) {
      if (slot === "old") setOldSheet(null);
      else setNewSheet(null);
      reportError(caught);
    } finally {
      setLoadingSlot(null);
    }
  }

  function clearSlot(slot: Slot) {
    clearResult();
    if (slot === "old") setOldSheet(null);
    else setNewSheet(null);
  }

  function handleCompare() {
    if (!oldSheet || !newSheet) return;
    setComparing(true);
    setError(null);

    // Beri satu frame supaya loading state sempat tampil sebelum kerja sinkron.
    requestAnimationFrame(() => {
      try {
        const next = compareSheets(oldSheet, newSheet, {
          idColumn: effectiveIdColumn,
          ignoredColumns,
        });
        setResult(next);
        setFilter("all");
      } catch (caught) {
        setResult(null);
        reportError(caught);
      } finally {
        setComparing(false);
      }
    });
  }

  /**
   * Data demo diambil dari file statis lalu melewati jalur baca dan
   * bandingkan yang sama persis dengan file pengguna — tidak ada hasil
   * yang di-hardcode.
   */
  async function handleDemo() {
    reset();
    setLoadingSlot("old");
    try {
      const [oldFile, newFile] = await Promise.all([
        fetchDemoFile("old"),
        fetchDemoFile("new"),
      ]);
      const parsedOld = await readExcelFile(oldFile);
      setLoadingSlot("new");
      const parsedNew = await readExcelFile(newFile);

      setOldSheet(parsedOld);
      setNewSheet(parsedNew);

      const demoIdColumn = guessIdColumn(parsedNew.columns);
      setIdColumn(demoIdColumn);
      setIgnoredColumns([]);
      setResult(compareSheets(parsedOld, parsedNew, { idColumn: demoIdColumn, ignoredColumns: [] }));
      setFilter("all");
    } catch (caught) {
      reportError(caught);
    } finally {
      setLoadingSlot(null);
    }
  }

  async function fetchDemoFile(slot: Slot): Promise<File> {
    const url = DEMO_FILES[slot];
    const response = await fetch(url);
    if (!response.ok) {
      throw new AppError("File demo tidak bisa dimuat.", ["Coba muat ulang halaman ini."]);
    }
    const blob = await response.blob();
    return new File([blob], url.split("/").pop() ?? "demo.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  async function handleDownloadSample() {
    try {
      for (const slot of ["old", "new"] as Slot[]) {
        const url = DEMO_FILES[slot];
        const response = await fetch(url);
        if (!response.ok) throw new AppError("File contoh tidak bisa diunduh.");
        const blob = await response.blob();
        triggerDownload(blob, url.split("/").pop() ?? "contoh.xlsx");
      }
      showToast("Dua file Excel contoh diunduh.");
    } catch (caught) {
      reportError(caught);
    }
  }

  function triggerDownload(blob: Blob, fileName: string) {
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  }

  function handleDownloadResult() {
    if (!result) return;
    try {
      downloadResult(result);
      showToast("changes.xlsx berhasil diunduh.");
    } catch (caught) {
      reportError(caught);
    }
  }

  /** Reset membersihkan file dan hasil dari state aplikasi. */
  function reset() {
    setOldSheet(null);
    setNewSheet(null);
    setIdColumn("");
    setIgnoredColumns([]);
    setResult(null);
    setError(null);
    setFilter("all");
    setComparing(false);
    setLoadingSlot(null);
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Excel Change Detector</h1>
        <p className="mt-1.5 text-sm text-muted sm:text-base">
          Bandingkan dua Excel. Temukan apa yang berubah.
        </p>
        <p className="mt-3 inline-flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
          <LockIcon className="mt-px h-3.5 w-3.5 shrink-0 text-green-700" />
          File diproses di browser Anda, tidak diunggah ke server.
        </p>
      </header>

      {/* A. Dua kotak pemilihan file */}
      <section className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-4" aria-label="Pilih file">
        <FileDrop
          label="File Lama"
          hint="versi sebelumnya"
          sheet={oldSheet}
          loading={loadingSlot === "old"}
          onFile={(file) => loadFile("old", file)}
          onClear={() => clearSlot("old")}
        />
        <FileDrop
          label="File Baru"
          hint="versi terkini"
          sheet={newSheet}
          loading={loadingSlot === "new"}
          onFile={(file) => loadFile("new", file)}
          onClear={() => clearSlot("new")}
        />
      </section>

      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="t-input mt-4 rounded-xl border border-red-300 bg-red-50 p-4"
        >
          <p className="flex items-start gap-2 text-sm font-semibold text-red-900">
            <AlertIcon className="mt-px h-4 w-4 shrink-0" />
            {error.message}
          </p>
          {error.details.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-8 text-sm text-red-900/90">
              {error.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* B. Pengaturan */}
      <div className="mt-4">
        <SettingsPanel
          columns={columns}
          idColumn={effectiveIdColumn}
          ignoredColumns={ignoredColumns}
          disabled={!bothLoaded}
          busy={comparing}
          onIdColumnChange={(column) => {
            clearResult();
            setIdColumn(column);
            setIgnoredColumns((current) => current.filter((item) => item !== column));
          }}
          onToggleIgnored={(column) => {
            clearResult();
            setIgnoredColumns((current) =>
              current.includes(column)
                ? current.filter((item) => item !== column)
                : [...current, column],
            );
          }}
          onCompare={handleCompare}
        />
      </div>

      {/* D. Tombol aksi */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDownloadResult}
          disabled={!result}
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <DownloadIcon className="h-4 w-4" />
          Unduh Hasil
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-stone-300 bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleDemo}
          className="rounded-lg border border-stone-300 bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
        >
          Coba Data Demo
        </button>
        <button
          type="button"
          onClick={handleDownloadSample}
          className="rounded-lg border border-stone-300 bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:bg-stone-50"
        >
          Unduh Excel Contoh
        </button>
      </div>

      {/* C. Hasil */}
      <div className="mt-7">
        {comparing && (
          <div className="t-skel-skeleton is-pulsing space-y-3" style={{ position: "static" }}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="skeleton-bar h-[92px]" />
              ))}
            </div>
            <div className="skeleton-bar h-56" />
          </div>
        )}

        {!comparing && result && (
          <div className="t-panel-slide space-y-4" data-open="true">
            <SummaryCards summary={result.summary} active={filter} onSelect={setFilter} />

            <p className="text-xs text-muted">
              Dibandingkan berdasarkan kolom{" "}
              <span className="font-medium text-foreground">{result.idColumn}</span>
              {result.ignoredColumns.length > 0 && (
                <> · mengabaikan {result.ignoredColumns.join(", ")}</>
              )}{" "}
              · sheet &ldquo;{result.oldSheetName}&rdquo; vs &ldquo;{result.newSheetName}&rdquo;
            </p>

            <ResultTable result={result} filter={filter} onFilterChange={setFilter} />
          </div>
        )}

        {!comparing && !result && (
          <div className="rounded-xl border border-dashed border-stone-300 bg-surface/60 p-8 text-center">
            <p className="text-sm font-medium">Belum ada hasil</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
              Pilih file lama dan file baru, tentukan kolom ID, lalu tekan Bandingkan. Belum punya
              file? Gunakan <span className="font-medium text-foreground">Coba Data Demo</span>.
            </p>
          </div>
        )}
      </div>

      <footer className="mt-10 border-t border-line pt-5 text-xs leading-relaxed text-muted">
        <p>
          Hanya mendukung .xlsx, maksimal 5 MB dan 5.000 baris per file. Sheet pertama dibaca,
          baris pertama dianggap header. Data tidak disimpan ke server, localStorage, maupun
          database — menutup atau memuat ulang halaman akan menghapusnya.
        </p>
      </footer>

      {/* Toast memakai resep "toast" dari transitions.dev. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-0"
      >
        <div
          className={`t-toast rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            toast ? "is-open" : ""
          }`}
        >
          {toast ?? ""}
        </div>
      </div>
    </main>
  );
}
