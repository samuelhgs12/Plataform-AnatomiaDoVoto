import type { CSSProperties } from "react";

export interface LinhaIndicadorCenso {
  chave: string;
  rotulo: string;
  /** valor da unidade (município, estado ou os seis), já formatado; "—" sem dado */
  valor: string;
  /** pontas da escala, formatadas: o menor e o maior município */
  min: string;
  max: string;
  /** posições de 0 a 1 na escala (reguaIndicador): a unidade e a média de referência */
  p: number | null;
  pMedia: number | null;
  /** um traço por município (caminho SVG no viewBox 0 0 100 10) */
  tracos: string;
  /** a régua em palavras, para leitor de tela */
  descricao: string;
}

function Regua({ l }: { l: LinhaIndicadorCenso }) {
  return (
    <div className="ic-regua" role="img" aria-label={l.descricao}>
      <svg className="ic-tracos" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true"><path d={l.tracos} /></svg>
      {l.pMedia != null && <i className="ic-media" style={{ "--p": l.pMedia } as CSSProperties} />}
      {l.p != null && <b className="ic-unidade" style={{ "--p": l.p } as CSSProperties} />}
      <span className="ic-pontas" aria-hidden="true"><span>{l.min}</span><span>{l.max}</span></span>
    </div>
  );
}

/**
 * Indicadores do Censo 2010 da unidade escolhida, só para leitura: nenhum fundo, borda ou "bolinha" que lembre botão
 * ou slider. O indicador do comparativo (o da dispersão ao lado) vem primeiro e maior; os outros seguem numa lista
 * contínua. Cada régua é a distribuição dos municípios (um traço cada, entre o menor e o maior), com a média de
 * referência tracejada e a unidade como uma barra laranja. Componente de servidor sem JS.
 */
export function IndicadoresCenso({ destaque, outros, legenda }: { destaque: LinhaIndicadorCenso; outros: LinhaIndicadorCenso[]; legenda: { unidade: string; media?: string } }) {
  return (
    <div className="ic">
      <p className="ic-legenda" aria-hidden="true">
        <span><b className="ic-unidade" />{legenda.unidade}</span>
        {legenda.media && <span><i className="ic-media" />{legenda.media}</span>}
        <span><svg viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0V10M5 0V10M8 0V10" /></svg>cada município</span>
      </p>

      <div className="ic-destaque">
        <p className="ic-nome"><span>{destaque.rotulo}</span><small>comparado com a abstenção ao lado</small></p>
        <p className="ic-valor">{destaque.valor}</p>
        <Regua l={destaque} />
      </div>

      <ul className="ic-lista">
        {outros.map((l) => (
          <li key={l.chave}>
            <span className="ic-nome">{l.rotulo}</span>
            <span className="ic-valor">{l.valor}</span>
            <Regua l={l} />
          </li>
        ))}
      </ul>
    </div>
  );
}
