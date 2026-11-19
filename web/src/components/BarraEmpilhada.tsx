import { descricaoFatias, type Fatia } from "@/lib/dinheiro";
import { pct } from "@/lib/format";

/**
 * Uma barra 100% dividida em fatias (montadas por `fatias`, src/lib/dinheiro.ts), com o título e o total em cima e a
 * legenda embaixo: cor, nome, parte e valor de cada fatia (a leitura não depende só da cor). `semLegenda`: sem a legenda
 * (quando várias barras dividem uma legenda só); o aria-label da barra continua com tudo. Componente de servidor sem JS.
 */
export function BarraEmpilhada({ titulo, total, fatias, valor, semLegenda = false }: { titulo: string; total: string; fatias: Fatia[]; valor: (v: number) => string; semLegenda?: boolean }) {
  return (
    <figure className="empilhada">
      <figcaption><span>{titulo}</span><b>{total}</b></figcaption>
      <div className="emp-barra" role="img" aria-label={descricaoFatias(titulo, fatias)}>
        {fatias.map((f) => (
          <span key={f.chave} className={`emp-seg ${f.cor}`} style={{ flexGrow: f.valor }} title={`${f.rotulo}: ${pct(f.parte, 0)} (${valor(f.valor)})`}>
            {f.parte >= 0.12 && <em>{pct(f.parte, 0)}</em>}
          </span>
        ))}
      </div>
      {!semLegenda && <ul className="emp-legenda" aria-hidden="true">
        {fatias.map((f) => (
          <li key={f.chave}><i className={f.cor} /><span>{f.rotulo}</span><b>{pct(f.parte, 0)}</b><small>{valor(f.valor)}</small></li>
        ))}
      </ul>}
    </figure>
  );
}
