import type { CSSProperties } from "react";

interface Props {
  /** cada município do estado, de 0 (menor abstenção) a 1 (maior) */
  pontos: { id: number; p: number }[];
  /** o escolhido */
  p: number;
  /** "menor 9,1%" e "maior 28,4%", nas pontas */
  pontas: [string, string];
  descricao: string;
}

/**
 * Todos os municípios do estado numa faixa, um traço por município, e o escolhido em destaque: mostra de relance se
 * ele está no meio da multidão ou numa ponta. Componente de servidor sem JS.
 */
export function FaixaMunicipios({ pontos, p, pontas, descricao }: Props) {
  return (
    <figure className="faixa-mun" role="img" aria-label={descricao}>
      <div className="faixa-mun-trilho" aria-hidden="true">
        {pontos.map((x) => <i key={x.id} style={{ "--p": x.p } as CSSProperties} />)}
        <b style={{ "--p": p } as CSSProperties} />
      </div>
      <figcaption aria-hidden="true"><span>{pontas[0]}</span><span>{pontas[1]}</span></figcaption>
    </figure>
  );
}
