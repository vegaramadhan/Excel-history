import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel Change Detector",
  description:
    "Bandingkan dua file Excel dan temukan data yang ditambahkan, dihapus, berubah, atau tetap sama. Diproses sepenuhnya di browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
