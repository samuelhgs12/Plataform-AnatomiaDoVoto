import type { GrupoComposicao } from "@/lib/patrimonio";

const p = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Quem são os eleitos: duas barras 100%, candidatos e eleitos, divididas nos mesmos grupos de patrimônio, com o
 * percentual escrito nas fatias, a legenda das cores numa linha e a tabela equivalente só para leitor de tela.
 * Componente de servidor, sem JS.
 */
export function ComposicaoEleitos({ grupos, titulo }: { grupos: GrupoComposicao[]; titulo: string }) {
  const barra = (rotulo: string, parte: (g: GrupoComposicao) => number) => (
    <div className="comp-linha">
      <span className="comp-rot">{rotulo}</span>
      <div className="emp-barra" role="img" aria-label={`${titulo}, ${rotulo.toLowerCase()}: ${grupos.map((g) => `${g.rotulo} ${p(parte(g))}`).join(", ")}.`}>
        {grupos.filter((g) => parte(g) > 0).map((g) => (
          <span key={g.chave} className={`emp-seg ${g.cor}`} style={{ flexGrow: parte(g) }} title={`${g.rotulo}: ${p(parte(g))}`}>
            {parte(g) >= 0.1 && <em>{p(parte(g))}</em>}
          </span>
        ))}
      </div>
    </div>
  );
  return (
    <figure className="empilhada comp-p2">
      {barra("Candidatos", (g) => g.parteCandidatos)}
      {barra("Eleitos", (g) => g.parteEleitos)}
      <ul className="comp-legenda" aria-hidden="true">
        {grupos.map((g) => <li key={g.chave}><i className={g.cor} />{g.rotulo}</li>)}
      </ul>
      <div className="sr-only"><table>
        <caption>{titulo}</caption>
        <thead><tr><th scope="col">Grupo</th><th scope="col">Candidatos</th><th scope="col">Eleitos</th></tr></thead>
        <tbody>{grupos.map((g) => <tr key={g.chave}><th scope="row">{g.rotulo}</th><td>{p(g.parteCandidatos)}</td><td>{p(g.parteEleitos)}</td></tr>)}</tbody>
      </table></div>
    </figure>
  );
}
