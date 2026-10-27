import type { Metadata } from "next";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { NOME_UF, ordenarCargos, semPrestacao, TIPO_ELEICAO, type Filtros } from "@/lib/financiamento";
import {
  correlacaoDe, daMedida, efeitoDoCargo, ehMajoritario, forcaCorrelacao, maiorGastador, MEDIDAS, respostaGasto, respostaMaior, sucessoPorGasto,
  type LinhaCorrelacao, type LinhaGastoFaixa, type LinhaMaiorGasto, type Medida,
} from "@/lib/gastos";
import { inteiro, pct } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { AvisoApi } from "@/components/AvisoApi";
import { Cabecalho } from "@/components/Cabecalho";
import { Colunas } from "@/components/Colunas";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";
import { explicacao } from "@/lib/estatistica";

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
/** Como cada medida aparece nas frases. */
const TEXTO: Record<Medida, { muito: string; pouco: string; nada: string; muitosPl: string; poucosPl: string; nadaPl: string; comMais: string; nome: string }> = {
  recursos: { muito: "teve muitos recursos", pouco: "teve poucos", nada: "não declarou nada", muitosPl: "tiveram muitos recursos", poucosPl: "tiveram poucos", nadaPl: "não declararam nada", comMais: "com mais recursos", nome: "recursos" },
  gasto: { muito: "gastou muito", pouco: "gastou pouco", nada: "não declarou gasto", muitosPl: "gastaram muito", poucosPl: "gastaram pouco", nadaPl: "não declararam gasto", comMais: "que mais gastou", nome: "gasto" },
  receita: { muito: "recebeu muito", pouco: "recebeu pouco", nada: "não declarou receita", muitosPl: "receberam muito", poucosPl: "receberam pouco", nadaPl: "não declararam receita", comMais: "que mais recebeu", nome: "receita" },
};

