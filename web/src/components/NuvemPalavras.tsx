import { reais } from "@/lib/format";
import { descricaoNuvem, textoDetalhes, type Nuvem } from "@/lib/nuvem";
import { classeTermo, parteTexto, tipoComum } from "@/lib/propaganda";

/**
 * Nuvem de palavras da pergunta 9: o que a campanha comprou em propaganda, uma palavra por peça. Recebe a nuvem já
 * montada por `montarNuvem` (src/lib/nuvem.ts) e só desenha. Componente de servidor sem JS: SVG que escala com a coluna.
 * O tamanho é o valor contratado; a cor é o tipo de propaganda (cinza: não diz qual peça). Cada palavra tem um <title>
 * com o que ela cobre e os formatos; a página traz a tabela equivalente (a cor não é a única forma de ler o tipo).
 */
export function NuvemPalavras({ nuvem }: { nuvem: Nuvem }) {
  const { caixa } = nuvem;
  return (
    <figure className="nuvem">
      <svg viewBox={`${caixa.x} ${caixa.y} ${caixa.largura} ${caixa.altura}`} role="img" aria-label={descricaoNuvem(nuvem)}>
        {nuvem.palavras.map((p) => {
          const detalhes = textoDetalhes(p);
          return (
            <text key={p.termo} x={p.x} y={p.y} fontSize={p.tamanho} textAnchor="middle" dominantBaseline="central"
              className={classeTermo(p)}>
              <title>
                {`${p.termo}${p.explicacao ? ` (${p.explicacao})` : ""}: ${reais(p.centavos / 100)}, ${parteTexto(p.parte)} da propaganda`
                  + `${p.generico ? "" : `, ${tipoComum(p.grupo).frase}`}${detalhes ? `. Formatos: ${detalhes}` : ""}`}
              </title>
              {p.termo}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
