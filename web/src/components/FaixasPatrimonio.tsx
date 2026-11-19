import { FAIXAS_LOG, posicaoLog, valorTipico, type Histograma, type Medianas } from "@/lib/patrimonio";

const pctCurto = (t: number) => (t > 0 && t < 0.005 ? "<1%" : `${Math.round(t * 100)}%`);
/** As divisas entre as faixas 1 a 6, no eixo de 10 em 10 (posicaoLog): R$ 1 mil, 10 mil, 100 mil, 1 milhão, 10 milhões. */
const DIVISAS = [{ v: 1e3, t: "1 mil" }, { v: 1e4, t: "10 mil" }, { v: 1e5, t: "100 mil" }, { v: 1e6, t: "1 mi" }, { v: 1e7, t: "10 mi" }];

/**
 * Eleitos e não eleitos: quanto declararam. Uma faixa por grupo com o histograma em escala de 10 em 10 (cada coluna é
 * uma faixa de R$ 1 mil a 10 mil, de 10 mil a 100 mil...), os sem bens numa coluna à parte e a mediana marcada com o
 * valor escrito. A altura é a parte do grupo em cada faixa. Componente de servidor, sem JS.
 */
export function FaixasPatrimonio({ h, m, titulo }: { h: Histograma; m: Medianas | null; titulo: string }) {
  const linhas = [
    { rotulo: "Eleitos", partes: h.eleitos, n: h.nEleitos, mediana: m?.medianaEleitos ?? null, classe: "fx-eleitos" },
    { rotulo: "Não eleitos", partes: h.nao, n: h.nNao, mediana: m?.medianaNao ?? null, classe: "fx-nao" },
  ].filter((l) => l.n > 0);
  // a escala é a das faixas com bens: os sem bens (às vezes mais da metade) encostam no teto e têm o número escrito
  const max = Math.max(0.01, ...linhas.flatMap((l) => l.partes.slice(1)));
  const texto = `${titulo}. ${linhas.map((l) => `${l.rotulo} (${l.n.toLocaleString("pt-BR")}): ${FAIXAS_LOG.map((f, i) => `${f.rotulo} ${pctCurto(l.partes[i])}`).join(", ")}; típico de quem declarou: ${valorTipico(l.mediana)}`).join(". ")}.`;
  return (
    <figure className="faixas-p2">
      <div role="img" aria-label={texto}>
        {linhas.map((l) => (
          <div key={l.rotulo} className={`fx-linha ${l.classe}`} aria-hidden="true">
            <span className="fx-rot"><b>{l.rotulo}</b><small>{l.n.toLocaleString("pt-BR")}</small></span>
            <span className="fx-sem" title={`Sem bens: ${pctCurto(l.partes[0])}`}><i style={{ height: `${Math.min(1, l.partes[0] / max) * 100}%` }} /><small>{pctCurto(l.partes[0])}</small></span>
            <span className="fx-bins">
              {FAIXAS_LOG.slice(1).map((f, i) => (
                <span key={f.faixa} className="fx-bin" title={`${f.rotulo}: ${pctCurto(l.partes[i + 1])}`}><i style={{ height: `${(l.partes[i + 1] / max) * 100}%` }} /></span>
              ))}
              {l.mediana !== null && l.mediana > 0 && (
                <em className="fx-mediana" style={{ left: `${posicaoLog(l.mediana) * 100}%` }}><span>{valorTipico(l.mediana)}</span></em>
              )}
            </span>
          </div>
        ))}
        <div className="fx-linha fx-eixo" aria-hidden="true">
          <span />
          <span className="fx-sem-rot">sem bens</span>
          <span className="fx-bins">{DIVISAS.map((d) => <small key={d.v} style={{ left: `${posicaoLog(d.v) * 100}%` }}>{d.t}</small>)}</span>
        </div>
      </div>
      <figcaption className="fx-legenda">eixo em reais, de 10 em 10</figcaption>
    </figure>
  );
}
