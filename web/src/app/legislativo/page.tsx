import type { Metadata } from "next";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { NOME_UF } from "@/lib/financiamento";
import { compacto, inteiro, pct, reais } from "@/lib/format";
import {
  ANOS_LEGISLATIVO, FAIXAS_VIES, LEITURAS, PLENARIO_NACIONAL, ROTULO_FAIXA, ROTULO_FONTE, ROTULO_RENOVACAO, UFS_PROJETO,
  bancadas as montarBancadas, cadeirasDaCasa, chaveCasa, classeCusto, classePartido, classeRenovacao, classeVies, faixaVies, fmtVies,
  lerCasa, legislatura, lugares as montarLugares, mediana, nomeCasa, ordenarCadeiras, posicaoNaEscala, quartis, resumo as montarResumo,
  semResultado, siglaNaComposicao, vagasDaCasa,
  type Bancada, type Escolha, type Faixa, type Leitura, type LinhaCadeira, type LinhaGastoPartido, type LinhaSemResultado, type LinhaVagas,
  type Ordem, type Recorte,
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
const mi = (v: number) => `R$ ${compacto(v)}`;

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
  // só na leitura Custo: ordem das cadeiras pelo gasto e filtro por faixa do viés
  const ordem: Ordem = leitura === "custo" && (um(sp.ordem) === "maior" || um(sp.ordem) === "menor") ? (um(sp.ordem) as Ordem) : "padrao";
  const faixaPedida = um(sp.faixa);
  const faixa: Faixa | undefined = leitura === "custo" && FAIXAS_VIES.some((f) => f.id === faixaPedida) ? (faixaPedida as Faixa) : undefined;

  const cadeiras = cadeirasDaCasa(todas, ano, escolha);
  const ufsSem = semResultado(semRes, ano, escolha);
  const vagasSem = vagasDaCasa(vagas, ano, escolha, ufsSem);
  const total = recorte === "inteiro" && nacional ? PLENARIO_NACIONAL[escolha.casa as "senado" | "camara"] : cadeiras.length + vagasSem;
  const lugares = montarLugares(ordenarCadeiras(cadeiras, leitura, ordem), total, vagasSem);
  const lista = montarBancadas(cadeiras, gastos, ano, escolha);
  const indice = new Map(lista.map((b, i) => [b.sigla, i]));
  const res = montarResumo(cadeiras, gastos, ano, escolha, ufsSem);
  const cortes = quartis(cadeiras.map((c) => c.gasto).filter((v): v is number => v !== null));
  const nome = nomeCasa(escolha);
  const cargo = CARGO[escolha.casa];

  const href = (novo: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const atual = { casa: chaveCasa(escolha), ano: String(ano), ver: leitura, recorte: recorte === "estados" ? "estados" : undefined,
      ordem: ordem === "padrao" ? undefined : ordem, faixa };
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v && !(k === "casa" && v === "camara") && !(k === "ano" && v === "2022") && !(k === "ver" && v === "vies")) p.set(k, v);
    const q = p.toString();
    return `/legislativo${q ? `?${q}` : ""}`;
  };

  // ---------- cor e ficha de cada cadeira ----------
  const classeDe = (c: LinhaCadeira): string =>
    leitura === "vies" ? classeVies(c.score) : leitura === "custo" ? classeCusto(c.gasto, cortes) : leitura === "renovacao" ? classeRenovacao(c.renovacao) : classePartido(c.sigla);
  const gastoDe = (c: LinhaCadeira) => c.gasto === null ? (c.ano_eleicao < 2018 ? "sem dados (eleito antes de 2018)" : "sem prestação de contas final") : reais(c.gasto);
  const resumoBancada = (b: Bancada) =>
    `Bancada ${b.sigla}: ${b.cadeiras} ${b.cadeiras === 1 ? "cadeira" : "cadeiras"} (${pct(b.cadeiras / cadeiras.length, 0)})` +
    (b.custoPorCadeira !== null ? ` · ${mi(b.custoPorCadeira)} de campanha por cadeira ganha` : "");
  const desenho = ({ cadeira: c }: { cadeira: LinhaCadeira }): CadeiraDesenho => {
    const b = lista[indice.get(c.sigla)!];
    const vies = c.score === null ? "" : `${fmtVies(c.score, 0)}${c.erro_padrao !== null ? ` ± ${Math.round(c.erro_padrao)}` : ""}${c.fonte && c.fonte !== "bls" ? ` (${ROTULO_FONTE[c.fonte] ?? c.fonte})` : ""}`;
    return {
      classe: classeDe(c), bancada: indice.get(c.sigla)!, href: `/candidato/${c.id_candidato}`,
      grupo: leitura === "renovacao" ? c.renovacao : c.sigla,
      apagada: faixa !== undefined && (c.score === null || faixaVies(c.score) !== faixa),
      titulo: `${c.nome} · ${c.sigla} · ${c.uf}${c.score !== null ? ` · ${ROTULO_FAIXA[faixaVies(c.score)]} (${fmtVies(c.score, 0)})` : ""}`,
      ficha: {
        n: c.nome, s: `${c.sigla} · ${NOME_UF[c.uf] ?? c.uf}`, id: String(c.id_candidato), e: `Eleito em ${c.ano_eleicao}`,
        f: c.score === null ? "" : faixaVies(c.score), fr: c.score === null ? "" : ROTULO_FAIXA[faixaVies(c.score)], vies,
        g: gastoDe(c), r: ROTULO_RENOVACAO[c.renovacao], bc: resumoBancada(b),
      },
    };
  };
  // rótulos de fora do arco: os blocos na Renovação; as maiores bancadas nas outras leituras (sem rótulo quando o Custo
  // reordena as cadeiras pelo gasto, porque aí os partidos se espalham)
  const rotulos = leitura === "renovacao"
    ? (["reeleito", "ja_eleito", "estreante"] as const).filter((r) => cadeiras.some((c) => c.renovacao === r))
        .map((r) => ({ grupo: r, texto: `${ROTULO_RENOVACAO[r]} · ${cadeiras.filter((c) => c.renovacao === r).length}` }))
    : ordem !== "padrao" ? []
    : [...lista].sort((a, b) => b.cadeiras - a.cadeiras).filter((b) => b.cadeiras >= Math.max(2, cadeiras.length * 0.03))
        .map((b) => ({ grupo: b.sigla, texto: b.sigla }));
  const gastoTipicoFaixa = faixa ? mediana(cadeiras.filter((c) => c.score !== null && faixaVies(c.score) === faixa && c.gasto !== null).map((c) => c.gasto!)) : null;

  const centro = (() => {
    if (!cadeiras.length) return { numero: "", legenda: "sem resultado na base" };
    if (leitura === "vies") return { numero: fmtVies(res.viesMedio), legenda: `viés médio: ${ROTULO_FAIXA[faixaVies(res.viesMedio ?? 0)].toLowerCase()}` };
    if (leitura === "custo" && faixa) return { numero: gastoTipicoFaixa === null ? "—" : mi(gastoTipicoFaixa), legenda: `gasto típico: ${ROTULO_FAIXA[faixa].toLowerCase()}` };
    if (leitura === "custo") return { numero: res.custoCadeira === null ? "—" : mi(res.custoCadeira), legenda: "custo de uma cadeira" };
    if (leitura === "partido") return { numero: String(res.partidos), legenda: res.partidos === 1 ? "partido" : "partidos" };
    return { numero: pct(res.reeleitos / res.cadeiras, 0), legenda: "reeleitos" };
  })();

  // passar o mouse numa cadeira destaca a bancada inteira, só com CSS: uma regra por bancada
  const realce = lista.map((_, i) =>
    `.leg:has(.cad[data-b="${i}"]:hover) .cad:not([data-b="${i}"]){opacity:.18}`,
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
            <Link role="listitem" className={`chip${escolha.casa === "senado" ? " on" : ""}`} href={href({ casa: "senado" })} aria-current={escolha.casa === "senado" ? "true" : undefined}>Senado</Link>
            <Link role="listitem" className={`chip${escolha.casa === "camara" ? " on" : ""}`} href={href({ casa: "camara" })} aria-current={escolha.casa === "camara" ? "true" : undefined}>Câmara</Link>
            <span className="leg-sep" aria-hidden="true" />
            <span className="leg-rot">Assembleias</span>
            {UFS_PROJETO.map((uf) => {
              const on = escolha.casa === "assembleia" && escolha.uf === uf;
              return <Link role="listitem" key={uf} className={`chip${on ? " on" : ""}`} href={href({ casa: `al-${uf.toLowerCase()}` })} aria-current={on ? "true" : undefined} title={nomeCasa({ casa: "assembleia", uf })}>{uf}</Link>;
            })}
          </div>
          <div className="chips" role="list" aria-label="Eleição">
            {ANOS_LEGISLATIVO.map((a) => <Link role="listitem" key={a} className={`chip${a === ano ? " on" : ""}`} href={href({ ano: String(a) })} aria-current={a === ano ? "true" : undefined}>{a}</Link>)}
          </div>
        </nav>
        <div className="leg-alternar">
          <nav className="alternar" aria-label="Leitura do plenário">
            {LEITURAS.map((l) => <Link key={l.id} href={href({ ver: l.id })} scroll={false} aria-current={l.id === leitura ? "true" : undefined}>{l.rotulo}</Link>)}
          </nav>
          {nacional && (
            <nav className="alternar" aria-label="Recorte do plenário">
              <Link href={href({ recorte: undefined })} scroll={false} aria-current={recorte === "inteiro" ? "true" : undefined}>Plenário inteiro · {PLENARIO_NACIONAL[escolha.casa as "senado" | "camara"]}</Link>
              <Link href={href({ recorte: "estados" })} scroll={false} aria-current={recorte === "estados" ? "true" : undefined}>Só os 6 estados · {cadeiras.length + vagasSem}</Link>
            </nav>
          )}
        </div>
      </section>

      <section className="bloco leg-plenario" id="plenario" aria-labelledby="h-plen">
        <h2 id="h-plen" className="sr-only">Plenário</h2>
        {leitura === "custo" && cadeiras.length > 0 && (
          <div className="leg-controles">
            <nav className="alternar" aria-label="Ordem das cadeiras">
              {([["padrao", "Ordem do viés"], ["maior", "Maior gasto"], ["menor", "Menor gasto"]] as const).map(([id, rot]) => (
                <Link key={id} href={href({ ordem: id === "padrao" ? undefined : id })} scroll={false} aria-current={ordem === id ? "true" : undefined}>{rot}</Link>
              ))}
            </nav>
            <nav className="chips leg-faixa" aria-label="Filtrar por faixa do viés">
              <Link className={`chip${!faixa ? " on" : ""}`} href={href({ faixa: undefined })} scroll={false} aria-current={!faixa ? "true" : undefined}>Todos</Link>
              {FAIXAS_VIES.map((f) => (
                <Link key={f.id} className={`chip${faixa === f.id ? " on" : ""}`} href={href({ faixa: faixa === f.id ? undefined : f.id })} scroll={false} aria-current={faixa === f.id ? "true" : undefined}>
                  <span className={`amostra v-${f.id}`} aria-hidden="true" />{f.rotulo}
                </Link>
              ))}
            </nav>
          </div>
        )}
        <div className="plenario-caixa" id="plenario-caixa">
          <Plenario lugares={lugares} desenho={desenho} rotulos={rotulos} numero={centro.numero} legenda={centro.legenda}
            titulo={`${nome}, ${ano}: ${inteiro(cadeiras.length)} cadeiras na base${total > cadeiras.length ? ` de ${inteiro(total)}` : ""}, coloridas por ${LEITURAS.find((l) => l.id === leitura)!.rotulo.toLowerCase()}.`} />
          <DicaPlenario alvo="plenario-caixa" />
        </div>
        {cadeiras.length > 0 && (
          <div className="leg-rodape">
            <Legenda leitura={leitura} cortes={cortes} media={res.viesMedio} fora={lugares.some((l) => l.tipo === "fora")} semResultado={ufsSem.length > 0} />
            {ordem !== "padrao" && <p className="leg-ordem">Cadeiras do {ordem === "maior" ? "maior para o menor" : "menor para o maior"} gasto, da esquerda para a direita; sem dado de gasto no fim.</p>}
          </div>
        )}
        {ufsSem.length > 0 && (
          <p className="leg-nota aviso-causa">
            <b>Sem resultado na base:</b> {ufsSem.map((u) => NOME_UF[u]).join(", ")} em {ano}. Há {cargo === "senador" ? "candidaturas" : "candidatos"}, mas nenhum eleito carregado; essas {inteiro(vagasSem)} cadeiras aparecem tracejadas.
          </p>
        )}
        {nacional && recorte === "inteiro" && (
          <p className="leg-nota">Cadeiras em contorno são de outros estados, que ainda não estão na base: das {inteiro(total)}, só {inteiro(cadeiras.length)} vêm de AP, ES, MG, PE, RJ e RR. As cadeiras na base seguem a ordem do viés do partido; as de fora só completam o desenho.</p>
        )}
      </section>

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {METODOLOGIA.legislativo.calculo.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
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
        <div className="leg-escala" role="img" aria-label="Faixas do viés: esquerda (−100 a −60), centro-esquerda (−60 a −20), centro (−20 a +20), centro-direita (+20 a +60) e direita (+60 a +100)">
          <span className="leg-barra" aria-hidden="true">
            {FAIXAS_VIES.map((f) => <span key={f.id} className={`amostra v-${f.id}`} />)}
            {media !== null && <span className="leg-media" style={{ left: `${(posicaoNaEscala(media) * 100).toFixed(1)}%` }} />}
          </span>
          <span className="leg-faixas" aria-hidden="true">{FAIXAS_VIES.map((f) => <span key={f.id}>{f.rotulo}</span>)}</span>
          <span className="leg-marcas" aria-hidden="true">{["−100", "−60", "−20", "+20", "+60", "+100"].map((m) => <span key={m}>{m}</span>)}</span>
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
      {leitura === "custo" && <span className="leg-polo">Gasto do eleito (quartos da casa)</span>}
      <ul>
        {itens.map((it) => <li key={it.classe}><span className={`amostra ${it.classe}`} aria-hidden="true" />{it.rotulo}</li>)}
        {leitura === "partido" && <li>Cores aproximadas da identidade de cada partido. Passe o mouse numa cadeira para ver a bancada.</li>}
      </ul>
      {vazias}
    </div>
  );
}
