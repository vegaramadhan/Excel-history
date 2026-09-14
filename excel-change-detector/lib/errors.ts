/**
 * Error yang bisa ditampilkan langsung ke pengguna.
 * `details` berisi baris penjelas, misalnya daftar kolom atau nomor baris
 * yang perlu diperbaiki.
 */
export class AppError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "AppError";
    this.details = details;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(error.message);
  return new AppError("Terjadi kesalahan yang tidak diketahui.");
}
