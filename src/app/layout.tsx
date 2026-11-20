import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Painel LOVE FIT",
  description: "Bot de WhatsApp da LOVE FIT",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
