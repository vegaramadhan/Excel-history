"use client";

import { useMemo, useState } from "react";
import type { CompareResult, DiffRecord } from "@/lib/types";
import { STATUS_META, STATUS_ORDER, type FilterKey } from "./status-styles";

const PAGE_SIZE = 25;

function StatusChip({ record }: { record: DiffRecord }) {
  const meta = STATUS_META[record.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${meta.chip}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

/** Nilai kosong ditandai eksplisit supaya tidak terbaca sebagai sel hilang. */
function Value({ text }: { text: string }) {
  if (text === "") return <span className="text-stone-400 italic">(kosong)</span>;
  return <span className="break-words">{text}</span>;
}

/** Ringkasan isi record untuk kategori Ditambahkan dan Dihapus. */
function RecordSummary({
  record,
  result,
}: {
  record: DiffRecord;
  result: CompareResult;
}) {
  const values = record.status === "removed" ? record.oldValues : record.newValues;
  if (!values) return null;

  const columns = result.columns.filter((column) => column !== result.idColumn);

  return (
    <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
      {columns.map((column) => (
        <div key={column} className="flex gap-1.5 text-xs">
          <dt className="shrink-0 text-muted">{column}:</dt>
          <dd className="min-w-0 font-medium">
            <Value text={values[column] ?? ""} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChangeList({ record }: { record: DiffRecord }) {
  return (
    <ul className="space-y-1.5">
      {record.changes.map((change) => (
        <li key={change.column} className="text-xs">
          <span className="font-medium text-foreground">{change.column}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-red-900 line-through decoration-red-400">
              <Value text={change.oldValue} />
            </span>
            <span className="text-stone-400" aria-hidden="true">
              →
            </span>
            <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-green-900">
              <Value text={change.newValue} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ResultTable({
  result,
  filter,
  onFilterChange,
}: {
  result: CompareResult;
  filter: FilterKey;
  onFilterChange: (filter: FilterKey) => void;
}) {
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () => (filter === "all" ? result.records : result.records.filter((r) => r.status === filter)),
    [result, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Kembali ke halaman pertama setiap kali filter atau hasil berganti.
  // Disesuaikan saat render (pola resmi React) agar tidak memicu render berantai.
  const [previous, setPrevious] = useState({ filter, result });
  if (previous.filter !== filter || previous.result !== result) {
    setPrevious({ filter, result });
    setPage(1);
  }

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  const counts: Record<FilterKey, number> = {
    all: result.records.length,
    added: result.summary.added,
    removed: result.summary.removed,
    changed: result.summary.changed,
    unchanged: result.summary.unchanged,
  };

  return (
    <section className="rounded-xl border border-line bg-surface" aria-labelledby="detail-judul">
      <div className="border-b border-line p-4 sm:p-5">
        <h2 id="detail-judul" className="text-base font-semibold">
          Detail perubahan
        </h2>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
          {(["all", ...STATUS_ORDER] as FilterKey[]).map((key) => {
            const isActive = filter === key;
            const label = key === "all" ? "Semua" : STATUS_META[key].label;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onFilterChange(key)}
                aria-pressed={isActive}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-accent bg-accent text-white"
                    : "border-stone-300 bg-surface text-muted hover:border-stone-400 hover:text-foreground",
                ].join(" ")}
              >
                {label}
                <span className={isActive ? "ml-1.5 text-orange-100" : "ml-1.5 text-stone-400"}>
                  {counts[key].toLocaleString("id-ID")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted">
          Tidak ada record pada kategori ini.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">
                Detail perubahan per record, dikelompokkan menurut kolom ID {result.idColumn}
              </caption>
              <thead>
                <tr className="border-b border-line bg-stone-50 text-left">
                  <th scope="col" className="px-4 py-2.5 font-medium text-muted">
                    {result.idColumn}
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-muted">
                    Kategori
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium text-muted">
                    Rincian
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => (
                  <tr key={`${record.status}-${record.id}`} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-medium break-all">{record.id}</td>
                    <td className="px-4 py-3">
                      <StatusChip record={record} />
                    </td>
                    <td className="px-4 py-3">
                      {record.status === "changed" && <ChangeList record={record} />}
                      {(record.status === "added" || record.status === "removed") && (
                        <RecordSummary record={record} result={result} />
                      )}
                      {record.status === "unchanged" && (
                        <span className="text-xs text-muted">
                          Tidak ada perbedaan pada kolom yang dibandingkan.
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-line p-4 sm:flex-row">
            <p className="text-xs text-muted">
              Menampilkan {(start + 1).toLocaleString("id-ID")}–
              {Math.min(start + PAGE_SIZE, filtered.length).toLocaleString("id-ID")} dari{" "}
              {filtered.length.toLocaleString("id-ID")} record
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="text-xs text-muted">
                Hal. {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
