import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
// Montserrat é a fonte do wordmark da marca — servida localmente para o
// build não depender do Google Fonts.
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pe5 Cockpit",
  description: "Comercial, entregas e prioridades de Pedro Santos em uma tela.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
