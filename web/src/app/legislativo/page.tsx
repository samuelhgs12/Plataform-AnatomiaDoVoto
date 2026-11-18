import type { Metadata } from "next";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { NOME_UF } from "@/lib/financiamento";
import { compacto, inteiro, pct, reais } from "@/lib/format";
import {
  ANOS_LEGISLATIVO, FAIXAS_VIES, LEITURAS, PLENARIO_NACIONAL, ROTULO_FONTE, ROTULO_RENOVACAO, UFS_PROJETO,
  bancadas as montarBancadas, cadeirasDaCasa, posicaoNaEscala, siglaNaComposicao, chaveCasa, classeCusto, classePartido, classeRenovacao, classeVies, fmtVies, lerCasa,
  legislatura, lugares as montarLugares, nomeCasa, ordenarBancadas, quartis, resumo as montarResumo, semResultado, vagasDaCasa,
  type Escolha, type Leitura, type LinhaCadeira, type LinhaGastoPartido, type LinhaSemResultado, type LinhaVagas, type Recorte,
} from "@/lib/legislativo";
import { METODOLOGIA } from "@/lib/metodologia";
import { AvisoApi } from "@/components/AvisoApi";
import { DicaPlenario } from "@/components/DicaPlenario";
import { Plenario, type CadeiraDesenho } from "@/components/Plenario";

