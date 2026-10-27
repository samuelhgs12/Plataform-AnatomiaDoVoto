import type { CarreiraItem } from "@/lib/types";
import { inteiro, reais } from "@/lib/format";
import {
  analisar, barraPecas, comparacao, composicaoPorTipo, grupo, linhaNada, manchetePecas, mostrarBarra, mostrarNuvem,
  nomearPredominantes, numerosDestaque, parteTabela, parteTexto, reaisCentavos, resumoPropaganda, tabelaCategorias, tabelaPecas,
  NOTA_DESPESA_DUPLA, temDespesaDupla, totalTabela, type Analise, type GrupoTabela, type LinhaParcelas, type LinhaReferencia,
  type Propaganda, type TotalTabela,
} from "@/lib/propaganda";
import { montarNuvem, type Nuvem } from "@/lib/nuvem";
import { BarrasH } from "./BarrasH";
import { BarraPecas } from "./BarraPecas";
import { NuvemPalavras } from "./NuvemPalavras";
import { METODOLOGIA } from "@/lib/metodologia";

const r$ = (centavos: number) => reais(centavos / 100);

/**
 * Bloco do perfil "Propaganda da campanha" (pergunta 9: onde o candidato investe em propaganda). Só há prestação de contas
 * de 2018 em diante. `campanhas` são as mesmas do bloco de dinheiro (da mais recente para a mais antiga), com a propaganda
 * de cada uma vinda da API; a campanha escolhida (`?campanha=`) é a mesma nos dois blocos. `referencias` (análise q9) é a
 * parcela típica de cada tipo por cargo, ano e UF; sem ela, a comparação não aparece. `parcelas` (também da q9, só quando o
 * grupo da campanha escolhida é pequeno) permite tirar a própria campanha da típica.
 *
 * Ordem: resposta (manchete pelas peças, os dois números, o que ficou de fora e, às vezes, a comparação em texto; nuvem ao
 * lado); separador e barra das peças por tipo, com a marca da campanha típica; nota curta; três detalhes recolhidos.
 */
export function PropagandaCampanha({ campanhas, escolhida, hrefDe, referencias = null, parcelas = null }: {
  campanhas: { c: CarreiraItem; p: Propaganda | null }[]; escolhida: number | undefined; hrefDe: (id: number) => string;
  referencias?: LinhaReferencia[] | null; parcelas?: LinhaParcelas[] | null;
}) {
  const atual = campanhas.find((x) => x.c.id_candidatura === escolhida) ?? campanhas[0];
  const resumo = resumoPropaganda(campanhas);
  return (
    <section className="card" aria-labelledby="h-prop" id="propaganda">
      <h2 id="h-prop">Onde a campanha investiu em propaganda</h2>
      {!atual ? (
        <p className="muted">As despesas de campanha só existem a partir de 2018, e esta pessoa não disputou eleições desde então.</p>
      ) : (
        <>
          {resumo.length > 1 && (
            <>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {resumo.length} campanhas desde 2018. Clique numa delas para ver em que a propaganda foi gasta.
              </p>
              <BarrasH compacto titulo="Quanto cada campanha contratou em propaganda" linhas={resumo.map((x) => ({
                chave: String(x.id), rotulo: `${x.ano} · ${x.cargo}`, detalhe: x.eleito ? "eleito" : "não eleito",
                valor: x.propagandaCentavos ?? 0, classe: "pp-fis",
                texto: x.propagandaCentavos === null ? "sem dados" : r$(x.propagandaCentavos),
                subtexto: x.parteDoTotal !== null && x.propagandaCentavos ? `${parteTexto(x.parteDoTotal)} das despesas` : undefined,
                href: hrefDe(x.id), atual: x.id === atual.c.id_candidatura,
              }))} />
            </>
          )}
          <Conteudo c={atual.c} p={atual.p} referencias={referencias} parcelas={parcelas} />
        </>
      )}
    </section>
  );
}

