import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ArenaFlow | Gestão para arenas esportivas",
  description:
    "Sistema de reservas, agenda, clientes, financeiro e mensalistas para arenas esportivas.",
  keywords: [
    "ArenaFlow",
    "gestão de arenas",
    "sistema de reservas",
    "agenda online",
    "quadras esportivas",
    "mensalistas",
  ],
  authors: [{ name: "ArenaFlow" }],
  creator: "ArenaFlow",
  publisher: "ArenaFlow",
  openGraph: {
    title: "ArenaFlow | Gestão para arenas esportivas",
    description:
      "Sistema de reservas, agenda, clientes, financeiro e mensalistas para arenas esportivas.",
    type: "website",
    locale: "pt_BR",
    siteName: "ArenaFlow",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArenaFlow | Gestão para arenas esportivas",
    description:
      "Sistema de reservas, agenda, clientes, financeiro e mensalistas para arenas esportivas.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
