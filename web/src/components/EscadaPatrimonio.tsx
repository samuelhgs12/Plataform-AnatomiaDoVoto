import { curto } from "@/lib/format";
import { valorTipico, type Degrau } from "@/lib/patrimonio";

const pctCurto = (t: number | null) => (t === null ? "—" : t > 0 && t < 0.005 ? "<1%" : `${Math.round(t * 100)}%`);

/**
 * A escada da pergunta 2: uma barra vertical por grupo (sem bens, à parte, e os décimos ou as posições, do menos rico ao
 * mais rico), com a taxa de eleição em cima e o patrimônio típico embaixo. `votos`: uma disputa só (prefeito numa
 * cidade), uma barra por candidato com a parte dos votos e o eleito em destaque. `mini`: só as barras, para o cartão do
 * mapa. HTML e CSS (o texto não encolhe no celular, como num SVG); a leitura por extenso fica no aria-label. Sem JS.
 */
export function EscadaPatrimonio({ degraus, titulo, mini = false, votos = false }: { degraus: Degrau[]; titulo: string; mini?: boolean; votos?: boolean }) {
  if (!degraus.length) return null;
  const max = Math.max(0.01, ...degraus.map((d) => d.taxa ?? 0));
  const semBens = (d: Degrau) => (votos ? (d.tipico ?? 0) <= 0 : d.chave === 0);
  const ler = (d: Degrau) => votos
    ? `${d.rotulo}${d.eleitos ? " (eleito)" : ""}: ${pctCurto(d.taxa)} dos votos, ${semBens(d) ? "sem bens declarados" : valorTipico(d.tipico)}`
    : `${d.rotulo}: ${pctCurto(d.taxa)} se elegeram (${d.eleitos.toLocaleString("pt-BR")} de ${d.candidatos.toLocaleString("pt-BR")})${d.chave === 0 ? "" : `, típico ${valorTipico(d.tipico)}`}`;
  return (
    <figure className={`escada-p2${mini ? " mini" : ""}${votos ? " votos" : ""}`}>
      <div className="escada-barras" role="img" aria-label={`${titulo}: ${degraus.map(ler).join("; ")}.`}>
        {degraus.map((d) => (
          <div key={d.chave} className={`degrau${semBens(d) ? " sem-bens" : ""}${votos && d.eleitos ? " eleito" : ""}`} aria-hidden="true" title={ler(d)}>
            {!mini && <b className="degrau-pct">{pctCurto(d.taxa)}</b>}
            <span className="degrau-trilho"><i style={{ height: `${Math.max(1.5, ((d.taxa ?? 0) / max) * 100)}%` }} /></span>
            {!mini && <span className="degrau-rot">{votos && d.eleitos ? `✓ ${d.curto}` : d.curto}</span>}
            {!mini && <small className="degrau-valor">{semBens(d) ? (votos ? "s/ bens" : "R$ 0") : curto(d.tipico ?? 0)}</small>}
          </div>
        ))}
      </div>
      {!mini && <figcaption className="escada-eixo" aria-hidden="true"><span>menos rico</span><span>mais rico</span></figcaption>}
    </figure>
  );
}
