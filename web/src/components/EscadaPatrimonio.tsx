import { valorTipico, type Degrau } from "@/lib/patrimonio";

const pctCurto = (t: number | null) => (t === null ? "—" : t > 0 && t < 0.005 ? "<1%" : `${Math.round(t * 100)}%`);

/**
 * A escada da pergunta 2: uma barra vertical por grupo (sem bens, à parte, e os décimos ou as posições, do menos rico ao
 * mais rico), com a taxa de eleição em cima e o patrimônio típico embaixo. `mini`: só as barras, para o cartão do mapa.
 * HTML e CSS (o texto não encolhe no celular, como num SVG); a leitura por extenso fica no aria-label. Sem JS.
 */
export function EscadaPatrimonio({ degraus, titulo, mini = false }: { degraus: Degrau[]; titulo: string; mini?: boolean }) {
  if (!degraus.length) return null;
  const max = Math.max(0.01, ...degraus.map((d) => d.taxa ?? 0));
  const texto = `${titulo}: ${degraus.map((d) => `${d.rotulo}, ${pctCurto(d.taxa)} se elegeram (${d.eleitos.toLocaleString("pt-BR")} de ${d.candidatos.toLocaleString("pt-BR")})${d.chave === 0 ? "" : `, típico ${valorTipico(d.tipico)}`}`).join("; ")}.`;
  return (
    <figure className={`escada-p2${mini ? " mini" : ""}`}>
      <div className="escada-barras" role="img" aria-label={texto}>
        {degraus.map((d) => (
          <div key={d.chave} className={`degrau${d.chave === 0 ? " sem-bens" : ""}`} aria-hidden="true"
            title={`${d.rotulo}: ${pctCurto(d.taxa)} se elegeram (${d.eleitos.toLocaleString("pt-BR")} de ${d.candidatos.toLocaleString("pt-BR")})${d.chave === 0 ? "" : ` · típico ${valorTipico(d.tipico)}`}`}>
            {!mini && <b className="degrau-pct">{pctCurto(d.taxa)}</b>}
            <span className="degrau-trilho"><i style={{ height: `${Math.max(1.5, ((d.taxa ?? 0) / max) * 100)}%` }} /></span>
            {!mini && <span className="degrau-rot">{d.curto}</span>}
            {!mini && <small className="degrau-valor">{d.chave === 0 ? "R$ 0" : valorTipico(d.tipico).replace("R$ ", "")}</small>}
          </div>
        ))}
      </div>
      {!mini && <figcaption className="escada-eixo" aria-hidden="true"><span>menos rico</span><span>mais rico</span></figcaption>}
    </figure>
  );
}
