import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Anatomia do Voto", template: "%s · Anatomia do Voto" },
  description: "Dados eleitorais do TSE (1998–2024) para AP, ES, MG, PE, RJ e RR: carreira, gastos de campanha e votos de legenda.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">Anatomia <span>do Voto</span></Link>
            <nav className="nav" aria-label="Principal">
              <Link href="/candidatos">Candidatos</Link>
              <Link href="/analises">Análises</Link>
              <Link href="/sobre">Sobre os dados</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