function Conteudo({ c, p, referencias, parcelas }: {
  c: CarreiraItem; p: Propaganda | null; referencias: LinhaReferencia[] | null; parcelas: LinhaParcelas[] | null;
}) {
  if (!p) return <p className="muted">Não foi possível carregar as despesas agora.</p>;
  const a = analisar(p, p.categorias);
  const campanha = `Na campanha de ${c.ano} a ${c.cargo.toLowerCase()}`;
  if (a.estado === "sem_dados") {
    return (
      <>
        <p className="manchete pequena">{campanha}, não há despesas registradas na prestação de contas final.</p>
        <p className="aviso-causa">Isso <b>não</b> quer dizer que o gasto foi zero: a prestação pode não ter sido entregue, ter sido
          entregue só como parcial ou ter sido declarada sem movimentação financeira.</p>
      </>
    );
  }
  if (a.estado === "sem_propaganda") {
    return (
      <p className="manchete pequena">
        {campanha}, {a.totalCentavos > 0
          ? <>foram registrados <b>{r$(a.totalCentavos)}</b> em despesas, nenhuma delas de propaganda.</>
          : <>foram registradas {inteiro(a.lancamentos)} {a.lancamentos === 1 ? "despesa" : "despesas"}, sem valor contratado e nenhuma de propaganda.</>}
      </p>
    );
  }
  return <ComPropaganda c={c} a={a} nuvem={montarNuvem(p.termos ?? [])} referencias={referencias} parcelas={parcelas} />;
}

function ComPropaganda({ c, a, nuvem, referencias, parcelas }: {
  c: CarreiraItem; a: Extract<Analise, { estado: "com_propaganda" }>; nuvem: Nuvem; referencias: LinhaReferencia[] | null;
  parcelas: LinhaParcelas[] | null;
}) {
  const tipos = composicaoPorTipo(a);
  const pecas = nuvem.todos;
  // sem peças (API anterior à nuvem), a manchete volta a ser a categoria do TSE de maior valor
  const manchete = manchetePecas(pecas, tipos, a.propagandaCentavos) ?? `${nomearPredominantes(a.predominantes)}.`;
  const numeros = numerosDestaque(tipos, a.propagandaCentavos, a.totalCentavos);
  const nada = linhaNada(tipos, a.propagandaCentavos, pecas);
  const barra = barraPecas(tipos, pecas, a.propagandaCentavos);
  const comBarra = mostrarBarra(barra);
  const cmp = comparacao(referencias, c, tipos, comBarra, parcelas);
  const comNuvem = mostrarNuvem(pecas);
  const total = totalTabela(a);
  const porPeca = tabelaPecas(tipos, pecas, a.propagandaCentavos);
  return (
    <>
      <div className={`pp-resposta${comNuvem ? " com-nuvem" : ""}`}>
        <div>
          <p className="resposta-curta longa">{manchete}</p>
          <div className={`pp-numeros ${numeros.grupo ? grupo(numeros.grupo).classe : ""}`}>
            <p><b>{numeros.total}</b><span>contratados em propaganda</span></p>
            {numeros.parte && <p><b>{numeros.parte}</b><span>de tudo que a campanha gastou</span></p>}
          </div>
          {nada && <p className="pp-linha">{nada}</p>}
          {cmp.texto && <p className="pp-linha">{cmp.texto}</p>}
        </div>
        {comNuvem && (
          <div className="pp-nuvem">
            <NuvemPalavras nuvem={nuvem} />
            <p className="escala">O tamanho da palavra é o valor contratado.</p>
          </div>
        )}
      </div>
      {comBarra && (
        <>
          <hr className="pp-separador" />
          <BarraPecas barra={barra} marca={cmp.marca} />
        </>
      )}
      <p className="muted pp-nota">Valor contratado declarado ao TSE; não inclui material recebido pronto do partido.</p>
      <details>
        <summary>Ver o valor de cada peça</summary>
        <TabelaPorTipo nome="Peça" legenda="Valor contratado de cada peça de propaganda, por tipo"
          grupos={porPeca} total={total} nota={temDespesaDupla(porPeca) ? NOTA_DESPESA_DUPLA : null} />
      </details>
      <details>
        <summary>Ver como o TSE classificou cada despesa</summary>
        <p className="muted pp-nota">
          É a classificação que a própria campanha escolheu ao declarar cada despesa. Os valores por peça podem ser diferentes: um
          adesivo, por exemplo, pode ter sido declarado como material impresso.
        </p>
        <TabelaPorTipo nome="Categoria" legenda="Despesas de propaganda contratadas por categoria do TSE, por tipo"
          grupos={tabelaCategorias(a, tipos)} total={total} />
      </details>
      <details>
        <summary>Sobre estes valores</summary>
        <div className="pp-sobre">
          {METODOLOGIA.p9.calculo.map((t) => <p key={t}>{t}</p>)}
        </div>
      </details>
    </>
  );
}

