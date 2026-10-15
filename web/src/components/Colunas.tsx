import Link from "next/link";
import { pct } from "@/lib/format";

export interface Coluna {
  chave: string; rotulo: string;
  /** Linhas pequenas abaixo do rótulo (ex.: "eleição geral", "R$ 2 bilhões"). */
  linhas?: string[];
  /** Altura, de 0 a 1 (fração). null = coluna vazia com `vazia` escrito. */
  parte: number | null;
  vazia?: string;
  classe?: string;
  href?: string;
  atual?: boolean;
  dica?: string;
}

/**
 * Colunas verticais com o percentual escrito em cima de cada uma e uma régua ao lado.
 * `max` é o topo da régua (padrão 100%); com valores pequenos, um topo menor deixa as diferenças visíveis,
 * e a régua mostra a escala usada. Cada coluna pode ser um link.
 */
export function Colunas({ colunas, max = 1, titulo, casas }: { colunas: Coluna[]; max?: number; titulo: string; casas?: (p: number) => number }) {
  const marcas = [1, 0.75, 0.5, 0.25, 0].map((m) => m * max);
  return (
    <div className="colunas" role="list" aria-label={titulo}>
      <div className="colunas-grade" aria-hidden="true">
        {marcas.map((g) => <div key={g} style={{ bottom: `${(g / max) * 100}%` }}><span>{pct(g, 0)}</span></div>)}
      </div>
      {colunas.map((c) => {
        const corpo = (
          <>
            <div className="coluna-area">
              {c.parte === null ? (
                <span className="coluna-vazia">{c.vazia ?? "sem dados"}</span>
              ) : (
                <>
                  <span className="coluna-valor">{pct(c.parte, casas ? casas(c.parte) : 0)}</span>
                  <div className={`coluna-barra ${c.classe ?? ""}`} style={{ height: `calc(var(--plot) * ${Math.min(c.parte / max, 1).toFixed(4)})` }} />
                </>
              )}
            </div>
            <span className="coluna-ano">{c.rotulo}</span>
            {c.linhas?.map((l) => <small key={l}>{l}</small>)}
          </>
        );
        const props = { role: "listitem", className: `coluna${c.atual ? " atual" : ""}`, title: c.dica };
        return c.href
          ? <Link key={c.chave} href={c.href} {...props} aria-current={c.atual ? "true" : undefined}>{corpo}</Link>
          : <div key={c.chave} {...props}>{corpo}</div>;
      })}
    </div>
  );
}
