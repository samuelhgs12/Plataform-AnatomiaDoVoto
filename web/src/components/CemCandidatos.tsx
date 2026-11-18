import type { Cada100 } from "@/lib/dinheiro";
import { inteiro } from "@/lib/format";

/**
 * "De cada 100": 100 quadradinhos (10 × 10), um por pessoa, pintados pelo grupo de dinheiro (deCada100 em
 * src/lib/dinheiro.ts, que já soma 100), com o número grande do grupo que dependeu do dinheiro público e a legenda com
 * os números escritos (a leitura não depende da cor). Componente de servidor sem JS.
 */
export function CemCandidatos({ grupos, titulo, quem, total }: { grupos: Cada100[]; titulo: string; quem: string; total: number }) {
  const celulas = grupos.flatMap((g) => Array.from({ length: g.de100 }, () => g.cor));
  const dep = grupos.find((g) => g.chave === "maioria")?.de100 ?? 0;
  const descricao = `${titulo}: ${grupos.map((g) => `${g.de100} de 100 ${g.curto.toLowerCase()}`).join(", ")}.`;
  return (
    <figure className="cem">
      <figcaption><b>{dep}</b><span>de cada 100 {quem} dependeram do dinheiro público</span></figcaption>
      <div className="cem-grade" role="img" aria-label={descricao}>
        {celulas.map((cor, i) => <i key={i} className={cor} />)}
      </div>
      <ul className="cem-legenda">
        {grupos.map((g) => (
          <li key={g.chave} title={`${g.rotulo}: ${inteiro(g.n)} de ${inteiro(total)}`}>
            <i className={g.cor} aria-hidden="true" /><b>{g.de100}</b> {g.curto}
          </li>
        ))}
      </ul>
    </figure>
  );
}
