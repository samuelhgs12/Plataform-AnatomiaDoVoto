import Link from "next/link";
import { nomeProprio } from "@/lib/abstencao";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { inteiro, reais } from "@/lib/format";
import { escalaLista, textoPosicao, type ItemLista } from "@/lib/patrimonio";
import { Avatar } from "./Avatar";
import { PartyChip } from "./PartyChip";

/**
 * Os candidatos da pergunta 2 em linhas: foto, nome (leva ao perfil), partido e cidade, a posição na própria disputa, o
 * patrimônio declarado com uma barra (na escala do maior da lista), os votos e o resultado. `inicio` linhas à vista; o
 * resto em "Ver os N". Componente de servidor (a foto é cliente).
 */
export function ListaPatrimonio({ itens, ano, inicio = 5, titulo, comCidade = false }: { itens: ItemLista[]; ano: number; inicio?: number; titulo: string; comCidade?: boolean }) {
  if (!itens.length) return <p className="muted pequeno">Ninguém neste recorte.</p>;
  const { max, foraDoComum } = escalaLista(itens.map((i) => i.patrimonio));
  const linha = (c: ItemLista) => (
    <li key={c.id_candidatura}>
      <span className="lp-foto"><Avatar nome={c.nome} partido={c.partido} foto={fotoDaPessoa({ id_candidato: c.id_candidato, ultimo_ano: ano })} /></span>
      <span className="lp-nome">
        {c.id_candidato ? <Link href={`/candidato/${c.id_candidato}`}>{nomeProprio(c.nome)}</Link> : nomeProprio(c.nome)}
        <small><PartyChip sigla={c.partido} />{comCidade && c.municipio && <span>{nomeProprio(c.municipio)}</span>}</small>
        <small className="lp-pos">{textoPosicao(c)}</small>
      </span>
      <span className="lp-valor">
        <b>{c.patrimonio > 0 ? reais(c.patrimonio) : "Sem bens"}</b>
        <span className="lp-trilho" aria-hidden="true"><i style={{ width: `${Math.min(1, c.patrimonio / max) * 100}%` }} /></span>
        {foraDoComum(c.patrimonio) && <small className="lp-alerta" title="Mais de 5 vezes o 2º maior da lista: pode ser erro de digitação na declaração ao TSE">valor fora do comum</small>}
      </span>
      <span className="lp-res">
        <b className={c.eleito ? "eleito" : undefined}>{c.eleito ? "Eleito" : "Não eleito"}</b>
        <small>{c.votos > 0 ? `${inteiro(c.votos)} votos` : "sem votos"}</small>
        {c.tinhaCargo && <span className="selo">já tinha o cargo</span>}
      </span>
    </li>
  );
  return (
    <div className="lista-p2">
      <ol aria-label={titulo}>{itens.slice(0, inicio).map(linha)}</ol>
      {itens.length > inicio && (
        <details className="ver-todos">
          <summary>Ver os {itens.length}</summary>
          <ol start={inicio + 1} aria-label={`${titulo} (continuação)`}>{itens.slice(inicio).map(linha)}</ol>
        </details>
      )}
    </div>
  );
}
