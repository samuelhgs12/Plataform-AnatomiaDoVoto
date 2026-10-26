import type { CSSProperties } from "react";
import Link from "next/link";

export interface LinhaExtremo { id: number; nome: string; valor: string; p: number; classe: string; href: string }

interface Props {
  mais: LinhaExtremo[];
  menos: LinhaExtremo[];
  /** posição da média do estado na régua das barras (0 a 1) e o rótulo dela ("média de RJ, 18,2%") */
  media: { p: number; rotulo: string };
  descricao: string;
}

/**
 * Onde mais e menos se faltou: duas listas de barras de proporção (de 0 ao maior valor), na cor que cada município tem
 * no mapa, cortadas pela linha da média do estado. O primeiro de cada lista, o extremo, vem maior. Cada linha leva ao
 * município. Componente de servidor sem JS.
 */
export function ExtremosAbstencao({ mais, menos, media, descricao }: Props) {
  const grupo = (titulo: string, linhas: LinhaExtremo[]) => (
    <div className="extr-grupo">
      <p className="extr-titulo">{titulo}</p>
      <ol className="extr-lista">
        {linhas.map((l) => (
          <li key={l.id}>
            <Link scroll={false} href={l.href} aria-label={`${l.nome}: ${l.valor}`}>
              <span className="extr-nome">{l.nome}</span>
              <span className="extr-trilho" aria-hidden="true">
                <i className={l.classe} style={{ "--p": l.p } as CSSProperties} />
                <em style={{ "--p": media.p } as CSSProperties} />
              </span>
              <b className="extr-valor">{l.valor}</b>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="extremos-vis" role="group" aria-label={descricao}>
      {grupo("Mais faltaram", mais)}
      {grupo("Menos faltaram", menos)}
      <p className="extr-media" aria-hidden="true"><i />{media.rotulo}</p>
    </div>
  );
}
