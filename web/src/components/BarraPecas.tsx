import { reais } from "@/lib/format";
import { descricaoBarra, grupo, parteTexto, reguaTipica, tiposSemNome, type BarraPecas as Barra, type Comparacao } from "@/lib/propaganda";

const r$ = (centavos: number) => reais(centavos / 100);
/** pp-cabe-<px> some quando a barra é mais estreita que isso (container query): o texto nunca aparece cortado. */
const cabe = (px: number) => (px > 0 ? `pp-cabe-${px}` : "");

/**
 * Barra única da pergunta 9: um segmento por peça, agrupado por tipo, com a chave de cada tipo em cima (nome e
 * percentual) e o nome e o percentual das peças embaixo, só quando cabem. Entre a barra e os rótulos, a régua da campanha
 * típica do cargo (mediana do tipo de maior valor), da borda esquerda até a típica. Recebe a barra montada por `barraPecas`
 * (src/lib/propaganda.ts) e só desenha: componente de servidor sem JS. As três faixas (chaves, barra, rótulos) usam as
 * mesmas colunas, uma por segmento. Embaixo,
 * a legenda dos tipos cujo nome não coube na chave: cada item aparece exatamente quando o nome da sua chave some.
 */
export function BarraPecas({ barra, marca }: { barra: Barra; marca: Comparacao["marca"] }) {
  const segmentos = barra.tipos.flatMap((t) => t.segmentos);
  const colunas = { gridTemplateColumns: segmentos.map((s) => `minmax(0, ${s.centavos}fr)`).join(" ") };
  const semNome = tiposSemNome(barra);
  const regua = reguaTipica(marca);
  return (
    <figure className="barra-pp">
      <div role="img" aria-label={descricaoBarra(barra, marca)}>
        <div className="pp-faixa pp-chaves" style={colunas} aria-hidden="true">
          {barra.tipos.map((t) => (
            <div key={t.grupo} className={`pp-chave ${grupo(t.grupo).classe}`} style={{ gridColumn: `span ${t.segmentos.length}` }}>
              {t.cabe !== null && <span className={cabe(t.cabe) || undefined}><b>{t.rotulo}</b> {t.de100}%</span>}
            </div>
          ))}
        </div>
        <div className="pp-faixa pp-barra" style={colunas} aria-hidden="true">
          {segmentos.map((s) => (
            <div key={s.chave} className={`pp-seg ${s.generico ? "pp-outra" : grupo(s.grupo).classe}`}
              title={`${s.outras ? `outras (${s.membros.map((m) => m.rotulo).join(", ")})` : s.rotulo}: ${r$(s.centavos)} (${parteTexto(s.parte)})`} />
          ))}
        </div>
        {regua && <div className="pp-regua" aria-hidden="true"><i style={{ width: `${regua.largura * 100}%` }} /></div>}
        <div className="pp-faixa pp-rotulos" style={colunas} aria-hidden="true">
          {segmentos.map((s) => (
            <div key={s.chave}>
              {s.cabe !== null && <span className={cabe(s.cabe) || undefined}><b>{s.rotulo}</b><br />{s.pct}</span>}
            </div>
          ))}
        </div>
        {semNome.length > 0 && (
          <div className="pp-tipos-sem-nome" aria-hidden="true">
            {semNome.map((t) => (
              <span key={t.grupo} className={t.classe ?? undefined}><i className={grupo(t.grupo).classe} /><b>{t.rotulo}</b> {t.de100}%</span>
            ))}
          </div>
        )}
      </div>
      {marca && <figcaption className="pp-legenda-marca"><i aria-hidden="true" />{marca.legenda}</figcaption>}
    </figure>
  );
}
