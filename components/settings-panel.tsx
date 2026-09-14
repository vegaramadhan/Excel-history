"use client";

import { useId } from "react";
import { CheckIcon } from "./icons";

interface SettingsPanelProps {
  columns: string[];
  idColumn: string;
  ignoredColumns: string[];
  disabled: boolean;
  busy: boolean;
  onIdColumnChange: (column: string) => void;
  onToggleIgnored: (column: string) => void;
  onCompare: () => void;
}

/** Checkbox memakai resep "checkbox-check" dari transitions.dev. */
function IgnoreCheckbox({
  column,
  checked,
  disabled,
  onToggle,
}: {
  column: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "t-check flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
        checked
          ? "border-accent/40 bg-orange-50 text-foreground"
          : "border-stone-300 bg-surface text-muted hover:border-stone-400 hover:text-foreground",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
          checked ? "border-accent bg-accent text-white" : "border-stone-400 bg-white text-transparent",
        ].join(" ")}
        aria-hidden="true"
      >
        <CheckIcon className="h-3 w-3" />
      </span>
      <span className="truncate">{column}</span>
    </button>
  );
}

export function SettingsPanel({
  columns,
  idColumn,
  ignoredColumns,
  disabled,
  busy,
  onIdColumnChange,
  onToggleIgnored,
  onCompare,
}: SettingsPanelProps) {
  const selectId = useId();
  const ignorable = columns.filter((column) => column !== idColumn);

  return (
    <section
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
      aria-labelledby="pengaturan-judul"
    >
      <h2 id="pengaturan-judul" className="text-base font-semibold">
        Pengaturan
      </h2>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          <label htmlFor={selectId} className="block text-sm font-medium">
            Kolom ID
          </label>
          <select
            id={selectId}
            value={idColumn}
            disabled={disabled}
            onChange={(event) => onIdColumnChange(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-stone-300 bg-surface px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-muted"
          >
            {columns.length === 0 && <option value="">Muat kedua file dulu</option>}
            {columns.map((column) => (
              <option key={column} value={column}>
                {column}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Pilih kolom dengan nilai unik, misalnya Dealer ID, Kode Produk, atau Nomor Invoice.
          </p>
        </div>

        <div>
          <p className="text-sm font-medium">Kolom yang diabaikan</p>
          <p className="mt-1 text-xs text-muted">
            Kolom yang dicentang tidak memengaruhi hasil perbandingan.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {ignorable.length === 0 && (
              <p className="text-sm text-muted">Belum ada kolom yang bisa diabaikan.</p>
            )}
            {ignorable.map((column) => (
              <IgnoreCheckbox
                key={column}
                column={column}
                checked={ignoredColumns.includes(column)}
                disabled={disabled}
                onToggle={() => onToggleIgnored(column)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <button
          type="button"
          onClick={onCompare}
          disabled={disabled || busy}
          className="w-full rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-stone-300 sm:w-auto"
        >
          {busy ? "Membandingkan…" : "Bandingkan"}
        </button>
        {disabled && !busy && (
          <p className="mt-2 text-xs text-muted">
            Tombol aktif setelah kedua file berhasil dibaca.
          </p>
        )}
      </div>
    </section>
  );
}