/** Barra da coluna "Parte da propaganda": proporcional, com 2 px de mínimo para o que existe. */
const Parte = ({ classe, parte }: { classe: string; parte: number }) => (
  <span className="pp-parte">
    <span className="pp-trilho" aria-hidden="true"><i className={classe} style={{ width: `max(2px, ${parte * 100}%)` }} /></span>
    {parteTabela(parte)}
  </span>
);

/**
 * Tabela das peças ou das categorias, agrupada por tipo (um tbody por tipo): no cabeçalho do grupo, o quadradinho da cor, o
 * nome e os totais do tipo; nas linhas, o nome com o detalhe em texto pequeno, as despesas, o valor e a parte da propaganda.
 * No fim, a linha "Propaganda" e, abaixo da tabela, a `nota` (se houver) e o total de despesas da campanha (sem ele, nem a
 * parte nem a frase).
 */
function TabelaPorTipo({ nome, legenda, grupos, total, nota = null }: {
  nome: string; legenda: string; grupos: GrupoTabela[]; total: TotalTabela; nota?: string | null;
}) {
  return (
    <>
      <div className="tablewrap">
        <table className="pp-tabela">
          <caption className="sr-only">{legenda}</caption>
          <thead><tr><th>{nome}</th><th className="num">Despesas</th><th className="num">Valor contratado</th><th className="num">Parte da propaganda</th></tr></thead>
          {grupos.map((g) => (
            <tbody key={g.grupo}>
              <tr className="pp-grupo">
                <th scope="rowgroup"><i className={grupo(g.grupo).classe} aria-hidden="true" />{g.rotulo}</th>
                <td className="num">{inteiro(g.despesas)}</td>
                <td className="num">{reaisCentavos(g.centavos)}</td>
                <td className="num"><Parte classe={grupo(g.grupo).classe} parte={g.parte} /></td>
              </tr>
              {g.linhas.map((l) => (
                <tr key={l.chave}>
                  <td>{l.nome}{l.generico && <span className="muted"> (não diz a peça)</span>}{l.detalhe && <small className="muted">{l.detalhe}</small>}</td>
                  <td className="num">{inteiro(l.despesas)}</td>
                  <td className="num">{reaisCentavos(l.centavos)}</td>
                  <td className="num"><Parte classe={`${grupo(g.grupo).classe} pp-tenue`} parte={l.parte} /></td>
                </tr>
              ))}
            </tbody>
          ))}
          <tfoot>
            <tr>
              <th scope="row">Propaganda</th><td className="num">{inteiro(total.despesas)}</td>
              <td className="num">{reaisCentavos(total.centavos)}</td><td className="num">{total.parte}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {nota && <p className="muted pp-nota">{nota}</p>}
      {total.frase && <p className="muted pp-nota">{total.frase}</p>}
    </>
  );
}