export default async function Gastos({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("q2", ["faixas", "maior_gasto", "correlacao"]);
  if (!dados?.faixas) {
    return (
      <>
        <Cabecalho titulo="Recursos de campanha e sucesso eleitoral" foto={FOTOS.confirma} />
        <AvisoApi voltar="/analises/gastos" />
      </>
    );
  }
  // medida: recursos (padrão), só gasto ou só receita; as três tabelas trazem as três
  const medida: Medida = MEDIDAS.some((m) => m.chave === um(sp.medida)) ? (um(sp.medida) as Medida) : "recursos";
  const t = TEXTO[medida];
  const faixas = daMedida(comoObjetos<LinhaGastoFaixa>(dados.faixas), medida);
  const maiores = daMedida(comoObjetos<LinhaMaiorGasto>(dados.maior_gasto), medida);
  const correlacoes = daMedida(comoObjetos<LinhaCorrelacao>(dados.correlacao ?? { colunas: [], linhas: [] }), medida);

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
    for (const [k, v] of Object.entries({ ano: String(ano), cargo, uf, medida: medida === "recursos" ? undefined : medida, ...novo })) if (v) p.set(k, v);
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
  const fora = semPrestacao(faixas, f, cargosColunas);
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
          Separamos os candidatos pelo dinheiro que tiveram na campanha, comparando cada um só com os concorrentes da mesma disputa:
          a cidade, para prefeito e vereador; o estado, para os demais. Depois vimos quantos de cada grupo se elegeram. Dá para medir pelo
          gasto, pela receita ou pelos dois juntos. Dados de 2018 a 2024.
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
        <span className="rotulo">Medida</span>
        <div className="chips">
          {MEDIDAS.map((m) => (
            <Link key={m.chave} className={`chip${medida === m.chave ? " on" : ""}`} href={href({ medida: m.chave === "recursos" ? undefined : m.chave })} title={m.explicacao}>{m.rotulo}</Link>
          ))}
        </div>
      </nav>

      <div className="quadro">
        <section id="sucesso" className="bloco s8" aria-labelledby="h-suc">
          <h2 id="h-suc">A resposta</h2>
          {majoritario ? (
            maior.disputas === 0 ? <p className="muted">Sem disputas com recursos declarados para essa combinação.</p> : (
              <>
                <p className={`resposta-curta${explicacao(respostaMaior(maior)) ? " longa" : ""}`}>{respostaMaior(maior)}</p>
                <p className="manchete pequena">
                  Nas {inteiro(maior.disputas)} {maior.disputas === 1 ? "disputa" : "disputas"} para {cargo!.toLowerCase()}{onde} em {ano}, o candidato {t.comMais}
                  {" "}venceu em <b>{pct(maior.pct, 0)}</b> ({inteiro(maior.venceu)} {maior.venceu === 1 ? "vez" : "vezes"}).
                  {" "}Se o dinheiro não importasse, venceria em cerca de {pct(maior.pctSorteio, 0)}.
                </p>
                {explicacao(respostaMaior(maior)) && <p className="escala">{explicacao(respostaMaior(maior))}</p>}
                <p className="escala">Barra cheia = 100% das disputas. O sorteio considera quantos candidatos e quantas vagas havia em cada disputa. Só entram disputas em que todos os candidatos entregaram a prestação de contas final.</p>
                <BarrasH compacto max={1} titulo={`O candidato ${t.comMais} venceu, comparado com um sorteio`}
                  linhas={[
                    { chave: "real", rotulo: `O ${t.comMais} venceu`, valor: maior.pct, classe: "pub", trilhoCheio: true, texto: pct(maior.pct, 0), subtexto: `${inteiro(maior.venceu)} de ${inteiro(maior.disputas)} disputas` },
                    { chave: "sorteio", rotulo: "Se fosse sorteio", valor: maior.pctSorteio, classe: "fx5", trilhoCheio: true, texto: pct(maior.pctSorteio, 0), subtexto: "chance de vencer sem o dinheiro importar" },
                  ]} />
                {maior.disputas < 10 && <p className="escala">Poucas disputas: cada uma muda muito o percentual.</p>}
              </>
            )
          ) : r.curta === null ? <p className="muted">Sem dados para essa combinação.</p> : (
            <>
              <p className={`resposta-curta${explicacao(r.curta) ? " longa" : ""}`}>{r.curta}</p>
              <p className="manchete pequena">
                {r.vezes !== null && r.vezes < 1 ? (
                  <>Quem {t.muito} se elegeu <b>menos</b> do que quem {r.base.chave === "pouco" ? t.pouco : t.nada}:
                    {" "}<b>{emCada100(r.muito.taxa)} em cada 100</b> contra {emCada100(r.base.taxa)} em cada 100.</>
                ) : r.vezes !== null ? (
                  <>Quem {t.muito} se elegeu <b>{vezes(r.vezes)} vezes mais</b> do que quem {r.base.chave === "pouco" ? t.pouco : t.nada}:
                    {" "}<b>{emCada100(r.muito.taxa)} em cada 100</b> contra {emCada100(r.base.taxa)} em cada 100.</>
                ) : (
                  <>De cada 100 candidatos que {t.muitosPl}, <b>{emCada100(r.muito.taxa)} se elegeram</b>. Entre os que {r.base.chave === "pouco" ? t.poucosPl : t.nadaPl}, quase ninguém.</>
                )}
              </p>
              {explicacao(r.curta) && <p className="escala">{explicacao(r.curta)}</p>}
              <p className="escala">
                {quem}{onde} em {ano}. Cada coluna mostra quantos candidatos do grupo se elegeram.
                {fora > 0 && ` ${inteiro(fora)} ${fora === 1 ? "candidato não entregou" : "candidatos não entregaram"} a prestação de contas final e ${fora === 1 ? "ficou" : "ficaram"} de fora: não se sabe quanto tiveram (não é o mesmo que "nada declarado").`}
                {!cargo && majoritariosDoAno.length > 0 && ` ${lista(majoritariosDoAno)} ${majoritariosDoAno.length === 1 ? "tem" : "têm"} poucos candidatos por disputa e ${majoritariosDoAno.length === 1 ? "aparece" : "aparecem"} no quadro ao lado.`}
              </p>
              <Colunas titulo={`Parte dos candidatos que se elegeu, por ${t.nome}`} max={tetoColunas} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)}
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
              <p>das disputas para {lista(majoritariosDoAno.map((c) => c.toLowerCase()))}{onde}: venceu o candidato {t.comMais} (num sorteio, seriam {pct(maioresDoAno.pctSorteio, 0)}).</p>
            </div>
          )}
          {efeito && efeito.quemTinha > 0 && (
            <div className="bloco cinza">
              <p className="figura"><Rolar valor={pct(efeito.parteNoTopo, 0)} /></p>
              <p>de quem já tinha o cargo estava entre os que mais têm (cerca de 1/4 de cada disputa).</p>
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
            Entre os que mais têm (cerca de 1/4 de cada disputa), quem já tinha o cargo se elegeu em <b>{taxa(efeito.com.taxa)}</b> dos casos; quem não tinha, em <b>{taxa(efeito.sem.taxa)}</b>.
          </p>
          <p className="muted">
            Quem já está no cargo costuma estar entre os que têm mais recursos e também tem mais chance de vencer. Por isso, parte da vantagem
            de quem tem muito dinheiro vem de já ter o mandato, e não só do dinheiro. “Já tinha o cargo” = foi eleito para o mesmo cargo, no mesmo município
            ou estado, na eleição anterior (isso não garante que ainda estivesse no mandato).
          </p>
          <p className="escala">Só os que mais têm em cada disputa. Barra cheia = 100% eleitos.</p>
          <BarrasH compacto max={1} titulo="Taxa de eleição dos que mais têm, por já ter o cargo"
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
              <>Para {correlacaoCargos[0].cargo.toLowerCase()}{onde} em {ano}, a correlação entre {t.nome} e votos é de <b>{r2(correlacaoCargos[0].linha.correlacao)}</b>: {forcaCorrelacao(correlacaoCargos[0].linha.correlacao)}.</>
            ) : (() => {
              const ord = [...correlacaoCargos].sort((a, b) => a.linha.correlacao - b.linha.correlacao);
              return <>Em {ano}{onde}, a correlação entre {t.nome} e votos vai de <b>{r2(ord[0].linha.correlacao)}</b> ({ord[0].cargo.toLowerCase()}) a <b>{r2(ord.at(-1)!.linha.correlacao)}</b> ({ord.at(-1)!.cargo.toLowerCase()}).</>;
            })()}
          </p>
          <p className="muted">
            A correlação vai de −1 a 1: perto de 1, quem tem mais dinheiro tem mais votos; perto de 0, não há relação; negativa, quem tem
            mais dinheiro tem menos votos. Ela compara a posição de cada candidato no dinheiro com a posição nos votos, dentro da própria
            disputa. A barra mostra só a parte positiva (de 0 a 1); valores negativos aparecem escritos com o sinal.
          </p>
          <BarrasH compacto max={1} titulo={`Correlação entre ${t.nome} e votos, por cargo`}
            linhas={correlacaoCargos.map(({ cargo: c, linha }) => ({
              chave: c, rotulo: c, valor: Math.max(0, linha.correlacao), classe: "pub", trilhoCheio: true,
              texto: r2(linha.correlacao), subtexto: `${forcaCorrelacao(linha.correlacao)} · ${inteiro(linha.n)} candidatos`,
            }))} />
        </section>
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Três medidas, da prestação de contas entregue ao TSE (versão final ou regularização): o gasto (despesas, sem as transferências para outros candidatos ou partidos); a receita (tudo o que recebeu, inclusive material de campanha doado por outros candidatos, comum entre vereadores); e os recursos, o maior dos dois. As conclusões são as mesmas nas três.</li>
          <li>Os recursos existem porque muitos candidatos declaram despesas com valor zero (material doado) e recebem o material de outro candidato: só pelo gasto, eles pareceriam campanhas sem dinheiro.</li>
          <li>Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador), o estado (deputados, senador e governador) ou o país (presidente).</li>
          <li>“Muito” é cerca de 1/4 de quem declarou algo, os que mais têm na disputa; “pouco”, cerca de 1/4, os que menos têm; “médio”, o meio. Valores iguais ficam sempre no mesmo grupo, por isso os grupos têm tamanho aproximado. “Nada declarado” = valor zero na prestação final.</li>
          <li>Em prefeito, governador, senador e presidente há poucos candidatos por disputa, então a pergunta vira “o que tinha mais dinheiro venceu?”, comparada com a chance de um sorteio.</li>
          <li>A resposta “Sim” ou “Não” só aparece quando a diferença é grande demais para ser acaso (teste estatístico, 95% de confiança) e de pelo menos 20%; com poucos casos, a página diz que não dá para afirmar.</li>
          <li>Correlação: cada candidato recebe sua posição no dinheiro e nos votos (1º turno) dentro da disputa, com a média das posições em caso de empate (como no Spearman), dividida pelo número de candidatos; as posições de todas as disputas do cargo são reunidas numa só correlação.</li>
          <li>Sucesso eleitoral = ter sido eleito, conforme o resultado do TSE. Só titulares, eleições ordinárias e quem de fato disputou; não há receitas nem despesas antes de 2018.</li>
        </ul>
      </section>
    </>
  );
}
