import type { ChangeStatus } from "@/lib/types";

export type FilterKey = ChangeStatus | "all";

/**
 * Warna dipakai sebagai penguat, bukan satu-satunya penanda: setiap kategori
 * selalu tampil bersama labelnya.
 */
export const STATUS_META: Record<
  ChangeStatus,
  { label: string; chip: string; card: string; dot: string; accentText: string }
> = {
  added: {
    label: "Ditambahkan",
    chip: "bg-green-50 text-green-800 border-green-200",
    card: "border-green-200 bg-green-50",
    dot: "bg-green-600",
    accentText: "text-green-800",
  },
  removed: {
    label: "Dihapus",
    chip: "bg-red-50 text-red-800 border-red-200",
    card: "border-red-200 bg-red-50",
    dot: "bg-red-600",
    accentText: "text-red-800",
  },
  changed: {
    label: "Berubah",
    chip: "bg-amber-50 text-amber-900 border-amber-200",
    card: "border-amber-200 bg-amber-50",
    dot: "bg-amber-500",
    accentText: "text-amber-900",
  },
  unchanged: {
    label: "Tetap",
    chip: "bg-stone-100 text-stone-700 border-stone-200",
    card: "border-stone-200 bg-stone-50",
    dot: "bg-stone-400",
    accentText: "text-stone-700",
  },
};

export const STATUS_ORDER: ChangeStatus[] = ["added", "removed", "changed", "unchanged"];
