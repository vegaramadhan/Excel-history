"use client";

import { useEffect, useRef } from "react";
import type { CompareSummary } from "@/lib/types";
import { STATUS_META, STATUS_ORDER, type FilterKey } from "./status-styles";

/**
 * Angka memakai resep "number-pop-in" dari transitions.dev: tiap digit masuk
 * sendiri-sendiri, dua digit terakhir diberi stagger.
 */
function PopInNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = value.toLocaleString("id-ID");

  useEffect(() => {
    const group = ref.current;
    if (!group) return;
    group.classList.remove("is-animating");
    // Paksa reflow supaya animasi bisa diputar ulang saat angka berubah.
    void group.offsetHeight;
    group.classList.add("is-animating");
  }, [text]);

  const chars = text.split("");

  return (
    <span ref={ref} className="t-digit-group is-animating" aria-label={text}>
      {chars.map((char, index) => {
        const fromEnd = chars.length - index;
        const stagger = fromEnd === 2 ? "1" : fromEnd === 1 ? "2" : undefined;
        return (
          <span key={`${index}-${char}`} className="t-digit" data-stagger={stagger} aria-hidden="true">
            {char}
          </span>
        );
      })}
    </span>
  );
}

interface SummaryCardsProps {
  summary: CompareSummary;
  active: FilterKey;
  onSelect: (filter: FilterKey) => void;
}

export function SummaryCards({ summary, active, onSelect }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const isActive = active === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onSelect(isActive ? "all" : status)}
            aria-pressed={isActive}
            className={[
              "rounded-xl border p-3 text-left transition-shadow sm:p-4",
              meta.card,
              isActive ? "ring-2 ring-accent ring-offset-1 ring-offset-background" : "hover:shadow-sm",
            ].join(" ")}
          >
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
              <span className="text-xs font-medium text-muted sm:text-sm">{meta.label}</span>
            </span>
            <span className={`mt-1.5 block text-2xl font-semibold sm:text-3xl ${meta.accentText}`}>
              <PopInNumber value={summary[status]} />
            </span>
            <span className="mt-0.5 block text-[11px] text-muted">record</span>
          </button>
        );
      })}
    </div>
  );
}
