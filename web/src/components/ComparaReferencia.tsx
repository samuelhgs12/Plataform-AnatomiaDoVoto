import type { CSSProperties } from "react";
import type { compararComReferencia } from "@/lib/abstencao";

interface Props {
  /** resultado de compararComReferencia (diferença, sentido e posições na régua) */
  comparacao: ReturnType<typeof compararComReferencia>;
  /** a referência como complemento da frase: "da média de Pernambuco", "dos seis estados juntos" */
  nome: string;
  /** rótulo e valor formatado de cada barra da legenda: a unidade e a referência */
  unidade: { rotulo: string; valor: string };
  referencia: { rotulo: string; valor: string };
}

/**
 * A unidade ao lado da referência (a média de cima), logo abaixo do número grande: uma etiqueta com a diferença em
 * pontos percentuais e uma régua com a barra da unidade e o traço da referência. Componente de servidor sem JS.
 */
export function ComparaReferencia({ comparacao, nome, unidade, referencia }: Props) {
  const pontos = Math.abs(comparacao.pontos).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <div className="compara">
      <p className="compara-chip">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d={comparacao.sentido === "igual" ? "M2 6h8" : comparacao.sentido === "acima" ? "M6 10V2M2.5 5.5 6 2l3.5 3.5" : "M6 2v8M2.5 6.5 6 10l3.5-3.5"} />
        </svg>
        {comparacao.sentido === "igual" ? `No mesmo nível ${nome}` : `${pontos} ${pontos === "1,0" ? "ponto percentual" : "pontos percentuais"} ${comparacao.sentido} ${nome}`}
      </p>
      <div className="compara-regua" role="img" aria-label={`${unidade.rotulo}: ${unidade.valor}; ${referencia.rotulo.toLowerCase()}: ${referencia.valor}`}>
        <i className="compara-taxa" style={{ "--p": comparacao.pTaxa } as CSSProperties} />
        <i className="compara-ref" style={{ "--p": comparacao.pRef } as CSSProperties} />
      </div>
      <ul className="compara-legenda" aria-hidden="true">
        <li><i className="compara-taxa" />{unidade.rotulo}<b>{unidade.valor}</b></li>
        <li><i className="compara-ref" />{referencia.rotulo}<b>{referencia.valor}</b></li>
      </ul>
    </div>
  );
}
