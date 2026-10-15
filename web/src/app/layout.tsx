import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Anatomia do Voto", template: "%s · Anatomia do Voto" },
  description: "Dados eleitorais do TSE (1998–2024) para AP, ES, MG, PE, RJ e RR: carreira, gastos de campanha e votos de legenda.",
};

/** Aplica o tema salvo antes da primeira pintura (evita piscar o tema errado). Mesma chave do ThemeToggle. */
const scriptTema = `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
        <header className="site-header">
          <div className="inner">
            <Link href="/" className="brand">Anatomia <span>do Voto</span></Link>
            <nav className="nav" aria-label="Principal">
              <Link href="/candidatos">Candidatos</Link>
              <Link href="/analises">Análises</Link>
              <Link href="/sobre">Sobre os dados</Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
