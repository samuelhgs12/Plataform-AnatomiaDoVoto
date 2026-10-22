import type { Metadata } from "next";
import Link from "next/link";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF, ordenarCargos, TIPO_ELEICAO, type Filtros } from "@/lib/financiamento";
import {
  efeitoDoCargo, ehMajoritario, maiorGastador, respostaGasto, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto,
} from "@/lib/gastos";
import { inteiro, pct } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { Cabecalho } from "@/components/Cabecalho";
import { Colunas } from "@/components/Colunas";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Gastos de campanha e sucesso eleitoral" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Taxa de eleição: uma casa decimal abaixo de 1% (0,3% não pode virar "0%"). */
const taxa = (p: number) => pct(p, p > 0 && p < 0.01 ? 1 : 0);
const vezes = (v: number) => (v >= 10 ? inteiro(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const emCada100 = (p: number) => (p > 0 && p < 0.005 ? "menos de 1" : String(Math.round(p * 100)));

export default async function Gastos({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerEstatico("q2");
  if (!dados?.faixas) {
    return (
      <>
        <Cabecalho titulo="Gastos de campanha e sucesso eleitoral" foto={FOTOS.confirma} />
        <div className="card aviso">
          <h2>Dados ainda não gerados</h2>
          <p>Na pasta <code>pipeline/</code>, rode <code>python export_static.py q2</code>.</p>
        </div>
      </>
    );
  }
  const faixas = comoObjetos<LinhaGastoFaixa>(dados.faixas);
  const maiores = comoObjetos<LinhaMaiorGasto>(dados.maior_gasto);

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

  // cargos com poucos candidatos: "o que mais gastou venceu?"; os demais: taxa de eleição por grupo de gasto
  const majoritario = ehMajoritario(cargo);
  const grupos = sucessoPorGasto(faixas, f);
  const r = respostaGasto(grupos);
  const maior = maiorGastador(maiores, f);
  const respostaMaior = maior.disputas === 0 ? null
    : maior.pct > maior.pctSorteio * 1.2 ? "Sim." : maior.pct * 1.2 < maior.pctSorteio ? "Não." : "Quase não faz diferença.";
  const tetoColunas = Math.min(1, Math.max(0.2, Math.ceil(Math.max(...grupos.map((g) => g.taxa)) * 5) / 5));
  const cargosMaiores = cargosDoAno.filter(ehMajoritario).filter((c) => c !== "Presidente" || !uf);
  const efeito = efeitoDoCargo(faixas, f);
  const quem = cargo ? `candidatos a ${cargo.toLowerCase()}` : "todos os candidatos";

  return (
    <>
      <Cabecalho titulo="Gastos de campanha e sucesso eleitoral" pergunta="Existe relação entre o volume de recursos/gastos e a taxa de sucesso eleitoral?" foto={FOTOS.confirma}>
        <p className="lead">
          Separamos os candidatos pelo quanto gastaram na campanha, comparando cada um só com os concorrentes da mesma
          disputa (a cidade, para prefeito e vereador; o estado, para os demais), e vimos quantos de cada grupo se elegeram. Dados de 2018 a 2024.
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
            maior.disputas === 0 ? <p className="muted">Sem disputas com gasto declarado para essa combinação.</p> : (
              <>
                <p className="resposta-curta">{respostaMaior}</p>
                <p className="manchete pequena">
                  Nas {inteiro(maior.disputas)} {maior.disputas === 1 ? "disputa" : "disputas"} para {cargo!.toLowerCase()}{onde} em {ano}, o candidato que mais gastou
                  {" "}venceu em <b>{pct(maior.pct, 0)}</b> ({inteiro(maior.venceu)} {maior.venceu === 1 ? "vez" : "vezes"}).
                  {" "}Se o gasto não importasse, venceria em cerca de {pct(maior.pctSorteio, 0)}.
                </p>
                <p className="escala">Barra cheia = 100% das disputas. O sorteio considera quantos candidatos e quantas vagas havia em cada disputa.</p>
                <BarrasH compacto max={1} titulo="O que mais gastou venceu, comparado com um sorteio"
                  linhas={[
                    { chave: "real", rotulo: "O que mais gastou venceu", valor: maior.pct, classe: "pub", trilhoCheio: true, texto: pct(maior.pct, 0), subtexto: `${inteiro(maior.venceu)} de ${inteiro(maior.disputas)} disputas` },
                    { chave: "sorteio", rotulo: "Se fosse sorteio", valor: maior.pctSorteio, classe: "fx5", trilhoCheio: true, texto: pct(maior.pctSorteio, 0), subtexto: "chance de vencer sem o dinheiro importar" },
                  ]} />
                {maior.disputas < 10 && <p className="escala">Poucas disputas: cada uma muda muito o percentual.</p>}
              </>
            )
          ) : r.curta === null ? <p className="muted">Sem dados para essa combinação.</p> : (
            <>
              <p className="resposta-curta">{r.curta}</p>
              <p className="manchete pequena">
                {r.vezes !== null ? (
                  <>Quem gastou muito se elegeu <b>{vezes(r.vezes)} vezes mais</b> do que quem {r.base.chave === "pouco" ? "gastou pouco" : "não gastou nada"}:
                    {" "}<b>{emCada100(r.muito.taxa)} em cada 100</b> contra {emCada100(r.base.taxa)} em cada 100.</>
                ) : (
                  <>De cada 100 candidatos que gastaram muito, <b>{emCada100(r.muito.taxa)} se elegeram</b>. Entre os que {r.base.chave === "pouco" ? "gastaram pouco" : "não gastaram nada"}, quase ninguém.</>
                )}
              </p>
              <p className="escala">{quem[0].toUpperCase() + quem.slice(1)}{onde} em {ano}. Cada coluna mostra quantos candidatos do grupo se elegeram.</p>
              <Colunas titulo="Parte dos candidatos que se elegeu, por quanto gastaram" max={tetoColunas} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)}
                colunas={grupos.map((g) => ({
                  chave: g.chave, rotulo: g.rotulo, linhas: [g.detalhe, `${inteiro(g.eleitos)} eleitos de ${inteiro(g.candidaturas)}`],
                  parte: g.candidaturas ? g.taxa : null, vazia: "ninguém neste grupo", classe: g.classe || undefined,
                }))} />
            </>
          )}
        </section>
        <aside className="s4 numeros-lado" aria-label="Outros números">
          {!cargo && cargosMaiores.length > 0 && (() => {
            const m = maiorGastador(maiores.filter((l) => cargosMaiores.includes(l.cargo)), { ano, uf });
            return m.disputas > 0 && (
              <div className="bloco tinta">
                <p className="figura"><Rolar valor={pct(m.pct, 0)} /></p>
                <p>das disputas para {cargosMaiores.map((c) => c.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " e $1")}{onde}: o candidato que mais gastou venceu.</p>
              </div>
            );
          })()}
          {efeito.quemTinha > 0 && (
            <div className="bloco cinza">
              <p className="figura"><Rolar valor={pct(efeito.parteNoTopo, 0)} /></p>
              <p>de quem já tinha o cargo estava entre os 25% que mais gastaram.</p>
            </div>
          )}
          <div className="bloco"><p className="aviso-causa"><b>Atenção:</b> gasto e vitória andam juntos, mas isso não prova que o dinheiro faz ganhar.
            Quem já tem mais chance (quem já tem mandato, por exemplo) também consegue arrecadar e gastar mais.</p></div>
        </aside>
      </div>

      {efeito.com.candidaturas > 0 && efeito.sem.candidaturas > 0 && (
        <section id="cargo" className="card" aria-labelledby="h-cargo">
          <h2 id="h-cargo">Dinheiro ou já estar no cargo?</h2>
          <p className="manchete pequena">
            Entre os que mais gastaram, quem já tinha o cargo se elegeu em <b>{taxa(efeito.com.taxa)}</b> dos casos; quem não tinha, em <b>{taxa(efeito.sem.taxa)}</b>.
          </p>
          <p className="muted">
            Quem já está no cargo costuma estar entre os que mais gastam e também tem mais chance de vencer. Por isso, parte da vantagem
            de quem gasta muito vem de já ter o mandato, e não só do dinheiro. “Já tinha o cargo” = foi eleito para o mesmo cargo na eleição anterior.
          </p>
          <p className="escala">Só os 25% que mais gastaram em cada disputa. Barra cheia = 100% eleitos.</p>
          <BarrasH compacto max={1} titulo="Taxa de eleição dos que mais gastaram, por já ter o cargo"
            linhas={[
              { chave: "com", rotulo: "Já tinha o cargo", valor: efeito.com.taxa, classe: "pub", trilhoCheio: true, texto: taxa(efeito.com.taxa), subtexto: `${inteiro(efeito.com.eleitos)} eleitos de ${inteiro(efeito.com.candidaturas)}` },
              { chave: "sem", rotulo: "Não tinha o cargo", valor: efeito.sem.taxa, classe: "fx2", trilhoCheio: true, texto: taxa(efeito.sem.taxa), subtexto: `${inteiro(efeito.sem.eleitos)} eleitos de ${inteiro(efeito.sem.candidaturas)}` },
            ]} />
        </section>
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Gasto: despesas da prestação de contas entregue ao TSE (versão final ou regularização), sem as transferências para outros candidatos ou partidos.</li>
          <li>Cada candidato é comparado só com os concorrentes da mesma disputa: o município (prefeito e vereador), o estado (deputados, senador e governador) ou o país (presidente).</li>
          <li>“Gastou muito” são os 25% que mais gastaram na disputa; “gastou pouco”, os 25% que menos gastaram; “médio”, a metade do meio. Valores iguais ficam sempre no mesmo grupo.</li>
          <li>Em prefeito, governador, senador e presidente há poucos candidatos por disputa, então a pergunta vira “o que mais gastou venceu?”, comparada com a chance de um sorteio.</li>
          <li>Sucesso eleitoral = ter sido eleito, conforme o resultado do TSE. Só titulares, eleições ordinárias e quem de fato disputou; não há despesas antes de 2018.</li>
        </ul>
      </section>
    </>
  );
}
