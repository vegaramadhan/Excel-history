/** Semua nilai sel disimpan sebagai string agar kode berawalan nol tetap utuh. */
export type RowValues = Record<string, string>;

export interface ParsedRow {
  /** Nomor baris asli di Excel (1-based), dipakai untuk pesan error. */
  rowNumber: number;
  values: RowValues;
}

export interface ParsedSheet {
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: ParsedRow[];
}

export type ChangeStatus = "added" | "removed" | "changed" | "unchanged";

export interface ChangedField {
  column: string;
  oldValue: string;
  newValue: string;
}

export interface DiffRecord {
  id: string;
  status: ChangeStatus;
  /** Isi record di file lama (untuk removed/changed/unchanged). */
  oldValues?: RowValues;
  /** Isi record di file baru (untuk added/changed/unchanged). */
  newValues?: RowValues;
  /** Hanya terisi untuk status "changed". */
  changes: ChangedField[];
}

export interface CompareSummary {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
}

export interface CompareResult {
  idColumn: string;
  ignoredColumns: string[];
  /** Kolom yang benar-benar dibandingkan (tanpa kolom ID dan kolom diabaikan). */
  comparedColumns: string[];
  columns: string[];
  oldSheetName: string;
  newSheetName: string;
  oldFileName: string;
  newFileName: string;
  summary: CompareSummary;
  records: DiffRecord[];
}
