import type { GrupoComposicao } from "@/lib/patrimonio";

const p = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Quem são os eleitos: duas barras 100%, candidatos e eleitos, divididas nos mesmos grupos de patrimônio, e uma legenda
 * com as duas partes de cada grupo (a leitura não depende da cor). Componente de servidor, sem JS.
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
      <ul className="comp-legenda">
        <li className="comp-cab" aria-hidden="true"><span /><span>Grupo</span><b>Candidatos</b><b>Eleitos</b></li>
        {grupos.map((g) => (
          <li key={g.chave}><i className={g.cor} /><span>{g.rotulo}</span><b>{p(g.parteCandidatos)}</b><b>{p(g.parteEleitos)}</b></li>
        ))}
      </ul>
    </figure>
  );
}
