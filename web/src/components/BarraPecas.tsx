import { reais } from "@/lib/format";
import { descricaoBarra, grupo, parteTexto, type BarraPecas as Barra } from "@/lib/propaganda";

const r$ = (centavos: number) => reais(centavos / 100);
/** pp-cabe-<px> some quando a barra é mais estreita que isso (container query): o texto nunca aparece cortado. */
const cabe = (px: number) => (px > 0 ? `pp-cabe-${px}` : "");

/**
 * Gráfico da pergunta 9: uma linha por tipo (montadas por `barraPecas`, src/lib/propaganda.ts), com o nome do tipo, a barra
 * e o percentual desta campanha com a típica embaixo. Cada barra vai de 0 a 100% da propaganda: os segmentos são as peças
 * do tipo, o resto fica na trilha; o traço branco é a típica daquele tipo. Os rótulos das peças ficam embaixo, nas mesmas
 * colunas dos segmentos, só quando cabem. Embaixo das linhas, a `legenda` do traço (null = nenhuma linha tem típica).
 * Componente de servidor sem JS.
 */
export function BarraPecas({ barra, legenda }: { barra: Barra; legenda: string | null }) {
  return (
    <figure className="barra-pp">
      <div role="img" aria-label={descricaoBarra(barra)}>
        {barra.tipos.map((t) => {
          const resto = barra.totalCentavos - t.centavos;
          const colunas = { gridTemplateColumns: [...t.segmentos.map((s) => s.centavos), ...(resto > 0 ? [resto] : [])].map((c) => `minmax(0, ${c}fr)`).join(" ") };
          const classe = grupo(t.grupo).classe;
          return (
            <div key={t.grupo} className="pp-tipo" aria-hidden="true">
              <p className="pp-tipo-nome"><i className={classe} />{t.rotulo}</p>
              <div className="pp-tipo-barra">
                <div className="pp-trilha">
                  <div className="pp-faixa pp-barra" style={colunas}>
                    {t.segmentos.map((s) => (
                      <div key={s.chave} className={`pp-seg ${s.generico ? "pp-outra" : classe}`}
                        title={`${s.outras ? `outras (${s.membros.map((m) => m.rotulo).join(", ")})` : s.rotulo}: ${r$(s.centavos)} (${parteTexto(s.parte)})`} />
                    ))}
                    {resto > 0 && <div className="pp-resto" />}
                  </div>
                  {t.tipica !== null && <i className="pp-tipica" style={{ left: `${t.tipica * 100}%` }} title={`Típica: ${t.pctTipica}`} />}
                </div>
                <div className="pp-faixa pp-rotulos" style={colunas}>
                  {t.segmentos.map((s) => (
                    <div key={s.chave}>{s.cabe !== null && <span className={cabe(s.cabe) || undefined}><b>{s.rotulo}</b> {s.pct}</span>}</div>
                  ))}
                </div>
              </div>
              <p className={`pp-tipo-num ${classe}`}>
                <b>{t.pct}</b>{t.pctTipica !== null && <span>típica {t.pctTipica}</span>}
              </p>
            </div>
          );
        })}
      </div>
      {legenda && <figcaption className="pp-legenda-tipica"><i aria-hidden="true" />{legenda}</figcaption>}
    </figure>
  );
}
