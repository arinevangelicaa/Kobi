import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kobi",
  description:
    "Aplikasi berbasis AI yang membantu mahasiswa melacak kebutuhan gizi dan menemukan makanan terjangkau dari warung, kaki lima, dan pasar terdekat.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
