"use client";

import { useId, useRef, useState } from "react";
import type { ParsedSheet } from "@/lib/types";
import { CheckIcon, FileIcon, UploadIcon } from "./icons";

interface FileDropProps {
  label: string;
  hint: string;
  sheet: ParsedSheet | null;
  loading: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  onClear: () => void;
}

export function FileDrop({ label, hint, sheet, loading, disabled, onFile, onClear }: FileDropProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
    // Reset supaya memilih file yang sama dua kali tetap memicu onChange.
    if (inputRef.current) inputRef.current.value = "";
  }

  const state = loading ? "loading" : sheet ? "loaded" : "empty";

  return (
    <div
      className={[
        "relative flex min-h-[190px] flex-col rounded-xl border-2 border-dashed p-4 transition-colors sm:p-5",
        dragging
          ? "border-accent bg-orange-50"
          : sheet
            ? "border-stone-300 bg-surface"
            : "border-stone-300 bg-surface hover:border-stone-400",
        disabled ? "opacity-60" : "",
      ].join(" ")}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <span className="text-xs text-muted">{hint}</span>
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".xlsx"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files)}
      />

      {state === "loading" && (
        <div className="mt-4 flex flex-1 flex-col justify-center">
          <div className="t-skel-skeleton is-pulsing space-y-2" style={{ position: "static" }}>
            <div className="skeleton-bar h-4 w-2/3" />
            <div className="skeleton-bar h-3 w-1/3" />
          </div>
          <p className="mt-3 text-xs text-muted">Membaca file…</p>
        </div>
      )}

      {state === "empty" && (
        <div className="mt-3 flex flex-1 flex-col items-center justify-center text-center">
          <UploadIcon className="h-7 w-7 text-stone-400" />
          <p className="mt-2 text-sm text-muted">
            Tarik file ke sini, atau
          </p>
          <label
            htmlFor={inputId}
            className="mt-2 cursor-pointer rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-stone-50"
          >
            Pilih file
          </label>
          <p className="mt-2 text-xs text-muted">.xlsx · maks 5 MB · 5.000 baris</p>
        </div>
      )}

      {state === "loaded" && sheet && (
        <div className="mt-3 flex flex-1 flex-col justify-between">
          <div className="flex items-start gap-2.5">
            <span
              className="t-success-check mt-0.5 shrink-0 text-green-600"
              data-state="in"
              key={sheet.fileName + sheet.rows.length}
            >
              <CheckIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <FileIcon className="h-4 w-4 shrink-0 text-stone-400" />
                <span className="truncate" title={sheet.fileName}>
                  {sheet.fileName}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">
                <span className="font-semibold text-foreground">
                  {sheet.rows.length.toLocaleString("id-ID")}
                </span>{" "}
                baris data · {sheet.columns.length} kolom
              </p>
              <p className="mt-0.5 truncate text-xs text-muted" title={sheet.sheetName}>
                Sheet: {sheet.sheetName}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className="cursor-pointer rounded-lg border border-stone-300 bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-stone-50"
            >
              Ganti file
            </label>
            <button
              type="button"
              onClick={onClear}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-stone-100 hover:text-foreground"
            >
              Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
