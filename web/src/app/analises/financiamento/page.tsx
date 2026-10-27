import type { Metadata } from "next";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import {
  contarFaixas, deCada100, descreverMudancas, emCada10, FAIXAS, FONTES, ordenarPartidos, NOME_UF, ordenarCargos,
  parteDosEleitos, porAno, porPartido, porUf, respostaSucesso, semPrestacao, somar, sucessoTresGrupos, textoDe100, TIPO_ELEICAO,
  type Filtros, type LinhaFaixa, type LinhaFontes, type LinhaSucesso,
} from "@/lib/financiamento";
import { brl, inteiro, pct, reais } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { Colunas } from "@/components/Colunas";
import { Donut } from "@/components/Donut";
import { AvisoApi } from "@/components/AvisoApi";
import { Cabecalho } from "@/components/Cabecalho";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";
import { explicacao } from "@/lib/estatistica";
import { METODOLOGIA } from "@/lib/metodologia";

export const metadata: Metadata = { title: "Dinheiro público e sucesso eleitoral" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MAX_PARTIDOS = 12;

const LEGENDA_PUB_PRIV = [{ rotulo: "Dinheiro público (impostos)", classe: "pub" }, { rotulo: "Dinheiro privado (doações e do próprio bolso)", classe: "priv" }];

/** Taxa de eleição: uma casa decimal abaixo de 1% (0,3% não pode virar "0%"). */
const taxa = (p: number) => pct(p, p > 0 && p < 0.01 ? 1 : 0);
const vezes = (v: number) => (v >= 10 ? inteiro(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

/** "das campanhas a vereador em MG", "de todas as campanhas nos seis estados"... */
function alvo(f: Filtros): string {
  const quem = f.cargo ? `das campanhas a ${f.cargo.toLowerCase()}` : "de todas as campanhas";
  const onde = f.uf ? `em ${f.uf}` : f.cargo === "Presidente" ? "(campanha nacional)" : "nos seis estados";
  return `${quem} ${onde}`;
}

export default async function Financiamento({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("q8", ["fontes", "faixas", "sucesso"]);
  if (!dados?.fontes) {
    return (
      <>
        <Cabecalho titulo="Dinheiro público e sucesso eleitoral" foto={FOTOS.urna} />
        <AvisoApi voltar="/analises/financiamento" />
      </>
    );
  }
  const fontes = comoObjetos<LinhaFontes>(dados.fontes);
  const faixas = comoObjetos<LinhaFaixa>(dados.faixas);
  const sucessoLinhas = comoObjetos<LinhaSucesso>(dados.sucesso);

  // filtros: o ano é sempre escolhido (eleições gerais e municipais têm cargos diferentes); cargo e UF são opcionais
  const anos = [...new Set(fontes.map((l) => l.ano))].sort();
  const anoPedido = Number(um(sp.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : anos[anos.length - 1];
  const ufs = [...new Set(fontes.map((l) => l.uf))].filter((u) => u !== "BR").sort();
  const uf = ufs.includes(um(sp.uf) ?? "") ? um(sp.uf) : undefined;
  const cargosDoAno = ordenarCargos([...new Set(fontes.filter((l) => l.ano === ano && (!uf || l.uf === uf)).map((l) => l.cargo))]);
  const cargo = cargosDoAno.includes(um(sp.cargo) ?? "") ? um(sp.cargo) : undefined;
  const f: Filtros = { ano, cargo, uf };
  // escolhas de visualização (não mudam os dados): grupo de candidatos e ordem dos partidos
  const grupo = um(sp.grupo) === "eleitos" || um(sp.grupo) === "nao" ? um(sp.grupo) : undefined;
  const ordem = um(sp.ordem) === "publico" ? "publico" : "valor";
  const visaoUf = um(sp.vuf) === "valor" ? "valor" : "pct";

  const href = (novo: Record<string, string | undefined>, ancora = "sucesso") => {
    const p = new URLSearchParams();
    const atual = { ano: String(ano), cargo, uf, grupo, ordem: ordem === "publico" ? ordem : undefined, vuf: visaoUf === "valor" ? visaoUf : undefined };
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v) p.set(k, v);
    return `/analises/financiamento?${p.toString()}#${ancora}`;
  };

  const soma = somar(fontes, f);
  const centavos = deCada100(FONTES.map((x) => soma.valores[x.chave]));
  const publicoDe100 = centavos[0] + centavos[1];
  const evolucao = porAno(fontes, { cargo, uf });
  const estados = porUf(fontes, { ano, cargo });
  const estadosValor = [...estados].sort((a, b) => b.soma.total - a.soma.total);
  const mudancas = descreverMudancas(evolucao);
  const partidos = porPartido(fontes, f);
  // por valor: os maiores; por % público: todos os que têm dinheiro suficiente para o percentual fazer sentido
  const partidosOrdenados = ordenarPartidos(partidos, ordem);
  const partidosGrafico = ordem === "valor" ? partidosOrdenados.slice(0, MAX_PARTIDOS) : partidosOrdenados;
  const grupos = [
    { chave: undefined, rotulo: "Todos", fx: contarFaixas(faixas, f), quem: "" },
    { chave: "eleitos", rotulo: "Eleitos", fx: contarFaixas(faixas, f, true), quem: "Entre os eleitos, " },
    { chave: "nao", rotulo: "Não eleitos", fx: contarFaixas(faixas, f, false), quem: "Entre os não eleitos, " },
  ];
  const grupoAtual = grupos.find((g) => g.chave === grupo) ?? grupos[0];
  const fx = grupoAtual.fx;
  const faixaMaior = FAIXAS.reduce((a, b) => (fx.porFaixa[b.chave] > fx.porFaixa[a.chave] ? b : a));
  // pergunta 8: três grupos (nada / pouco / muito dinheiro público) e quantos de cada um se elegeram
  const g = sucessoTresGrupos(sucessoLinhas, f);
  const { base, curta: respostaCurta } = respostaSucesso(g);
  const fora = semPrestacao(sucessoLinhas, f);
  // topo da régua em 20%, 40%, 60%... para as marcas de 1/4 caírem em números redondos (5%, 10%, 15%...)
  const tetoColunas = Math.min(1, Math.max(0.2, Math.ceil(Math.max(g.nada.taxa, g.pouco.taxa, g.muito.taxa) * 5) / 5));
  const eleitos = parteDosEleitos(fontes, f);
  const onde = uf ? ` em ${NOME_UF[uf] ?? uf}` : "";

  return (
    <>
      <Cabecalho titulo="Dinheiro público e sucesso eleitoral" pergunta="Quem recebe mais dinheiro público para a campanha se elege mais?" foto={FOTOS.urna}>
        <p className="lead">
          Dinheiro público de campanha é o que sai dos impostos: o Fundo Eleitoral e o Fundo Partidário, que os partidos
          dividem entre seus candidatos. Cruzamos quanto cada candidato recebeu com o resultado da eleição, de 2018 a 2024.
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

      {/* A resposta da pergunta 8, em uma frase e três colunas */}
      <div className="quadro">
      <section id="sucesso" className="bloco s8" aria-labelledby="h-suc">
        <h2 id="h-suc">A resposta</h2>
        {g.muito.candidaturas === 0 ? <p className="muted">Sem dados para essa combinação.</p> : (
          <>
            <p className={`resposta-curta${explicacao(respostaCurta) ? " longa" : ""}`}>{respostaCurta}</p>
            <p className="manchete pequena">
              {base.taxa > 0 && g.muito.taxa < base.taxa ? (
                <>Quem recebeu muito dinheiro público se elegeu <b>menos</b> do que quem {base === g.nada ? "não recebeu nada" : "recebeu pouco"}:
                  {" "}<b>{g.muito.taxa === 0 ? 0 : Math.round(g.muito.taxa * 100) || "menos de 1"} em cada 100</b> contra {Math.round(base.taxa * 100)} em cada 100.</>
              ) : base.taxa > 0 ? (
                <>Quem recebeu muito dinheiro público se elegeu <b>{vezes(g.muito.taxa / base.taxa)} vezes mais</b> do que quem {base === g.nada ? "não recebeu nada" : "recebeu pouco"}:
                  {" "}<b>{Math.round(g.muito.taxa * 100)} em cada 100</b> contra {Math.round(base.taxa * 100) || "menos de 1"} em cada 100.</>
              ) : (
                <>De cada 100 candidatos que receberam muito dinheiro público, <b>{Math.round(g.muito.taxa * 100)} se elegeram</b>.
                  {" "}Entre os que {base === g.nada ? "não receberam nada" : "receberam pouco"}, quase ninguém.</>
              )}
            </p>
            {explicacao(respostaCurta) && <p className="escala">{explicacao(respostaCurta)}</p>}
            <p className="escala">{cargo ? `Candidatos a ${cargo.toLowerCase()}` : "Todos os candidatos"}{onde} em {ano}. Cada coluna mostra quantos candidatos do grupo se elegeram.
              {fora > 0 && ` ${inteiro(fora)} ${fora === 1 ? "candidato não entregou" : "candidatos não entregaram"} a prestação de contas final e ${fora === 1 ? "ficou" : "ficaram"} de fora: não se sabe se receberam dinheiro público.`}</p>
            <Colunas titulo="Parte dos candidatos que se elegeu, por quanto dinheiro público receberam" max={tetoColunas} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)}
              colunas={[
                { chave: "nada", rotulo: "Não recebeu", linhas: ["nenhum dinheiro público", `${inteiro(g.nada.eleitos)} eleitos de ${inteiro(g.nada.candidaturas)}`],
                  parte: g.nada.candidaturas ? g.nada.taxa : null, vazia: "ninguém neste grupo", classe: "fx5" },
                { chave: "pouco", rotulo: "Recebeu pouco", linhas: ["a maioria dos que receberam", `${inteiro(g.pouco.eleitos)} eleitos de ${inteiro(g.pouco.candidaturas)}`],
                  parte: g.pouco.candidaturas ? g.pouco.taxa : null, classe: "fx2" },
                { chave: "muito", rotulo: "Recebeu muito", linhas: ["os que mais receberam na disputa", `${inteiro(g.muito.eleitos)} eleitos de ${inteiro(g.muito.candidaturas)}`],
                  parte: g.muito.taxa },
              ]} />
          </>
        )}
      </section>
      <aside className="s4 numeros-lado" aria-label="Os eleitos e o dinheiro público">
        {eleitos.publico > 0 && (
          <>
            <div className="bloco tinta"><p className="figura"><Rolar valor={taxa(eleitos.pctCandidatos)} /></p><p>dos candidatos se elegeram{onde} em {ano}.</p></div>
            <div className="bloco cinza"><p className="figura"><Rolar valor={taxa(eleitos.pctPublico)} /></p><p>do dinheiro público foi para esses eleitos.</p></div>
          </>
        )}
        <div className="bloco"><p className="aviso-causa"><b>Atenção:</b> dinheiro público e vitória andam juntos, mas isso não prova que o dinheiro faz ganhar.
          Os partidos costumam mandar mais dinheiro para quem já tem mais chance, como quem já tem mandato.</p></div>
      </aside>
      </div>

      <div className="secao-contexto">
        <h2 className="titulo-secao">De onde vem o dinheiro das campanhas</h2>
        <p className="lead muted">Para entender os números acima: quanto do dinheiro das campanhas é público, como isso mudou e como varia entre estados e partidos.</p>
      </div>

      {/* 1. De onde vem o dinheiro, numa pizza */}
      <section id="resposta" className="card" aria-labelledby="h-resp">
        <h2 id="h-resp">De onde vem o dinheiro</h2>
        {soma.total <= 0 ? (
          <p className="muted">Nenhuma receita registrada para essa combinação.</p>
        ) : (
          <div className="resposta">
            <Donut fatias={FONTES.map((x) => ({ rotulo: x.rotulo, valor: soma.valores[x.chave], cor: `var(--${x.classe})` }))}
              centro={`${publicoDe100}%`} legendaCentro="dinheiro público"
              descricao={`De cada 100 reais: ${FONTES.map((x, i) => `${centavos[i]} de ${x.rotulo}`).join(", ")}.`} />
            <div>
              <p className="manchete">
                Em {ano}, de cada <b>R$ 100</b> recebidos {alvo(f)}, <b>R$ {publicoDe100} vieram de dinheiro público</b>.
              </p>
              {[true, false].map((publico) => (
                <div key={String(publico)} className="grupo-fonte">
                  <h3>{publico ? "Dinheiro público" : "Dinheiro privado"} <span>R$ {publico ? publicoDe100 : 100 - publicoDe100} de cada R$ 100</span></h3>
                  <ul className="fontes">
                    {FONTES.map((x, i) => x.publico === publico && (
                      <li key={x.chave}>
                        <i className={x.classe} aria-hidden="true" />
                        <div>
                          <b>{x.rotulo}</b>
                          <span className="valor">{textoDe100(centavos[i], soma.valores[x.chave])} · {reais(soma.valores[x.chave])}</span>
                          <small>{x.explicacao}</small>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="kpis">
          <div className="kpi"><b>{reais(soma.total)}</b><span>recebidos no total</span></div>
          <div className="kpi"><b>{reais(soma.publico)}</b><span>de dinheiro público</span></div>
          <div className="kpi"><b>{reais(soma.privado)}</b><span>de dinheiro privado</span></div>
          <div className="kpi"><b>{inteiro(soma.candidaturas)}</b><span>candidatos ({inteiro(soma.comReceita)} receberam algum dinheiro)</span></div>
        </div>
        {!cargo && !uf && ano % 4 === 2 && (
          <p className="muted" style={{ fontSize: 14, marginBottom: 0 }}>Inclui as campanhas a presidente, que são nacionais (o dinheiro não é só destes seis estados). Escolha um estado ou cargo para tirá-las.</p>
        )}
      </section>

      {/* 2. Evolução */}
      <div className="quadro">
      <section className="bloco s6" aria-labelledby="h-evo">
        <h2 id="h-evo">Como isso mudou de 2018 a 2024</h2>
        <p className="muted">Quanto do dinheiro de cada eleição veio de fonte pública{cargo ? ` (${cargo.toLowerCase()})` : ""}{uf ? ` em ${uf}` : ""}. Quanto mais alta a coluna, mais as campanhas dependeram de dinheiro público. Clique em uma coluna para ver aquele ano. Valores em reais da época, sem correção pela inflação.</p>
        {mudancas.length > 0 && (
          <ul className="manchete pequena mudancas">
            {mudancas.map((m) => <li key={m.tipo}>Nas eleições <b>{m.tipo}</b>, {m.texto}</li>)}
          </ul>
        )}
        <Colunas titulo="Parte do dinheiro que foi pública em cada eleição" colunas={evolucao.map(({ ano: a, soma: s }) => ({
          chave: String(a), rotulo: String(a), linhas: s.total > 0 ? [TIPO_ELEICAO(a), reais(s.total)] : [TIPO_ELEICAO(a)],
          parte: s.total > 0 ? s.publico / s.total : null, vazia: "sem eleição", href: href({ ano: String(a) }), atual: a === ano,
          dica: s.total > 0 ? `${a}: ${pct(s.publico / s.total)} público, ${reais(s.total)} no total` : `${a}: sem eleição para esse cargo`,
        }))} />
        <p className="muted" style={{ fontSize: 14, marginBottom: 0 }}>As eleições se alternam: <b>gerais</b> (presidente, governador, senador e deputados) e <b>municipais</b> (prefeito e vereador). Compare geral com geral e municipal com municipal.</p>
      </section>

      {/* 3. Comparação entre os estados */}
      <section className="bloco s6" id="estados" aria-labelledby="h-uf">
        <h2 id="h-uf">Comparar os estados</h2>
        {cargo === "Presidente" ? (
          <p className="muted">A campanha a presidente é nacional: o dinheiro não é separado por estado.</p>
        ) : estados.length === 0 ? (
          <p className="muted">Sem dados para essa combinação.</p>
        ) : (
          <>
            <p className="muted">Campanhas {cargo ? `a ${cargo.toLowerCase()} ` : ""}em {ano}, estado por estado. Clique em um estado para ver a página inteira só dele.</p>
            <div className="chips" style={{ margin: "10px 0" }} aria-label="O que comparar entre os estados">
              <span className="muted" style={{ fontSize: 15, alignSelf: "center" }}>Ver:</span>
              <Link className={`chip${visaoUf === "pct" ? " on" : ""}`} href={href({ vuf: undefined }, "estados")} scroll={false}>Quanto foi público (em %)</Link>
              <Link className={`chip${visaoUf === "valor" ? " on" : ""}`} href={href({ vuf: "valor" }, "estados")} scroll={false}>Quanto recebeu (em R$)</Link>
            </div>
            {visaoUf === "pct" ? (
              <>
                {estados.length > 1 && (
                  <p className="manchete pequena">
                    <b>{NOME_UF[estados[0].uf] ?? estados[0].uf}</b> foi onde as campanhas mais dependeram de dinheiro público
                    ({pct(estados[0].soma.publico / estados[0].soma.total, 0)}); <b>{NOME_UF[estados.at(-1)!.uf] ?? estados.at(-1)!.uf}</b>,
                    onde menos ({pct(estados.at(-1)!.soma.publico / estados.at(-1)!.soma.total, 0)}).
                  </p>
                )}
                <p className="escala">O tamanho da barra é a parte do dinheiro que foi pública, de 0% a 100%: barra cheia = tudo público.</p>
                <BarrasH titulo="Parte do dinheiro de cada estado que foi pública" max={1} compacto
                  linhas={estados.map(({ uf: u, soma: s }) => ({
                    chave: u, rotulo: NOME_UF[u] ?? u, detalhe: u, valor: s.publico / s.total, classe: "pub", trilhoCheio: true,
                    texto: `${pct(s.publico / s.total, 0)} público`, subtexto: `de ${reais(s.total)} recebidos`,
                    href: href({ uf: uf === u ? undefined : u }, "sucesso"), atual: uf === u,
                  }))} />
              </>
            ) : (
              <>
                {estados.length > 1 && (
                  <p className="manchete pequena">
                    As campanhas de <b>{NOME_UF[estadosValor[0].uf] ?? estadosValor[0].uf}</b> foram as que mais receberam: <b>{reais(estadosValor[0].soma.total)}</b>,
                    {" "}dos quais {reais(estadosValor[0].soma.publico)} de dinheiro público. Estados maiores têm mais candidatos e, por isso, mais dinheiro.
                  </p>
                )}
                <p className="escala">O tamanho da barra é o dinheiro recebido: a parte <b>azul</b> é dinheiro público e a <b>laranja</b>, privado. Barras do mesmo tamanho = mesmo valor.</p>
                <BarrasH titulo="Dinheiro recebido por estado, público e privado" compacto
                  linhas={estadosValor.map(({ uf: u, soma: s }) => ({
                    chave: u, rotulo: NOME_UF[u] ?? u, detalhe: `${u} · ${inteiro(s.candidaturas)} candidatos`, valor: s.total, classe: "pub",
                    pedacos: [{ rotulo: `Público: ${reais(s.publico)}`, valor: s.publico, classe: "pub" }, { rotulo: `Privado: ${reais(s.privado)}`, valor: s.privado, classe: "priv" }],
                    texto: reais(s.total), subtexto: `${reais(s.publico)} público\n${reais(s.privado)} privado`,
                    href: href({ uf: uf === u ? undefined : u }, "sucesso"), atual: uf === u,
                  }))} />
                <Legenda itens={LEGENDA_PUB_PRIV} />
              </>
            )}
            {uf && <p className="muted" style={{ fontSize: 15, marginBottom: 0 }}>Você está vendo {NOME_UF[uf] ?? uf}. <Link href={href({ uf: undefined }, "estados")}>Voltar para todos os estados</Link>.</p>}
          </>
        )}
      </section>
      </div>

      {/* 4. Dependência por candidato */}
      <section className="card" id="dependencia" aria-labelledby="h-dep">
        <h2 id="h-dep">Quanto cada candidato dependeu do dinheiro público</h2>
        <p className="muted">Separamos os candidatos pela parte do dinheiro de campanha que veio dos fundos públicos.</p>
        <div className="chips" style={{ margin: "10px 0" }} aria-label="Quais candidatos ver">
          {grupos.map((g) => (
            <Link key={g.rotulo} className={`chip${g === grupoAtual ? " on" : ""}`} href={href({ grupo: g.chave }, "dependencia")} scroll={false}>
              {g.rotulo} <small>({inteiro(g.fx.total)})</small>
            </Link>
          ))}
        </div>
        {fx.total === 0 ? <p className="muted">Sem candidatos nessa combinação.</p> : (
          <>
            <p className="manchete pequena">
              {grupoAtual.quem ? grupoAtual.quem + emCada10(fx.porFaixa[faixaMaior.chave] / fx.total) : cap(emCada10(fx.porFaixa[faixaMaior.chave] / fx.total))}{" "}
              <b>{faixaMaior.frase}</b>.
            </p>
            <BarrasH titulo={`Candidatos por dependência do dinheiro público (${grupoAtual.rotulo.toLowerCase()})`} max={Math.max(...FAIXAS.map((x) => fx.porFaixa[x.chave]))}
              linhas={FAIXAS.map((x) => ({
                chave: x.chave, rotulo: x.rotulo, detalhe: x.descricao, valor: fx.porFaixa[x.chave], classe: x.classe,
                texto: pct(fx.porFaixa[x.chave] / fx.total, 0), subtexto: `${inteiro(fx.porFaixa[x.chave])} candidatos`,
              }))} />
          </>
        )}
      </section>

      {/* 6. Partidos */}
      <section className="card" id="partidos" aria-labelledby="h-par">
        <h2 id="h-par">Quanto cada partido recebeu</h2>
        <p className="muted">Soma do que os candidatos de cada partido receberam {alvo(f)} em {ano}.</p>
        <div className="chips" style={{ margin: "10px 0" }} aria-label="Ordenar os partidos">
          <span className="muted" style={{ fontSize: 15, alignSelf: "center" }}>Ver:</span>
          <Link className={`chip${ordem === "valor" ? " on" : ""}`} href={href({ ordem: undefined }, "partidos")} scroll={false}>Quanto recebeu (em R$)</Link>
          <Link className={`chip${ordem === "publico" ? " on" : ""}`} href={href({ ordem: "publico" }, "partidos")} scroll={false}>Quanto foi público (em %)</Link>
        </div>
        {partidosGrafico.length === 0 ? <p className="muted">Sem dados para essa combinação.</p> : ordem === "valor" ? (
          <>
            <p className="manchete pequena">
              Os candidatos do <b>{partidosGrafico[0].partido}</b> foram os que mais receberam: <b>{reais(partidosGrafico[0].soma.total)}</b>,
              {" "}dos quais {reais(partidosGrafico[0].soma.publico)} de dinheiro público.
            </p>
            <p className="escala">O tamanho da barra é o dinheiro recebido: a parte <b>azul</b> é dinheiro público e a <b>laranja</b>, privado. Barras do mesmo tamanho = mesmo valor.</p>
            <BarrasH titulo="Dinheiro recebido por partido, público e privado" compacto
              linhas={partidosGrafico.map(({ partido, soma: s }) => ({
                chave: partido, rotulo: partido, valor: s.total, classe: "pub",
                pedacos: [{ rotulo: `Público: ${reais(s.publico)}`, valor: s.publico, classe: "pub" }, { rotulo: `Privado: ${reais(s.privado)}`, valor: s.privado, classe: "priv" }],
                texto: reais(s.total), subtexto: `${reais(s.publico)} público\n${reais(s.privado)} privado`,
              }))} />
            <Legenda itens={LEGENDA_PUB_PRIV} />
          </>
        ) : (
          <>
            <p className="manchete pequena">
              <b>{partidosGrafico[0].partido}</b> foi o partido que mais dependeu de dinheiro público
              ({pct(partidosGrafico[0].soma.publico / partidosGrafico[0].soma.total, 0)} do que recebeu)
              {partidosGrafico.length > 1 && <>; <b>{partidosGrafico.at(-1)!.partido}</b>, o que menos ({pct(partidosGrafico.at(-1)!.soma.publico / partidosGrafico.at(-1)!.soma.total, 0)})</>}.
            </p>
            <p className="escala">O tamanho da barra é a parte do dinheiro que foi pública, de 0% a 100%: barra cheia = tudo público.</p>
            <BarrasH titulo="Parte do dinheiro de cada partido que foi pública" max={1} compacto
              linhas={partidosGrafico.map(({ partido, soma: s }) => ({
                chave: partido, rotulo: partido, valor: s.publico / s.total, classe: "pub", trilhoCheio: true,
                texto: `${pct(s.publico / s.total, 0)} público`, subtexto: `de ${reais(s.total)} recebidos`,
              }))} />
            <p className="muted" style={{ fontSize: 14 }}>Partidos que receberam muito pouco (menos de 0,5% do total) ficam de fora desta ordem: com valores pequenos, o percentual engana.</p>
          </>
        )}
        {ordem === "valor" && partidos.length > MAX_PARTIDOS && <p className="muted" style={{ fontSize: 15 }}>Mostrando os {partidosGrafico.length} que mais receberam, de {partidos.length} partidos.</p>}
        {partidos.length > 0 && (
          <details>
            <summary>Ver todos os {partidos.length} partidos em tabela</summary>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Partido</th>{FONTES.map((x) => <th key={x.chave} className="num">{x.rotulo}</th>)}<th className="num">Total</th><th className="num">% público</th></tr></thead>
                <tbody>
                  {partidos.map(({ partido, soma: s }) => (
                    <tr key={partido}><td>{partido}</td>{FONTES.map((x) => <td key={x.chave} className="num">{brl(s.valores[x.chave])}</td>)}<td className="num">{brl(s.total)}</td><td className="num">{pct(s.publico / s.total, 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {METODOLOGIA.p8.calculo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Legenda({ itens }: { itens: { rotulo: string; classe: string }[] }) {
  return <div className="legend">{itens.map((i) => <span key={i.rotulo}><i className={i.classe} />{i.rotulo}</span>)}</div>;
}
