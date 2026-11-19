import { GRUPOS_BENS, frasePatrimonio, textoVariacao, type PontoPatrimonio } from "@/lib/patrimonio-perfil";
import { reais } from "@/lib/format";
import { BarrasH } from "./BarrasH";

const valor = (t: number) => (t > 0 ? reais(t) : "nenhum bem declarado");

/**
 * Bloco do perfil "Evolução do patrimônio": o patrimônio declarado em cada candidatura (2006 em diante), da mais antiga
 * para a mais recente, uma barra por candidatura dividida pelos grupos de bens (`pontos` já vem de evolucaoPatrimonio).
 * O valor e a variação ficam escritos ao lado da barra, e a tabela recolhida tem os mesmos números por grupo.
 */
export function PatrimonioCandidato({ pontos }: { pontos: PontoPatrimonio[] | null }) {
  const frase = pontos ? frasePatrimonio(pontos) : null;
  const usados = GRUPOS_BENS.filter((g) => pontos?.some((p) => p.grupos.some((x) => x.chave === g.chave && x.valor > 0)));
  return (
    <section className="card" aria-labelledby="h-pat" id="patrimonio">
      <h2 id="h-pat">Evolução do patrimônio</h2>
      {pontos === null ? (
        <p className="aviso" style={{ paddingLeft: 12 }}>A API não respondeu: o patrimônio declarado não pôde ser carregado.</p>
      ) : !pontos.length ? (
        <p className="muted">Os bens declarados só existem a partir de 2006, e esta pessoa não disputou eleições desde então.</p>
      ) : (
        <>
          {frase && <p className="lead" style={{ margin: "4px 0 0" }}>{frase}</p>}
          <BarrasH compacto titulo="Patrimônio declarado em cada candidatura" linhas={pontos.map((p) => ({
            chave: String(p.id_candidatura), rotulo: `${p.ano} · ${p.cargo}`,
            detalhe: [p.lugar, p.eleito ? "eleito" : "não eleito"].filter(Boolean).join(" · "),
            valor: p.total, classe: "f1",
            pedacos: p.grupos.map((g) => ({ rotulo: `${g.rotulo}: ${reais(g.valor)}`, valor: g.valor, classe: g.classe })),
            texto: valor(p.total), subtexto: textoVariacao(p) ?? undefined,
          }))} />
          {usados.length > 0 && (
            <ul className="legenda-bens" aria-label="Grupos de bens">
              {usados.map((g) => <li key={g.chave}><i className={g.classe} aria-hidden="true" />{g.rotulo}</li>)}
            </ul>
          )}
          <details>
            <summary>Ver em tabela, por grupo de bens</summary>
            <div className="tablewrap">
              <table>
                <caption className="sr-only">Patrimônio declarado em cada candidatura, por grupo de bens</caption>
                <thead>
                  <tr><th>Ano</th><th>Cargo</th>{GRUPOS_BENS.map((g) => <th key={g.chave} className="num">{g.rotulo}</th>)}<th className="num">Total</th><th className="num">Bens</th><th className="num">Variação</th></tr>
                </thead>
                <tbody>
                  {pontos.map((p) => (
                    <tr key={p.id_candidatura}>
                      <td>{p.ano}</td><td>{p.cargo}</td>
                      {p.grupos.map((g) => <td key={g.chave} className="num">{g.valor > 0 ? reais(g.valor) : "—"}</td>)}
                      <td className="num"><b>{valor(p.total)}</b></td><td className="num">{p.bens}</td>
                      <td className="num">{textoVariacao(p) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
