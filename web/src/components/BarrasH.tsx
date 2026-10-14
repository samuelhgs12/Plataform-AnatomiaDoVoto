import Link from "next/link";

export interface Pedaco { rotulo: string; valor: number; classe: string }
export interface LinhaBarra {
  chave: string; rotulo: string; detalhe?: string; valor: number; texto: string; subtexto?: string; classe: string;
  /** Divide a barra em pedaços (na mesma escala do total): o comprimento de cada pedaço é proporcional ao seu valor. */
  pedacos?: Pedaco[];
  /** Mostra o fundo da barra até o máximo (ex.: 100%), para ver quanto falta para encher. */
  trilhoCheio?: boolean;
  /** Linha clicável (ex.: filtrar a página por aquele estado) e destaque da linha escolhida. */
  href?: string;
  atual?: boolean;
}

/**
 * Barras horizontais simples, uma por linha: rótulo à esquerda, barra no meio, o número escrito à direita.
 * O comprimento é relativo a `max` (padrão: o maior valor). O texto deve dizer o mesmo que a barra mede.
 */
export function BarrasH({ linhas, max, titulo, compacto }: { linhas: LinhaBarra[]; max?: number; titulo: string; compacto?: boolean }) {
  const teto = max ?? Math.max(...linhas.map((l) => l.valor), 0);
  const largura = (v: number) => (teto > 0 ? (v / teto) * 100 : 0);
  return (
    <ul className={`barras${compacto ? " compacto" : ""}`} aria-label={titulo}>
      {linhas.map((l) => {
        const conteudo = (
          <>
            <span className="barras-rotulo">{l.rotulo}{l.detalhe && <small>{l.detalhe}</small>}</span>
            <span className={`barras-trilho${l.trilhoCheio ? " cheio" : ""}`} aria-hidden="true">
              {l.pedacos ? l.pedacos.filter((p) => p.valor > 0).map((p) => (
                <span key={p.rotulo} className={`barras-barra pedaco ${p.classe}`} style={{ width: `${largura(p.valor)}%` }} title={p.rotulo} />
              )) : (
                <span className={`barras-barra ${l.classe}`} style={{ width: `${Math.max(largura(l.valor), l.valor > 0 ? 1 : 0)}%` }} />
              )}
            </span>
            <span className="barras-valor"><b>{l.texto}</b>{l.subtexto && <small>{l.subtexto}</small>}</span>
          </>
        );
        return (
          <li key={l.chave} className={`${l.href ? "link" : ""}${l.atual ? " atual" : ""}` || undefined}>
            {l.href ? <Link href={l.href} scroll={false} aria-current={l.atual ? "true" : undefined}>{conteudo}</Link> : conteudo}
          </li>
        );
      })}
    </ul>
  );
}
