import { barrasQuartis, COR_FAIXA, descricaoFatias, faixaGasto, fraseConcentracao, type QuartisGasto } from "@/lib/dinheiro";
import { brlCentavos, inteiro, pct } from "@/lib/format";

/**
 * Os candidatos em quatro grupos de gasto (quartis, de src/lib/dinheiro.ts): a frase do quarto de cima, três barras 100%
 * alinhadas (candidatos, eleitos e dinheiro, nas mesmas cores, do azul ao amarelo) e a tabela de cada grupo (faixa de
 * gasto, eleitos e custo por voto), que também serve de legenda e de equivalente em texto. Componente de servidor sem JS.
 */
export function QuartisDoGasto({ q }: { q: QuartisGasto }) {
  const barras = barrasQuartis(q);
  const frase = fraseConcentracao(q);
  const ultimo = q.grupos.filter((g) => g.faixa >= 1).at(-1)?.faixa;
  return (
    <div className="quartis">
      {frase && (
        <p className="quartis-frase">
          Os <b>25% que mais gastaram</b> ficaram com <em>{pct(frase.dinheiro, 0)}</em> do dinheiro e <em>{pct(frase.eleitos, 0)}</em> dos eleitos.
        </p>
      )}
      <div className="quartis-barras">
        {barras.map((b) => (
          <div key={b.titulo} className="quartis-linha empilhada">
            <span className="quartis-rot">{b.titulo}<small>{b.total}</small></span>
            <div className="emp-barra" role="img" aria-label={descricaoFatias(b.titulo, b.fatias)}>
              {b.fatias.map((f) => (
                <span key={f.chave} className={`emp-seg ${f.cor}`} style={{ flexGrow: f.valor }} title={`${f.rotulo}: ${pct(f.parte, 0)}`}>
                  {f.parte >= 0.1 && <em>{pct(f.parte, 0)}</em>}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <table className="quartis-tabela">
        <thead><tr><th>Grupo</th><th>Gastou</th><th className="num">Eleitos</th><th className="num">Cada voto</th></tr></thead>
        <tbody>
          {q.grupos.map((g) => (
            <tr key={g.faixa}>
              <td><i className={`empilhada-cor ${COR_FAIXA[g.faixa]}`} aria-hidden="true" />{g.rotulo}</td>
              <td>{g.faixa >= 1 ? faixaGasto(g, g.faixa === ultimo) : g.faixa === 0 ? "R$ 0" : "não se sabe"}</td>
              <td className="num">{inteiro(g.eleitos)} de {inteiro(g.candidatos)} <small>{pct(g.taxa, 0)}</small></td>
              <td className="num">{g.faixa >= 1 && g.porVoto !== null ? brlCentavos(g.porVoto) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
