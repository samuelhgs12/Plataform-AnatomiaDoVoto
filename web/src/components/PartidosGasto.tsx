import type { Partido } from "@/lib/dinheiro";
import { brlCentavos, inteiro, pct, reais } from "@/lib/format";

/**
 * Quanto cada partido gastou (lista de src/lib/dinheiro.ts, do que mais gastou): uma tabela com a barra do gasto na
 * escala do maior e a parte do total, quanto custou cada voto e quantos se elegeram. Os `inicio` primeiros ficam à vista;
 * o resto, em "Todos os partidos". É uma tabela: a leitura não depende da barra nem da cor. Componente de servidor sem JS.
 */
export function PartidosGasto({ partidos, titulo, inicio = 10 }: { partidos: Partido[]; titulo: string; inicio?: number }) {
  const teto = partidos[0]?.gasto ?? 0;
  const linha = (p: Partido) => (
    <tr key={p.partido}>
      <th scope="row">{p.partido}</th>
      <td className="pt-gasto">
        <div>
          <span className="pt-trilho" aria-hidden="true"><i style={{ width: `${teto > 0 ? (p.gasto / teto) * 100 : 0}%` }} /></span>
          <b>{reais(p.gasto)}</b><small>{pct(p.parte, 0)}</small>
        </div>
      </td>
      <td className="num">{p.porVoto === null ? "—" : brlCentavos(p.porVoto)}</td>
      <td className="num">{inteiro(p.eleitos)}<small className="pt-de"> de {inteiro(p.candidatos)}</small></td>
    </tr>
  );
  const cabeca = <thead><tr><th>Partido</th><th>Gastou<span className="pt-de"> (parte do total)</span></th><th className="num">Cada voto</th><th className="num">Eleitos</th></tr></thead>;
  return (
    <>
      <div className="tabela-rolar">
        <table className="partidos-tabela" aria-label={titulo}>
          {cabeca}
          <tbody>{partidos.slice(0, inicio).map(linha)}</tbody>
        </table>
      </div>
      {partidos.length > inicio && (
        <details className="ver-todos">
          <summary>Todos os {partidos.length} partidos</summary>
          <div className="tabela-rolar">
            <table className="partidos-tabela" aria-label={`${titulo} (os demais)`}>
              {cabeca}
              <tbody>{partidos.slice(inicio).map(linha)}</tbody>
            </table>
          </div>
        </details>
      )}
    </>
  );
}
