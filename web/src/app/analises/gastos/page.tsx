import type { Metadata } from "next";
import Link from "next/link";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF, ordenarCargos, TIPO_ELEICAO, type Filtros } from "@/lib/financiamento";
import {
  correlacaoDe, efeitoDoCargo, ehMajoritario, forcaCorrelacao, maiorGastador, respostaGasto, respostaMaior, sucessoPorGasto,
  type LinhaCorrelacao, type LinhaGastoFaixa, type LinhaMaiorGasto,
} from "@/lib/gastos";
import { inteiro, pct } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { Cabecalho } from "@/components/Cabecalho";
import { Colunas } from "@/components/Colunas";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Recursos de campanha e sucesso eleitoral" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Taxa de eleição: uma casa decimal abaixo de 1% (0,3% não pode virar "0%"). */
const taxa = (p: number) => pct(p, p > 0 && p < 0.01 ? 1 : 0);
const vezes = (v: number) => (v >= 10 ? inteiro(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const emCada100 = (p: number) => (p > 0 && p < 0.005 ? "menos de 1" : String(Math.round(p * 100)));
const r2 = (r: number) => r.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lista = (itens: string[]) => itens.join(", ").replace(/, ([^,]*)$/, " e $1");

export default async function Gastos({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerEstatico("q2");
  if (!dados?.faixas) {
    return (
      <>
        <Cabecalho titulo="Recursos de campanha e sucesso eleitoral" foto={FOTOS.confirma} />
        <div className="card aviso">
          <h2>Dados ainda não gerados</h2>
          <p>Na pasta <code>pipeline/</code>, rode <code>python export_static.py q2</code>.</p>
        </div>
      </>
    );
  }
  const faixas = comoObjetos<LinhaGastoFaixa>(dados.faixas);
  const maiores = comoObjetos<LinhaMaiorGasto>(dados.maior_gasto);
  const correlacoes = comoObjetos<LinhaCorrelacao>(dados.correlacao ?? { colunas: [], linhas: [] });

  // filtros: o ano é sempre escolhido (eleições gerais e municipais têm cargos diferentes); cargo e UF são opcionais
  const anos = [...new Set(faixas.map((l) => l.ano))].sort();
  const anoPedido = Number(um(sp.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : anos[anos.length - 1];
  const ufs = [...new Set(faixas.map((l) => l.uf))].filter((u) => u !== "BR").sort();
  const uf = ufs.includes(um(sp.uf) ?? "") ? um(sp.uf) : undefined;
  const cargosDoAno = ordenarCargos([...new Set(faixas.filter((l) => l.ano === ano && (!uf || l.uf === uf)).map((l) => l.cargo))]);
  const cargo = cargosDoAno.includes(um(sp.cargo) ?? "") ? um(sp.cargo) : undefined;
  const f: Filtros = { ano, cargo, uf };
  const onde = uf ? ` em ${NOME_UF[uf] ?? uf}` : "";

  const href = (novo: Record<string, string | undefined>, ancora = "sucesso") => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ano: String(ano), cargo, uf, ...novo })) if (v) p.set(k, v);
    return `/analises/gastos?${p.toString()}#${ancora}`;
  };

  // Cargos com muitos candidatos (vereador, deputados): taxa de eleição por grupo de recursos.
  // Cargos com poucos (prefeito, governador, senador, presidente): "o que teve mais recursos venceu?".
  // Na visão "todos os cargos", as colunas usam só os de muitos candidatos, onde dividir em quartos faz sentido.
  const majoritario = ehMajoritario(cargo);
  const proporcionais = cargosDoAno.filter((c) => !ehMajoritario(c));
  const majoritariosDoAno = cargosDoAno.filter(ehMajoritario);
  const cargosColunas = cargo ? undefined : proporcionais;
  const grupos = sucessoPorGasto(faixas, f, { cargos: cargosColunas });
  const r = respostaGasto(grupos);
  const maior = maiorGastador(maiores, f);
  const maioresDoAno = maiorGastador(maiores.filter((l) => majoritariosDoAno.includes(l.cargo)), { ano, uf });
  const tetoColunas = Math.min(1, Math.max(0.2, Math.ceil(Math.max(...grupos.map((g) => g.taxa)) * 5) / 5));
  const efeito = majoritario ? null : efeitoDoCargo(faixas, f, cargosColunas);
  const correlacaoCargos = (cargo ? [cargo] : cargosDoAno)
    .map((c) => ({ cargo: c, linha: correlacaoDe(correlacoes, ano, c, uf) }))
    .filter((x): x is { cargo: string; linha: LinhaCorrelacao } => !!x.linha);
  const quem = cargo ? `Candidatos a ${cargo.toLowerCase()}` : `Candidatos a ${lista(proporcionais.map((c) => c.toLowerCase()))}`;

  return (
    <>
      <Cabecalho titulo="Recursos de campanha e sucesso eleitoral" pergunta="Existe relação entre o volume de recursos/gastos e a taxa de sucesso eleitoral?" foto={FOTOS.confirma}>
        <p className="lead">
          Separamos os candidatos pelos recursos que tiveram na campanha (o que receberam ou gastaram), comparando cada um só com
          os concorrentes da mesma disputa: a cidade, para prefeito e vereador; o estado, para os demais. Depois vimos quantos de cada grupo se elegeram. Dados de 2018 a 2024.
        </p>
      </Cabecalho>

      <nav className="bloco filtros-fin" aria-label="Escolha o que ver">
        <span className="rotulo">Eleição</span>
        <div className="chips">
          {anos.map((a) => (
            <Link key={a} className={`chip${a === ano ? " on" : ""}`} href={href({ ano: String(a) })} aria-current={a === ano ? "true" : undefined}>
              {a} <small>· {TIPO_ELEICAO(a).replace("eleição ", "")}</small>
            </Link>
          ))}
        </div>
        <span className="rotulo">Cargo</span>
        <div className="chips">
          <Link className={`chip${!cargo ? " on" : ""}`} href={href({ cargo: undefined })}>Todos</Link>
          {cargosDoAno.map((c) => <Link key={c} className={`chip${cargo === c ? " on" : ""}`} href={href({ cargo: c })}>{c}</Link>)}
        </div>
        <span className="rotulo">Estado</span>
        <div className="chips">
          <Link className={`chip${!uf ? " on" : ""}`} href={href({ uf: undefined })}>Todos</Link>
          {ufs.map((u) => <Link key={u} className={`chip${uf === u ? " on" : ""}`} href={href({ uf: u })}>{u}</Link>)}
        </div>
      </nav>

      <div className="quadro">
        <section id="sucesso" className="bloco s8" aria-labelledby="h-suc">
          <h2 id="h-suc">A resposta</h2>
          {majoritario ? (
            maior.disputas === 0 ? <p className="muted">Sem disputas com recursos declarados para essa combinação.</p> : (
              <>
                <p className="resposta-curta">{respostaMaior(maior)}</p>
                <p className="manchete pequena">
                  Nas {inteiro(maior.disputas)} {maior.disputas === 1 ? "disputa" : "disputas"} para {cargo!.toLowerCase()}{onde} em {ano}, o candidato com mais recursos
                  {" "}venceu em <b>{pct(maior.pct, 0)}</b> ({inteiro(maior.venceu)} {maior.venceu === 1 ? "vez" : "vezes"}).
                  {" "}Se os recursos não importassem, venceria em cerca de {pct(maior.pctSorteio, 0)}.
                </p>
                <p className="escala">Barra cheia = 100% das disputas. O sorteio considera quantos candidatos e quantas vagas havia em cada disputa.</p>
                <BarrasH compacto max={1} titulo="O que teve mais recursos venceu, comparado com um sorteio"
                  linhas={[
                    { chave: "real", rotulo: "O que teve mais recursos venceu", valor: maior.pct, classe: "pub", trilhoCheio: true, texto: pct(maior.pct, 0), subtexto: `${inteiro(maior.venceu)} de ${inteiro(maior.disputas)} disputas` },
                    { chave: "sorteio", rotulo: "Se fosse sorteio", valor: maior.pctSorteio, classe: "fx5", trilhoCheio: true, texto: pct(maior.pctSorteio, 0), subtexto: "chance de vencer sem os recursos importarem" },
                  ]} />
                {maior.disputas < 10 && <p className="escala">Poucas disputas: cada uma muda muito o percentual.</p>}
              </>
            )
          ) : r.curta === null ? <p className="muted">Sem dados para essa combinação.</p> : (
            <>
              <p className="resposta-curta">{r.curta}</p>
              <p className="manchete pequena">
                {r.vezes !== null ? (
                  <>Quem teve muitos recursos se elegeu <b>{vezes(r.vezes)} vezes mais</b> do que quem teve {r.base.chave === "pouco" ? "poucos" : "nenhum"}:
                    {" "}<b>{emCada100(r.muito.taxa)} em cada 100</b> contra {emCada100(r.base.taxa)} em cada 100.</>
                ) : (
                  <>De cada 100 candidatos com muitos recursos, <b>{emCada100(r.muito.taxa)} se elegeram</b>. Entre os que tiveram {r.base.chave === "pouco" ? "poucos" : "nenhum"}, quase ninguém.</>
                )}
              </p>
              <p className="escala">
                {quem}{onde} em {ano}. Cada coluna mostra quantos candidatos do grupo se elegeram.
                {!cargo && majoritariosDoAno.length > 0 && ` ${lista(majoritariosDoAno)} ${majoritariosDoAno.length === 1 ? "tem" : "têm"} poucos candidatos por disputa e ${majoritariosDoAno.length === 1 ? "aparece" : "aparecem"} no quadro ao lado.`}
              </p>
              <Colunas titulo="Parte dos candidatos que se elegeu, pelos recursos que tiveram" max={tetoColunas} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)}
                colunas={grupos.map((g) => ({
                  chave: g.chave, rotulo: g.rotulo, linhas: [g.detalhe, `${inteiro(g.eleitos)} eleitos de ${inteiro(g.candidaturas)}`],
                  parte: g.candidaturas ? g.taxa : null, vazia: "ninguém neste grupo", classe: g.classe || undefined,
                }))} />
            </>
          )}
        </section>
        <aside className="s4 numeros-lado" aria-label="Outros números">
          {!cargo && maioresDoAno.disputas > 0 && (
            <div className="bloco tinta">
              <p className="figura"><Rolar valor={pct(maioresDoAno.pct, 0)} /></p>
              <p>das disputas para {lista(majoritariosDoAno.map((c) => c.toLowerCase()))}{onde}: venceu o candidato com mais recursos (num sorteio, seriam {pct(maioresDoAno.pctSorteio, 0)}).</p>
            </div>
          )}
          {efeito && efeito.quemTinha > 0 && (
            <div className="bloco cinza">
              <p className="figura"><Rolar valor={pct(efeito.parteNoTopo, 0)} /></p>
              <p>de quem já tinha o cargo estava entre os 25% com mais recursos.</p>
            </div>
          )}
          <div className="bloco"><p className="aviso-causa"><b>Atenção:</b> recursos e vitória andam juntos, mas isso não prova que o dinheiro faz ganhar.
            Quem já tem mais chance (quem já tem mandato, por exemplo) também consegue arrecadar e gastar mais.</p></div>
        </aside>
      </div>

      {efeito && efeito.com.candidaturas > 0 && efeito.sem.candidaturas > 0 && (
        <section id="cargo" className="card" aria-labelledby="h-cargo">
          <h2 id="h-cargo">Dinheiro ou já estar no cargo?</h2>
          <p className="manchete pequena">
            Entre os que tiveram mais recursos, quem já tinha o cargo se elegeu em <b>{taxa(efeito.com.taxa)}</b> dos casos; quem não tinha, em <b>{taxa(efeito.sem.taxa)}</b>.
          </p>
          <p className="muted">
            Quem já está no cargo costuma estar entre os que têm mais recursos e também tem mais chance de vencer. Por isso, parte da vantagem
            de quem tem muitos recursos vem de já ter o mandato, e não só do dinheiro. “Já tinha o cargo” = foi eleito para o mesmo cargo na eleição anterior.
          </p>
          <p className="escala">Só os 25% com mais recursos em cada disputa. Barra cheia = 100% eleitos.</p>
          <BarrasH compacto max={1} titulo="Taxa de eleição dos que tiveram mais recursos, por já ter o cargo"
            linhas={[
              { chave: "com", rotulo: "Já tinha o cargo", valor: efeito.com.taxa, classe: "pub", trilhoCheio: true, texto: taxa(efeito.com.taxa), subtexto: `${inteiro(efeito.com.eleitos)} eleitos de ${inteiro(efeito.com.candidaturas)}` },
              { chave: "sem", rotulo: "Não tinha o cargo", valor: efeito.sem.taxa, classe: "fx2", trilhoCheio: true, texto: taxa(efeito.sem.taxa), subtexto: `${inteiro(efeito.sem.eleitos)} eleitos de ${inteiro(efeito.sem.candidaturas)}` },
            ]} />
        </section>
      )}

      {correlacaoCargos.length > 0 && (
        <section id="correlacao" className="card" aria-labelledby="h-cor">
          <h2 id="h-cor">Medindo a relação</h2>
          <p className="manchete pequena">
            {correlacaoCargos.length === 1 ? (
              <>Para {correlacaoCargos[0].cargo.toLowerCase()}{onde} em {ano}, a correlação entre recursos e votos é de <b>{r2(correlacaoCargos[0].linha.correlacao)}</b>: {forcaCorrelacao(correlacaoCargos[0].linha.correlacao)}.</>
            ) : (() => {
              const ord = [...correlacaoCargos].sort((a, b) => a.linha.correlacao - b.linha.correlacao);
              return <>Em {ano}{onde}, a correlação entre recursos e votos vai de <b>{r2(ord[0].linha.correlacao)}</b> ({ord[0].cargo.toLowerCase()}) a <b>{r2(ord.at(-1)!.linha.correlacao)}</b> ({ord.at(-1)!.cargo.toLowerCase()}).</>;
            })()}
          </p>
          <p className="muted">
            A correlação vai de 0 (nenhuma relação) a 1 (quem tem mais recursos sempre tem mais votos). Ela compara a posição de cada candidato
            nos recursos com a posição nos votos, dentro da própria disputa.
          </p>
          <BarrasH compacto max={1} titulo="Correlação entre recursos e votos, por cargo"
            linhas={correlacaoCargos.map(({ cargo: c, linha }) => ({
              chave: c, rotulo: c, valor: Math.max(0, linha.correlacao), classe: "pub", trilhoCheio: true,
              texto: r2(linha.correlacao), subtexto: `${forcaCorrelacao(linha.correlacao)} · ${inteiro(linha.n)} candidatos`,
            }))} />
        </section>
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Recursos de cada candidato = o maior valor entre o que recebeu e o que gastou, na prestação de contas entregue ao TSE (versão final ou regularização).</li>
          <li>O recebido inclui o material de campanha doado por outros candidatos, comum entre vereadores. O gasto não inclui as transferências para outros candidatos ou partidos.</li>
          <li>Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador), o estado (deputados, senador e governador) ou o país (presidente).</li>
          <li>“Muitos recursos” são os 25% com mais recursos na disputa; “poucos”, os 25% com menos; “médios”, a metade do meio. Valores iguais ficam sempre no mesmo grupo. “Sem recursos” = nada declarado na prestação final.</li>
          <li>Em prefeito, governador, senador e presidente há poucos candidatos por disputa, então a pergunta vira “o que teve mais recursos venceu?”, comparada com a chance de um sorteio.</li>
          <li>Correlação: de Spearman, entre a posição do candidato nos recursos e nos votos (1º turno) dentro da disputa, juntando todas as disputas do cargo.</li>
          <li>Sucesso eleitoral = ter sido eleito, conforme o resultado do TSE. Só titulares, eleições ordinárias e quem de fato disputou; não há receitas nem despesas antes de 2018.</li>
        </ul>
      </section>
    </>
  );
}
