import type { Metadata } from "next";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { cargoPadrao, custoPorAno, custoPorCargo, custoPorUf, variacao, type LinhaCusto } from "@/lib/custo";
import { NOME_UF, TIPO_ELEICAO } from "@/lib/financiamento";
import { inteiro, pct, reais } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { AvisoApi } from "@/components/AvisoApi";
import { Cabecalho } from "@/components/Cabecalho";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";
import { METODOLOGIA } from "@/lib/metodologia";

export const metadata: Metadata = { title: "Quanto custa uma cadeira" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const umaCasa = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function CustoCadeira({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("q1", ["custo"]);
  if (!dados?.custo) {
    return (
      <>
        <Cabecalho titulo="Quanto custa uma cadeira" foto={FOTOS.congresso} />
        <AvisoApi voltar="/analises/custo-cadeira" />
      </>
    );
  }
  const linhas = comoObjetos<LinhaCusto>(dados.custo);

  // filtros: ano sempre escolhido; UF opcional; o cargo em destaque é escolhido clicando nos cartões
  const anos = [...new Set(linhas.map((l) => l.ano))].sort();
  const anoPedido = Number(um(sp.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : anos[anos.length - 1];
  const ufs = [...new Set(linhas.map((l) => l.uf))].filter((u) => u !== "BR").sort();
  const uf = ufs.includes(um(sp.uf) ?? "") ? um(sp.uf) : undefined;
  const cargos = custoPorCargo(linhas, ano, uf);
  const nomes = cargos.map((c) => c.cargo);
  const cargo = nomes.includes(um(sp.cargo) ?? "") ? um(sp.cargo) : cargoPadrao(nomes, ano);
  const atual = cargos.find((c) => c.cargo === cargo);
  const historico = cargo ? custoPorAno(linhas, cargo, uf) : [];
  const estados = cargo && cargo !== "Presidente" ? custoPorUf(linhas, ano, cargo) : [];
  const onde = uf ? ` em ${NOME_UF[uf] ?? uf}` : cargo === "Presidente" ? " (campanha nacional)" : " nos seis estados";

  const href = (novo: Record<string, string | undefined>, ancora = "custo") => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ano: String(ano), uf, cargo, ...novo })) if (v) p.set(k, v);
    return `/analises/custo-cadeira?${p.toString()}#${ancora}`;
  };
  const primeiro = historico[0], ultimo = historico[historico.length - 1];
  const mudou = historico.length > 1 ? variacao(primeiro.porCadeira, ultimo.porCadeira) : null;

  return (
    <>
      <Cabecalho titulo="Quanto custa uma cadeira" pergunta="Quanto custa uma cadeira/mandato?" foto={FOTOS.congresso}>
        <p className="lead">
          Somamos tudo o que os candidatos a cada cargo gastaram na campanha e dividimos de duas formas: pelo número de
          vagas, que dá o custo de uma cadeira, e pelo número de candidatos, que dá o gasto médio de cada um. Dados de 2018 a 2024.
        </p>
      </Cabecalho>

      <nav className="bloco filtros-fin" aria-label="Escolha o que ver">
        <span className="rotulo">Eleição</span>
        <div className="chips">
          {anos.map((a) => (
            <Link key={a} className={`chip${a === ano ? " on" : ""}`} href={href({ ano: String(a), cargo: undefined })} aria-current={a === ano ? "true" : undefined}>
              {a} <small>· {TIPO_ELEICAO(a).replace("eleição ", "")}</small>
            </Link>
          ))}
        </div>
        <span className="rotulo">Estado</span>
        <div className="chips">
          <Link className={`chip${!uf ? " on" : ""}`} href={href({ uf: undefined })}>Todos</Link>
          {ufs.map((u) => <Link key={u} className={`chip${uf === u ? " on" : ""}`} href={href({ uf: u })}>{u}</Link>)}
        </div>
      </nav>

      <div className="quadro">
        <section id="custo" className="bloco s8" aria-labelledby="h-custo">
          <h2 id="h-custo">A resposta</h2>
          {!atual || atual.porCadeira === null ? <p className="muted">Sem dados para essa combinação.</p> : (
            <>
              <p className="manchete">
                Em {ano}, {atual.vagas === 1 ? "a única cadeira" : `cada uma das ${inteiro(atual.vagas)} cadeiras`} de {atual.cargo.toLowerCase()}{onde} custou{" "}
                <b>{reais(atual.porCadeira)}</b> em gastos de campanha.
                {atual.porCandidato !== null && <> Cada candidato gastou, em média, <b>{reais(atual.porCandidato)}</b>.</>}
              </p>
              <p className="escala">
                Custo da cadeira = gasto de todos que fizeram campanha para o cargo ÷ número de vagas. Gasto por candidato = gasto de quem
                disputou ÷ número de candidatos. Clique num cargo para vê-lo em destaque.
                {atual.naoDisputouComGasto > 0 && ` O custo da cadeira inclui ${reais(atual.gastoNaoDisputou)} de ${inteiro(atual.naoDisputouComGasto)} ${atual.naoDisputouComGasto === 1 ? "candidato que fez campanha mas não chegou a disputar" : "candidatos que fizeram campanha mas não chegaram a disputar"} (candidatura barrada, renúncia ou substituição).`}
                {atual.semPrestacao > 0 && ` ${inteiro(atual.semPrestacao)} ${atual.semPrestacao === 1 ? "candidato não entregou" : "candidatos não entregaram"} a prestação de contas final: ${atual.semPrestacao === 1 ? "entra" : "entram"} na conta com gasto zero, mas o valor real não é conhecido.`}
              </p>
            </>
          )}
          <div className="kpis" role="list" aria-label="Custo de uma cadeira por cargo">
            {cargos.map((c) => (
              <Link key={c.cargo} role="listitem" href={href({ cargo: c.cargo })} scroll={false} className="kpi" aria-current={c.cargo === cargo ? "true" : undefined}
                style={{ textDecoration: "none", outline: c.cargo === cargo ? "2px solid var(--fg)" : undefined }}>
                <b>{c.porCadeira === null ? "—" : reais(c.porCadeira)}</b>
                <span>
                  por cadeira de {c.cargo.toLowerCase()} · {inteiro(c.vagas)} {c.vagas === 1 ? "vaga" : "vagas"}
                  {c.porCandidato !== null && ` · ${reais(c.porCandidato)} por candidato`}
                </span>
              </Link>
            ))}
          </div>
        </section>
        <aside className="s4 numeros-lado" aria-label={`Números de ${cargo ?? "cargo"}`}>
          {atual?.candidatosPorVaga != null && (
            <div className="bloco tinta"><p className="figura"><Rolar valor={umaCasa(atual.candidatosPorVaga)} /></p><p>candidatos por vaga de {atual.cargo.toLowerCase()}{onde} em {ano}.</p></div>
          )}
          {atual?.parteEleitos != null && (
            <div className="bloco cinza"><p className="figura"><Rolar valor={pct(atual.parteEleitos, 0)} /></p><p>do dinheiro foi gasto por quem se elegeu; o resto, por quem perdeu.</p></div>
          )}
          <div className="bloco"><p className="aviso-causa"><b>Atenção:</b> valores como declarados ao TSE em cada eleição.
            {cargo === "Presidente" && " A campanha a presidente é nacional: o gasto não é só destes seis estados."}</p></div>
        </aside>
      </div>

      {cargo && historico.length > 0 && (
        <section id="historico" className="card" aria-labelledby="h-hist">
          <h2 id="h-hist">Como mudou: {cargo.toLowerCase()}{uf ? ` em ${NOME_UF[uf] ?? uf}` : ""}</h2>
          {mudou !== null && (
            <p className="manchete pequena">
              De {primeiro.ano} para {ultimo.ano}, o custo de uma cadeira {mudou >= 0 ? "subiu" : "caiu"} <b>{pct(Math.abs(mudou), 0)}</b>:
              {" "}de {reais(primeiro.porCadeira ?? 0)} para {reais(ultimo.porCadeira ?? 0)}.
            </p>
          )}
          <p className="escala">O tamanho da barra é o custo de uma cadeira em cada eleição para esse cargo. Valores da época, sem correção pela inflação.</p>
          <BarrasH compacto titulo={`Custo de uma cadeira de ${cargo} por eleição`}
            linhas={historico.map((c) => ({
              chave: String(c.ano), rotulo: String(c.ano), detalhe: TIPO_ELEICAO(c.ano), valor: c.porCadeira ?? 0, classe: "pub",
              texto: c.porCadeira === null ? "—" : reais(c.porCadeira),
              subtexto: `${c.porCandidato === null ? "" : `${reais(c.porCandidato)} por candidato`}\n${inteiro(c.candidatos)} candidatos, ${inteiro(c.vagas)} vagas`,
              href: href({ ano: String(c.ano) }), atual: c.ano === ano,
            }))} />
        </section>
      )}

      {estados.length > 1 && (
        <section id="estados" className="card" aria-labelledby="h-uf">
          <h2 id="h-uf">Comparar os estados: {cargo?.toLowerCase()} em {ano}</h2>
          <p className="manchete pequena">
            A cadeira mais cara foi em <b>{NOME_UF[estados[0].uf] ?? estados[0].uf}</b> ({reais(estados[0].porCadeira ?? 0)});
            {" "}a mais barata, em <b>{NOME_UF[estados.at(-1)!.uf] ?? estados.at(-1)!.uf}</b> ({reais(estados.at(-1)!.porCadeira ?? 0)}).
          </p>
          <p className="escala">O tamanho da barra é o custo de uma cadeira. Clique num estado para ver a página só dele.</p>
          <BarrasH compacto titulo={`Custo de uma cadeira de ${cargo} por estado`}
            linhas={estados.map((c) => ({
              chave: c.uf, rotulo: NOME_UF[c.uf] ?? c.uf, detalhe: c.uf, valor: c.porCadeira ?? 0, classe: "pub",
              texto: reais(c.porCadeira ?? 0),
              subtexto: `${inteiro(c.vagas)} ${c.vagas === 1 ? "vaga" : "vagas"} · ${c.porCandidato === null ? "" : `${reais(c.porCandidato)} por candidato`}`,
              href: href({ uf: uf === c.uf ? undefined : c.uf }), atual: uf === c.uf,
            }))} />
        </section>
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {METODOLOGIA.p1.calculo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </>
  );
}
