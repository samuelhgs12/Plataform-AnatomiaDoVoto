import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Navegacao } from "@/components/Navegacao";
import { Movimento } from "@/components/Movimento";
import { FOTOS } from "@/lib/fotos";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Anatomia do Voto", template: "%s · Anatomia do Voto" },
  description: "Dados eleitorais do TSE (1998–2024) para AP, ES, MG, PE, RJ e RR: carreira, gastos de campanha e votos de legenda.",
};

// General Sans (Indian Type Foundry, licença ITF Free Font), servida pelo próprio site: a build não depende de rede.
const fonte = localFont({
  src: [
    { path: "./fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--fonte",
  display: "swap",
});

/**
 * Antes da primeira pintura: aplica o tema salvo (mesma chave do ThemeToggle) e marca html.js, que libera as animações
 * de entrada no CSS. Sem JavaScript, nada fica escondido.
 */
const scriptInicial = `document.documentElement.classList.add("js");try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// O nome no rodapé, uma letra por tecla (16 colunas; null = espaço entre palavras)
const TECLAS = [..."ANATOMIA", null, ..."DO", null, ..."VOTO"];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fonte.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptInicial }} />
      </head>
      <body>
        <header className="site-header">
          <nav className="inner" aria-label="Principal">
            <Link href="/" className="brand">Anatomia&nbsp;<span>do Voto</span></Link>
            <Navegacao />
            <ThemeToggle />
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="rodape">
          <div className="inner">
            <div className="teclado" aria-hidden="true">
              {TECLAS.map((t, i) => <span key={i} className={`tecla${t ? "" : " vazia"}`}>{t}</span>)}
            </div>
            <nav className="teclas-acao" aria-label="Rodapé">
              <Link href="/sobre" className="k-branco">Sobre os dados</Link>
              <Link href="/analises" className="k-corrige">Análises</Link>
              <Link href="/candidatos" className="k-confirma">Buscar um candidato</Link>
            </nav>
            <p className="creditos">
              Anatomia do Voto: projeto acadêmico da disciplina de Banco de Dados (UFPI) com dados abertos do TSE. Malha dos estados: IBGE.
              Fotos via Wikimedia Commons:{" "}
              {Object.values(FOTOS).map((f, i, todas) => (
                <span key={f.src}>
                  <a href={f.pagina}>“{f.titulo}”</a>, {f.autor}, <a href={f.urlLicenca}>{f.licenca}</a>{i < todas.length - 1 ? "; " : "."}
                </span>
              ))}
            </p>
          </div>
        </footer>
        <Movimento />
      </body>
    </html>
  );
}
