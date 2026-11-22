import type { Metadata } from "next";
import { Poppins } from "next/font/google";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Kobi",
  description:
    "Aplikasi berbasis AI yang membantu mahasiswa melacak kebutuhan gizi dan menemukan makanan terjangkau dari warung, kaki lima, dan pasar terdekat.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={`${poppins.variable} h-full antialiased`}>
      <body className="bg-bone">
        <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col shadow-xl">
          {children}
        </div>
      </body>
    </html>
  );
}