export const metadata: Metadata = { title: "Legislativo" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const CARGO: Record<Escolha["casa"], string> = { senado: "senador", camara: "deputado federal", assembleia: "deputado estadual" };

export default async function Legislativo({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("legislativo", ["cadeiras", "vagas", "gasto_partido", "sem_resultado"]);
  if (!dados?.cadeiras || !dados.vagas || !dados.gasto_partido || !dados.sem_resultado) {
    return (
      <>
        <section className="bloco leg-topo"><h1>Legislativo</h1></section>
        <AvisoApi voltar="/legislativo" />
      </>
    );
  }
  // partidos que só mudaram de nome aparecem com o nome em vigor na composição (PMDB → MDB, PRB → REPUBLICANOS…)
  const todas = comoObjetos<LinhaCadeira>(dados.cadeiras).map((c) => ({ ...c, sigla: siglaNaComposicao(c.sigla, c.ano) }));
  const vagas = comoObjetos<LinhaVagas>(dados.vagas);
  const gastos = comoObjetos<LinhaGastoPartido>(dados.gasto_partido).map((g) => ({ ...g, sigla: siglaNaComposicao(g.sigla, g.ano_eleicao) }));
  const semRes = comoObjetos<LinhaSemResultado>(dados.sem_resultado);

  // ---------- filtros (validados contra o que existe) ----------
  const escolha: Escolha = lerCasa(um(sp.casa)) ?? { casa: "camara" };
  const anoPedido = Number(um(sp.ano));
  const ano = ANOS_LEGISLATIVO.includes(anoPedido) ? anoPedido : 2022;
  const leitura: Leitura = LEITURAS.some((l) => l.id === um(sp.ver)) ? (um(sp.ver) as Leitura) : "vies";
  const nacional = escolha.casa !== "assembleia";
  const recorte: Recorte = nacional && um(sp.recorte) === "estados" ? "estados" : "inteiro";

  const cadeiras = cadeirasDaCasa(todas, ano, escolha);
  const ufsSem = semResultado(semRes, ano, escolha);
  const vagasSem = vagasDaCasa(vagas, ano, escolha, ufsSem);
  const total = recorte === "inteiro" && nacional ? PLENARIO_NACIONAL[escolha.casa as "senado" | "camara"] : cadeiras.length + vagasSem;
  const lugares = montarLugares(cadeiras, total, vagasSem);
  const lista = montarBancadas(cadeiras, gastos, ano, escolha);
  const indice = new Map(lista.map((b, i) => [b.sigla, i]));
  const siglaPedida = um(sp.partido);
  const partido = siglaPedida && indice.has(siglaPedida) ? siglaPedida : undefined;
  const res = montarResumo(cadeiras, gastos, ano, escolha, ufsSem);
  const cortes = quartis(cadeiras.map((c) => c.gasto).filter((v): v is number => v !== null));
  const nome = nomeCasa(escolha);
  const cargo = CARGO[escolha.casa];

  const href = (novo: Record<string, string | undefined>, ancora = "plenario") => {
    const p = new URLSearchParams();
    const atual = { casa: chaveCasa(escolha), ano: String(ano), ver: leitura, recorte: recorte === "estados" ? "estados" : undefined, partido };
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v && !(k === "casa" && v === "camara") && !(k === "ano" && v === "2022") && !(k === "ver" && v === "vies")) p.set(k, v);
    const q = p.toString();
    return `/legislativo${q ? `?${q}` : ""}#${ancora}`;
  };

  // ---------- o que cada leitura desenha ----------
  const valorDe = (c: LinhaCadeira): string => {
    if (leitura === "vies") return c.score === null ? "sem viés" : `viés ${fmtVies(c.score, 0)}`;
    if (leitura === "custo") return c.gasto === null ? (c.ano_eleicao < 2018 ? `eleito em ${c.ano_eleicao}, sem dados de gasto` : "sem prestação de contas final") : `gastou ${reais(c.gasto)}`;
    if (leitura === "renovacao") return ROTULO_RENOVACAO[c.renovacao];
    return `eleito em ${c.ano_eleicao}`;
  };
  const classeDe = (c: LinhaCadeira): string =>
    leitura === "vies" ? classeVies(c.score) : leitura === "custo" ? classeCusto(c.gasto, cortes) : leitura === "renovacao" ? classeRenovacao(c.renovacao) : classePartido(indice.get(c.sigla)!);
  const desenho = ({ cadeira: c }: { cadeira: LinhaCadeira }): CadeiraDesenho => ({
    classe: classeDe(c), bancada: indice.get(c.sigla)!, nome: c.nome, detalhe: `${c.sigla} · ${c.uf}`, valor: valorDe(c),
    href: `/candidato/${c.id_candidato}`, apagada: partido !== undefined && c.sigla !== partido,
  });
  const maiores = lista.filter((b) => b.cadeiras >= Math.max(2, cadeiras.length * 0.04)).map((b) => ({ bancada: indice.get(b.sigla)!, sigla: b.sigla }));

  const centro = (() => {
    if (!cadeiras.length) return { numero: "", legenda: "sem resultado na base" };
    if (leitura === "vies") return { numero: fmtVies(res.viesMedio), legenda: "viés médio das cadeiras" };
    if (leitura === "custo") return { numero: res.custoCadeira === null ? "—" : `R$ ${compacto(res.custoCadeira)}`, legenda: "custo de uma cadeira" };
    if (leitura === "partido") return { numero: String(res.partidos), legenda: res.partidos === 1 ? "partido" : "partidos" };
    return { numero: pct(res.reeleitos / res.cadeiras, 0), legenda: "reeleitos" };
  })();

  const maior = [...lista].sort((a, b) => b.cadeiras - a.cadeiras)[0];
  const manchete = (() => {
    if (!cadeiras.length) return null;
    if (leitura === "vies") return <>Das {inteiro(res.cadeiras)} cadeiras, <b>{inteiro(res.esquerda)}</b> são de partidos com viés abaixo de −10, <b>{inteiro(res.centro)}</b> entre −10 e +10 e <b>{inteiro(res.direita)}</b> acima de +10.</>;
    if (leitura === "custo") return res.custoCadeira === null ? <>Não há gastos de campanha na base para esta composição.</> : <>Somando as campanhas de todos os candidatos a {cargo}{escolha.uf ? "" : " dos seis estados"}, cada cadeira disputada em {ano} custou <b>{reais(res.custoCadeira)}</b>. {res.gastoMediano !== null && <>O eleito típico gastou <b>{reais(res.gastoMediano)}</b>.</>}</>;
    if (leitura === "partido") return <><b>{res.partidos}</b> partidos dividem as {inteiro(res.cadeiras)} cadeiras. A maior bancada é a do <b>{maior.sigla}</b>, com {inteiro(maior.cadeiras)} ({pct(maior.cadeiras / res.cadeiras, 0)}).</>;
    return <><b>{inteiro(res.reeleitos)}</b> foram reeleitos para a casa, <b>{inteiro(res.jaEleitos)}</b> já tinham vencido outra eleição desde 1998 e <b>{inteiro(res.estreantes)}</b> estreiam.</>;
  })();

  const ordenadas = ordenarBancadas(lista, leitura);
  const membros = partido ? cadeiras.filter((c) => c.sigla === partido).sort((a, b) => a.nome.localeCompare(b.nome)) : [];
  const bancadaEscolhida = partido ? lista.find((b) => b.sigla === partido) : undefined;
  const fontesUsadas = [...new Set(lista.map((b) => b.fonte).filter((f): f is string => !!f && f !== "bls"))];

  // realce cruzado plenário ↔ tabela, só com CSS: uma regra por bancada
  const realce = lista.map((_, i) =>
    `.leg:has([data-b="${i}"]:is(:hover,:focus-within,:focus-visible)) .cad:not([data-b="${i}"]){opacity:.14}` +
    `.leg:has(.cad[data-b="${i}"]:hover) tr[data-b="${i}"]{background:var(--panel2)}` +
    `.leg:has(tr[data-b="${i}"]:is(:hover,:focus-within)) .cad-sigla:not([data-b="${i}"]){opacity:.3}`,
  ).join("");

  return (
    <div className="leg">
      <style>{realce}</style>
      <section className="bloco leg-topo" aria-labelledby="h-pagina">
        <div className="leg-titulo">
          <h1 id="h-pagina">{nome}</h1>
          <p className="leg-sub">
            {escolha.casa === "senado" ? `Composição da legislatura ${legislatura(ano)}: eleitos em ${ano - 4} e em ${ano}` : `Legislatura ${legislatura(ano)}, eleita em ${ano}`}
            {nacional && ` · ${recorte === "inteiro" ? `plenário de ${inteiro(total)} cadeiras` : "só a bancada dos seis estados"}`}
          </p>
        </div>
        <nav className="leg-filtros" aria-label="Escolha a casa e o ano">
          <div className="chips" role="list">
            <Link role="listitem" className={`chip${escolha.casa === "senado" ? " on" : ""}`} href={href({ casa: "senado", partido: undefined })} aria-current={escolha.casa === "senado" ? "true" : undefined}>Senado</Link>
            <Link role="listitem" className={`chip${escolha.casa === "camara" ? " on" : ""}`} href={href({ casa: "camara", partido: undefined })} aria-current={escolha.casa === "camara" ? "true" : undefined}>Câmara</Link>
            <span className="leg-sep" aria-hidden="true" />
            <span className="leg-rot">Assembleias</span>
            {UFS_PROJETO.map((uf) => {
              const on = escolha.casa === "assembleia" && escolha.uf === uf;
              return <Link role="listitem" key={uf} className={`chip${on ? " on" : ""}`} href={href({ casa: `al-${uf.toLowerCase()}`, partido: undefined })} aria-current={on ? "true" : undefined} title={nomeCasa({ casa: "assembleia", uf })}>{uf}</Link>;
            })}
          </div>
          <div className="chips" role="list" aria-label="Eleição">
            {ANOS_LEGISLATIVO.map((a) => <Link role="listitem" key={a} className={`chip${a === ano ? " on" : ""}`} href={href({ ano: String(a), partido: undefined })} aria-current={a === ano ? "true" : undefined}>{a}</Link>)}
          </div>
        </nav>
        <div className="leg-alternar">
          <nav className="alternar" aria-label="Leitura do plenário">
            {LEITURAS.map((l) => <Link key={l.id} href={href({ ver: l.id })} scroll={false} aria-current={l.id === leitura ? "true" : undefined}>{l.rotulo}</Link>)}
          </nav>
          {nacional && (
            <nav className="alternar" aria-label="Recorte do plenário">
              <Link href={href({ recorte: undefined })} scroll={false} aria-current={recorte === "inteiro" ? "true" : undefined}><span className="so-largo">Plenário </span>inteiro · {PLENARIO_NACIONAL[escolha.casa as "senado" | "camara"]}</Link>
              <Link href={href({ recorte: "estados" })} scroll={false} aria-current={recorte === "estados" ? "true" : undefined}><span className="so-largo">Só os </span>6 estados · {cadeiras.length + vagasSem}</Link>
            </nav>
          )}
        </div>
      </section>

      <div className="quadro leg-corpo" id="plenario">
        <section className="bloco s7 leg-plenario" aria-labelledby="h-plen">
          <h2 id="h-plen" className="sr-only">Plenário</h2>
          <div className="plenario-caixa" id="plenario-caixa">
            <Plenario lugares={lugares} desenho={desenho} rotulos={maiores} numero={centro.numero} legenda={centro.legenda}
              titulo={`${nome}, ${ano}: ${inteiro(cadeiras.length)} cadeiras na base${total > cadeiras.length ? ` de ${inteiro(total)}` : ""}, coloridas por ${LEITURAS.find((l) => l.id === leitura)!.rotulo.toLowerCase()}. A tabela das bancadas ao lado traz os mesmos números.`} />
            <DicaPlenario alvo="plenario-caixa" />
            <p className="plen-legenda-texto" aria-hidden="true">{centro.legenda}</p>
          </div>
          {cadeiras.length > 0 && <Legenda leitura={leitura} cortes={cortes} media={res.viesMedio} fora={lugares.some((l) => l.tipo === "fora")} semResultado={ufsSem.length > 0} />}
          {ufsSem.length > 0 && (
            <p className="leg-nota aviso-causa">
              <b>Sem resultado na base:</b> {ufsSem.map((u) => NOME_UF[u]).join(", ")} em {ano}. Há {cargo === "senador" ? "candidaturas" : "candidatos"}, mas nenhum eleito carregado; essas {inteiro(vagasSem)} cadeiras aparecem tracejadas.
            </p>
          )}
          {nacional && recorte === "inteiro" && (
            <p className="leg-nota">Cadeiras em contorno são de outros estados, que ainda não estão na base: das {inteiro(total)}, só {inteiro(cadeiras.length)} vêm de AP, ES, MG, PE, RJ e RR. Cada cadeira na base segue a ordem do viés do partido; as de fora só completam o desenho.</p>
          )}
        </section>

        <section className="bloco s5 leg-bancadas" aria-labelledby="h-banc">
          {manchete && <p className="manchete pequena">{manchete}</p>}
          <h2 id="h-banc">Bancadas</h2>
          {lista.length === 0 ? <p className="muted">Nenhum eleito desta casa em {ano} na base.</p> : (
            <div className="tabela-rolar leg-tabela">
              <table>
                <caption className="sr-only">Bancadas de {nome} em {ano}, por {LEITURAS.find((l) => l.id === leitura)!.rotulo.toLowerCase()}</caption>
                <thead><Cabecalhos leitura={leitura} /></thead>
                <tbody>
                  {ordenadas.map((b) => {
                    const i = indice.get(b.sigla)!;
                    const on = partido === b.sigla;
                    return (
                      <tr key={b.sigla} data-b={i} aria-current={on ? "true" : undefined}>
                        <th scope="row">
                          <Link href={href({ partido: on ? undefined : b.sigla }, on ? "plenario" : "membros")} scroll={false}>
                            {(leitura === "vies" || leitura === "partido") && <span className={`amostra ${leitura === "vies" ? classeVies(b.score) : classePartido(i)}`} aria-hidden="true" />}
                            {b.sigla}
                          </Link>
                        </th>
                        <td>{inteiro(b.cadeiras)}</td>
                        <Celulas leitura={leitura} b={b} total={res.cadeiras} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {lista.length > 0 && <p className="escala">
            {leitura === "vies" && <>Viés do partido pelo qual a pessoa foi eleita, de −100 (esquerda) a +100 (direita), na pesquisa com parlamentares; ± é o erro padrão. {fontesUsadas.length > 0 && <>Com <abbr title="valor que não foi medido diretamente nesta onda da pesquisa">*</abbr>: {fontesUsadas.map((f) => ROTULO_FONTE[f] ?? f).join("; ")}.</>}</>}
            {leitura === "custo" && <>Custo por cadeira: tudo o que as campanhas do partido a {cargo} gastaram em {ano}, inclusive as derrotadas, ÷ cadeiras que ganhou. {escolha.casa === "senado" && `Só entram as cadeiras disputadas em ${ano}.`} {res.semPrestacao > 0 && `${inteiro(res.semPrestacao)} candidatos não entregaram a prestação final e contam como gasto zero.`}</>}
            {leitura === "partido" && <>Aproveitamento: cadeiras ganhas em {ano} ÷ candidatos que o partido lançou. As cores só separam bancadas vizinhas; não representam os partidos.</>}
            {leitura === "renovacao" && <>Reeleito: venceu para a mesma casa e estado na eleição anterior{escolha.casa === "senado" ? " (oito anos antes, no Senado)" : ""}. Já eleito: venceu outra eleição desde 1998, para qualquer cargo. Estreante: nenhuma vitória na base.</>}
            {" "}Escolha um partido para ver quem são.
          </p>}
        </section>
      </div>

      {bancadaEscolhida && (
        <section className="card leg-membros" id="membros" aria-labelledby="h-membros">
          <div className="leg-membros-topo">
            <h2 id="h-membros">{bancadaEscolhida.sigla}: {inteiro(membros.length)} {membros.length === 1 ? "cadeira" : "cadeiras"}</h2>
            <Link className="chip" href={href({ partido: undefined })} scroll={false}>Mostrar todos os partidos</Link>
          </div>
          <ul className="leg-lista">
            {membros.map((c) => (
              <li key={c.id_candidatura}>
                <span className={`amostra ${classeDe(c)}`} aria-hidden="true" />
                <Link href={`/candidato/${c.id_candidato}`}>{c.nome}</Link>
                <span className="muted">{c.uf}{escolha.casa === "senado" ? ` · eleito em ${c.ano_eleicao}` : ""}</span>
                <span className="leg-lista-valor">{leitura === "partido" ? ROTULO_RENOVACAO[c.renovacao] : valorDe(c)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {METODOLOGIA.legislativo.calculo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Cabecalhos({ leitura }: { leitura: Leitura }) {
  const fim = {
    vies: <><th scope="col">Viés</th><th scope="col">±</th></>,
    custo: <><th scope="col">Por cadeira</th><th scope="col">Eleito típico</th></>,
    partido: <><th scope="col"><abbr title="parte das cadeiras da casa">%</abbr></th><th scope="col">Candidatos</th><th scope="col"><abbr title="cadeiras ganhas ÷ candidatos lançados">Aproveit.</abbr></th></>,
    renovacao: <><th scope="col">Reeleitos</th><th scope="col">Já eleitos</th><th scope="col">Estreantes</th></>,
  }[leitura];
  return <tr><th scope="col">Partido</th><th scope="col">Cadeiras</th>{fim}</tr>;
}

function Celulas({ leitura, b, total }: { leitura: Leitura; b: ReturnType<typeof montarBancadas>[number]; total: number }) {
  if (leitura === "vies") return <><td>{fmtVies(b.score, 0)}{b.fonte && b.fonte !== "bls" && <abbr title={ROTULO_FONTE[b.fonte] ?? b.fonte}>*</abbr>}</td><td className="muted">{b.erro === null ? "—" : b.erro.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td></>;
  if (leitura === "custo") return <><td>{b.custoPorCadeira === null ? "—" : `R$ ${compacto(b.custoPorCadeira)}`}</td><td className="muted">{b.gastoMediano === null ? "—" : `R$ ${compacto(b.gastoMediano)}`}</td></>;
  if (leitura === "partido") return <><td>{pct(b.cadeiras / total, 0)}</td><td className="muted">{inteiro(b.candidatos)}</td><td>{b.candidatos ? pct(b.ganhasNoAno / b.candidatos, 0) : "—"}</td></>;
  return <><td>{inteiro(b.reeleitos)}</td><td>{inteiro(b.jaEleitos)}</td><td>{inteiro(b.estreantes)}</td></>;
}

function Legenda({ leitura, cortes, media, fora, semResultado }: { leitura: Leitura; cortes: [number, number, number] | null; media: number | null; fora: boolean; semResultado: boolean }) {
  const vazias = (fora || semResultado) && (
    <ul className="leg-legenda-vazias">
      {fora && <li><span className="amostra vazia" aria-hidden="true" />outro estado</li>}
      {semResultado && <li><span className="amostra vazia sem-resultado" aria-hidden="true" />sem resultado</li>}
    </ul>
  );
  if (leitura === "vies") {
    return (
      <div className="leg-legenda">
        <div className="leg-escala" role="img" aria-label="Cores do viés, em sete faixas: −100 a −60, −60 a −30, −30 a −10, −10 a +10, +10 a +30, +30 a +60 e +60 a +100">
          <span className="leg-polo">esquerda</span>
          <span className="leg-barra" aria-hidden="true">
            {FAIXAS_VIES.map((f) => <span key={f.classe} className={`amostra ${f.classe}`} />)}
            {media !== null && <span className="leg-media" style={{ left: `${(posicaoNaEscala(media) * 100).toFixed(1)}%` }} />}
          </span>
          <span className="leg-polo">direita</span>
          <span className="leg-marcas" aria-hidden="true">{["−100", "−60", "−30", "−10", "+10", "+30", "+60", "+100"].map((m) => <span key={m}>{m}</span>)}</span>
        </div>
        {vazias}
      </div>
    );
  }
  const itens: { classe: string; rotulo: string }[] =
    leitura === "custo" ? (cortes ? [
      { classe: "c-1", rotulo: `até ${reais(cortes[0])}` }, { classe: "c-2", rotulo: `até ${reais(cortes[1])}` },
      { classe: "c-3", rotulo: `até ${reais(cortes[2])}` }, { classe: "c-4", rotulo: `mais de ${reais(cortes[2])}` }, { classe: "c-nd", rotulo: "sem dado" },
    ] : [{ classe: "c-nd", rotulo: "sem dado de gasto" }])
    : leitura === "renovacao" ? (["reeleito", "ja_eleito", "estreante"] as const).map((r) => ({ classe: classeRenovacao(r), rotulo: ROTULO_RENOVACAO[r] }))
    : [];
  return (
    <div className="leg-legenda">
      {leitura === "custo" && <span className="leg-polo">Gasto do eleito</span>}
      <ul>
        {itens.map((it) => <li key={it.classe}><span className={`amostra ${it.classe}`} aria-hidden="true" />{it.rotulo}</li>)}
        {leitura === "partido" && <li>Cada cor é uma bancada; vizinhas nunca repetem.</li>}
      </ul>
      {vazias}
    </div>
  );
}
