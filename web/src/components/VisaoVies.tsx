import type { ReactNode } from "react";
import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { classe, correlacao, enquadrar, nomeProprio, quantis, tendencia, type LinhaMunicipio } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { naRegua, type FichaDica } from "@/lib/dica";
import { NOME_UF } from "@/lib/financiamento";
import { compacto, pct } from "@/lib/format";
import { eixoNum } from "@/lib/grafico";
import { fmtVies, preposicaoUf } from "@/lib/legislativo";
import { centrarLupa, TELA } from "@/lib/lupa";
import {
  ANOS_VIES, CARGOS_VIES, CORTES_VIES, MAJORITARIOS, MEDIDAS_IDADE, cargoNoAno, classeMapaVies, compararIdade, compararVies, escolhaVies, extremosVies, fmtIdade, idadePorMunicipio,
  lerRelacao, lerSerie, medirIdade, medirVies, medirVotados, naReguaVies, paramsVies, parear, rotulosIdade, rotulosVies, serieVies, textoVies, viesDosMunicipios, viesPorMunicipio,
  votadosDosMunicipios, votadosPorMunicipio, type MedidaVies, type MedidaVotados,
  type EscolhaVies, type LinhaEleitorado, type LinhaPopulacao, type LinhaVies, type LinhaVotados, type Lugar,
} from "@/lib/vies";
import { Dispersao } from "./Dispersao";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { MiniMapa } from "./MiniMapa";
import { Rolar } from "./Rolar";
import { SerieVies } from "./SerieVies";

type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
const QUINTOS = ["q0", "q1", "q2", "q3", "q4"];
const DEGRAUS = Array.from({ length: CORTES_VIES.length + 1 }, (_, i) => `dv${i}`);

/**
 * Sub-abas Comparar › Viés (pergunta 7) e Comparar › Idade (pergunta 6) do mapa da página inicial, lidas da análise
 * `vies`. Viés: o mapa pinta o viés do município (média dos scores dos partidos ponderada pelos votos, nove degraus fixos do
 * vermelho ao azul) no cargo e ano escolhidos; o painel mostra a linha do tempo de 2018 a 2026 e, no estado, os
 * municípios mais à esquerda e à direita. Idade: o mapa pinta a idade do eleitorado (TSE) ou da população (Censo 2022),
 * em quintos dos municípios; o painel cruza essa idade com a dos candidatos votados ou com o viés, numa dispersão. As
 * contas são de src/lib/vies.ts.
 */
export async function VisaoVies({ menu, sp, municipios }: { menu: ReactNode; sp: SP; municipios: LinhaMunicipio[] }) {
  const esc = escolhaVies(sp);
  const { sub, ano, med, fonte, eixo } = esc;
  const cargo = cargoNoAno(esc.cargo, ano)!;
  const cargoMin = cargo.toLowerCase();
  const precisaVies = sub === "vies" || eixo === "vies";
  // duas leituras separadas: cada resposta fica abaixo do limite de cache do Next (2 MB)
  const [dadosV, dadosI] = await Promise.all([
    precisaVies ? lerAnalise("vies", ["vies"]) : Promise.resolve(null),
    sub === "idade" ? lerAnalise("vies", ["eleitorado", "votados", "populacao"]) : Promise.resolve(null),
  ]);
  const titulo = sub === "vies" ? "Viés político dos municípios" : "Idade do eleitorado e dos votados";
  if ((precisaVies && !dadosV?.vies) || (sub === "idade" && (!dadosI?.eleitorado || !dadosI.votados || !dadosI.populacao))) {
    return (
      <MapaVivo className="palco s12">
        {menu}
        <div className="palco-topo"><div><h1 id="h-mapa">{titulo}</h1></div></div>
        <div className="card aviso">
          <h2>{sub === "vies" ? "Viés" : "Idade"} indisponível</h2>
          <p>A API não devolveu a análise <code>vies</code>. Confira se ela está rodando (<code>uvicorn app.main:app</code> em <code>api/</code>).</p>
        </div>
      </MapaVivo>
    );
  }
  const linhasV = comoObjetos<LinhaVies>(dadosV?.vies);
  const idades = { eleitorado: comoObjetos<LinhaEleitorado>(dadosI?.eleitorado), populacao: comoObjetos<LinhaPopulacao>(dadosI?.populacao) };
  const votados = comoObjetos<LinhaVotados>(dadosI?.votados);

  // lugar: o município vem pelo código do IBGE (o mesmo no mapa estático e na análise)
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === um(sp.uf));
  const mun = uf ? municipios.find((m) => m.uf === uf && m.cod_ibge === um(sp.mun)) : undefined;
  const nomeMun = new Map(municipios.map((m) => [m.cod_ibge, nomeProprio(m.nome)]));
  const lugar: Lugar = { uf, ibge: mun?.cod_ibge };
  const nomeLugar = mun ? nomeMun.get(mun.cod_ibge)! : uf ? NOME_UF[uf] : "Os seis estados";
  const href = (nova: Partial<EscolhaVies> & { uf?: string | null; mun?: string | null }) => {
    const { uf: u, mun: m, ...resto } = nova;
    const ufN = u === undefined ? uf : u ?? undefined;
    const munN = u !== undefined && m === undefined ? undefined : m === undefined ? mun?.cod_ibge : m ?? undefined;
    return `/?${paramsVies({ ...esc, ...resto }, { uf: ufN, mun: munN })}#mapa`;
  };
  const codsUf = uf ? municipios.filter((m) => m.uf === uf).map((m) => m.cod_ibge) : [];
  const codsTodos = municipios.map((m) => m.cod_ibge);
  // a média de cima: o estado, para o município; os seis estados, para o estado
  const lugarRef: Lugar | null = mun ? { uf } : uf ? {} : null;
  const deUf = (u: string) => `${preposicaoUf(u)} ${NOME_UF[u] ?? u}`;   // "do Rio de Janeiro", "de Minas Gerais"
  const nomeRef = mun ? `a média ${deUf(uf!)}` : "os seis estados juntos";

  // valores do mapa: viés (degraus fixos) ou idade (quintos dos municípios dos seis estados)
  const medida = MEDIDAS_IDADE.find((m) => m.chave === med)!;
  const daFonte = fonte === "eleitorado" ? `eleitorado de ${ano}` : "população de 16 anos ou mais (Censo 2022)";
  // somas por município numa passada só pela tabela: a ficha de cada um lê daqui
  const viesMun = precisaVies ? viesDosMunicipios(linhasV, ano, cargo) : new Map<string, MedidaVies>();
  const votMun = sub === "idade" ? votadosDosMunicipios(votados, ano, cargo) : new Map<string, MedidaVotados>();
  const vMun = sub === "vies" ? viesPorMunicipio(linhasV, ano, cargo) : idadePorMunicipio(fonte, idades, ano, med);
  const cortesIdade = sub === "idade" ? quantis([...vMun.values()], 5) : [];
  const [minI, maxI] = sub === "idade" && vMun.size ? [Math.min(...vMun.values()), Math.max(...vMun.values())] : [0, 0];
  const classeDe = (v: number | null | undefined) => (sub === "vies" ? classeMapaVies(v) : v == null ? "sem" : `q${classe(v, cortesIdade)}`);
  const votadosDe = (l: Lugar) => (l.ibge ? votMun.get(l.ibge) ?? { idade: null, jovem: null, votos: 0 } : medirVotados(votados, ano, cargo, l));
  const viesDe = (l: Lugar) => (l.ibge ? viesMun.get(l.ibge) ?? { score: null, votos: 0, cobertura: null } : medirVies(linhasV, ano, cargo, l));
  const fichaDe = (titulo: string, subtitulo: string, v: number | null, l: Lugar): FichaDica => {
    if (v === null) return { titulo, sub: `${subtitulo} · sem dado`, medidas: [] };
    if (sub === "vies") {
      const m = viesDe(l);
      return {
        titulo, sub: subtitulo,
        medidas: [
          { rotulo: "Viés", valor: textoVies(v), cores: DEGRAUS, p: naReguaVies(v) },
          { rotulo: `Votos para ${cargoMin}`, valor: compacto(m.votos) },
        ],
      };
    }
    const vt = votadosDe(l);
    return {
      titulo, sub: subtitulo,
      medidas: [
        { rotulo: `${medida.rotulo} (${fonte === "eleitorado" ? "eleitorado" : "Censo"})`, valor: fmtIdade(v, med), cores: QUINTOS, p: naRegua(v, cortesIdade, minI, maxI) },
        { rotulo: `Idade média dos votados (${cargoMin})`, valor: fmtIdade(vt.idade, "media") },
      ],
    };
  };
  const valorDe = (l: Lugar) => (sub === "vies" ? viesDe(l).score : medirIdade(fonte, idades, ano, med, l));
  const fmtValor = (v: number | null) => (sub === "vies" ? fmtVies(v, 0) : v === null ? "—" : med === "media" ? Math.round(v).toString() : pct(v, 0));
  const subFicha = `${cargo} · ${ano}`;

  const estados: EstadoNoMapa[] = ufs.map((u) => {
    const v = valorDe({ uf: u });
    return {
      uf: u, classe: classeDe(v), href: href({ uf: u === uf ? null : u }), sigla: u, valor: fmtValor(v),
      descricao: `${NOME_UF[u] ?? u}: ${sub === "vies" ? `viés ${textoVies(v)} nos votos para ${cargoMin} em ${ano}` : `${medida.curto} do ${daFonte}, ${fmtIdade(v, med)}`}`,
      ficha: fichaDe(NOME_UF[u] ?? u, subFicha, v, { uf: u }),
    };
  });
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapa: MunicipioNoMapa[] = !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const v = vMun.get(m.cod_ibge) ?? null;
    const nome = nomeMun.get(m.cod_ibge)!;
    return {
      ibge: m.cod_ibge, classe: classeDe(v), href: href({ mun: m.cod_ibge === mun?.cod_ibge ? null : m.cod_ibge }),
      dica: v === null ? `${nome}: sem dado` : `${nome}: ${sub === "vies" ? `viés ${textoVies(v)}` : `${medida.curto} ${fmtIdade(v, med)}`}`,
      atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100,
      ficha: fichaDe(nome, `${NOME_UF[uf]} · ${subFicha}`, v, { ibge: m.cod_ibge }),
    };
  });
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const destaque = mun && centro ? { ibge: mun.cod_ibge, nome: nomeLugar, x: centro[0], y: centro[1] } : undefined;
  const algumSem = noMapa.some((m) => m.classe === "sem");
  const mapa = (
    <MapaAbstencao
      titulo={sub === "vies" ? `Viés dos votos para ${cargoMin} em ${ano}, ${uf ? `municípios ${deUf(uf)}` : "nos seis estados"}` : `${medida.rotulo} do ${daFonte}, ${uf ? `municípios ${deUf(uf)}` : "nos seis estados"}`}
      camera={camera} estados={estados} uf={uf} municipios={noMapa} destaque={destaque}
    />
  );
  // o mini-mapa que acompanha a rolagem vai ao município escolhido, ampliado 3 ×
  const focoMini = mun && centro && caixa ? centrarLupa({ x: camera.x + centro[0] * camera.k, y: camera.y + centro[1] * camera.k }, 3) : undefined;

  // painel
  const valor = valorDe(lugar);
  const valorRef = lugarRef ? valorDe(lugarRef) : null;
  const opcoesMun = uf ? municipios.filter((m) => m.uf === uf).map((m) => [m.cod_ibge, nomeMun.get(m.cod_ibge)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")) : [];
  const paramsSemMun = Object.fromEntries(paramsVies(esc, { uf }));
  const escolhaMun = uf ? <EscolhaMunicipio opcoes={opcoesMun} atual={mun?.cod_ibge} params={paramsSemMun} /> : null;
  const cabSobre = mun ? `Município · ${uf}` : uf ? `Estado · ${codsUf.length} municípios` : "AP, ES, MG, PE, RJ e RR";
  const majoritario = MAJORITARIOS.has(cargo);

  // viés: a série do lugar e a da referência, a medida e os extremos do estado
  const mv = viesDe(lugar);
  const serie = sub === "vies" ? serieVies(linhasV, esc.cargo, lugar) : [];
  const serieRef = sub === "vies" && lugarRef ? serieVies(linhasV, esc.cargo, lugarRef) : [];
  const textoSerie = lerSerie(serie);
  const extremos = sub === "vies" && uf && !mun ? extremosVies(vMun, codsUf) : null;
  const comparaVies = compararVies(valor, valorRef, nomeRef);

  // idade: a medida, os votados e a dispersão
  const vt = votadosDe(lugar);
  const vtRef = lugarRef ? votadosDe(lugarRef) : null;
  const universo = uf ? codsUf : codsTodos;
  const ys = eixo === "vies" ? viesPorMunicipio(linhasV, ano, cargo) : votadosPorMunicipio(votados, ano, cargo);
  const pontos = sub === "idade" ? parear(vMun, ys, universo, mun?.cod_ibge) : [];
  const r = correlacao(pontos);
  const rotuloX = `${medida.rotulo} (${fonte === "eleitorado" ? "eleitorado" : "Censo"})`;
  const rotuloY = eixo === "vies" ? "Viés" : "Idade média dos votados";
  const eixoY = pontos.length ? {
    ...eixoNum(Math.min(...pontos.map((p) => p.y)), Math.max(...pontos.map((p) => p.y))),
    formato: (v: number) => (eixo === "vies" ? fmtVies(v, 0) : `${v}`), rotulo: eixo === "vies" ? "viés" : "idade dos votados",
  } : undefined;
  const xNome = med === "media" ? "a idade média" : med === "jovens" ? "a parte de jovens" : "a parte de idosos";
  const yNome = eixo === "vies" ? "o viés (mais à direita)" : "a idade dos votados";
  const comparaIdade = compararIdade(valor, valorRef, med, nomeRef);

  const legenda = sub === "vies" ? (
    <div className="legenda-dv" role="img" aria-label={`Cores: viés do município em nove faixas fixas, de ${rotulosVies()[0]} (vermelho, esquerda) a ${rotulosVies()[8]} (azul, direita)`}>
      <div className="dv-cores">{DEGRAUS.map((c) => <i key={c} className={c} />)}</div>
      <div className="dv-marcas" aria-hidden="true">
        {CORTES_VIES.map((c, i) => <span key={c} style={{ gridColumn: `${i + 1} / span 2` }}>{fmtVies(c, 0)}</span>)}
      </div>
      <div className="dv-pontas" aria-hidden="true"><span>← esquerda</span><span>direita →</span></div>
      {algumSem && <p className="dv-sem"><i className="sem" />sem dado</p>}
    </div>
  ) : (
    <ul className="legenda-q" aria-label={`Cores: ${medida.curto} do ${daFonte}; cada cor reúne um quinto dos municípios dos seis estados`}>
      {rotulosIdade(cortesIdade, med).map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
      {algumSem && <li className="legenda-sem"><i className="sem" />sem dado</li>}
    </ul>
  );

  return (
    <>
      <MapaVivo className="palco s12" estado={uf}>
        {menu}
        <div className="palco-topo">
          <div>
            {sub === "vies" ? (
              <>
                <h1 id="h-mapa">Viés político dos votos em {ano}</h1>
                <p className="palco-sobre">{cargo} · 1º turno · média dos partidos, ponderada pelos votos</p>
              </>
            ) : (
              <>
                <h1 id="h-mapa">{medida.rotulo} do {fonte === "eleitorado" ? `eleitorado em ${ano}` : "Censo 2022"}</h1>
                <p className="palco-sobre">{fonte === "eleitorado" ? "Eleitores aptos (TSE)" : "População de 16 anos ou mais"} · cruzada com os votos para {cargoMin}</p>
              </>
            )}
          </div>
          <nav className="trilha" aria-label="Onde você está no mapa">
            <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
            {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
            {mun && <><span aria-hidden="true">/</span><span aria-current="true">{nomeLugar}</span></>}
          </nav>
        </div>
        <div className="palco-mapa">
          {mapa}
          {!uf && <p className="palco-dica" aria-hidden="true">Clique num estado para ver os municípios</p>}
        </div>
        <div className="palco-base">
          {legenda}
          <div className="anos" role="group" aria-label="Ano da eleição">
            {ANOS_VIES.map((a) => (
              <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                {a}<small>{a % 4 === 0 ? "Municipal" : "Geral"}</small>
              </Link>
            ))}
          </div>
        </div>
      </MapaVivo>

      {sub === "vies" ? (
        <div className="painel s12" key={`vies-${uf}-${mun?.cod_ibge}-${ano}-${esc.cargo}`}>
          <div className="bloco noite painel-cab s4">
            <p className="palco-sobre">{cabSobre}</p>
            <h2>{nomeLugar}</h2>
            {mv.score !== null ? (
              <>
                <p className="painel-num"><Rolar valor={fmtVies(mv.score)} /></p>
                <p><b>{textoVies(mv.score).split(" · ")[1]}</b>: a média do viés dos partidos, ponderada pelos {compacto(mv.votos)} votos para {cargoMin} em {ano} (1º turno). A escala vai de −100 (esquerda) a +100 (direita).</p>
                {comparaVies && <p className="vies-compara">{comparaVies}</p>}
                {mv.cobertura !== null && mv.cobertura < 0.995 && <p className="muted pequeno">{pct(1 - mv.cobertura, 1)} dos votos foram para partidos sem score e ficaram fora da média.</p>}
              </>
            ) : <p>Sem votos com viés para {cargoMin} em {ano}.</p>}
            {escolhaMun}
          </div>

          <div className="bloco noite s8">
            <h3>Viés eleição a eleição</h3>
            {textoSerie && <p className="r-texto">{textoSerie}</p>}
            {serie.length > 0 ? (
              <SerieVies
                serie={serie} ano={ano} referencia={lugarRef && serieRef.length ? { rotulo: nomeRef, serie: serieRef } : undefined}
                descricao={`Viés de ${nomeLugar} por eleição: ${serie.map((p) => `${p.ano} ${fmtVies(p.score)}`).join(", ")}${serieRef.length ? `; ${nomeRef}: ${serieRef.map((p) => `${p.ano} ${fmtVies(p.score)}`).join(", ")}` : ""}`}
              />
            ) : <p>Sem votos com viés para este cargo aqui.</p>}
            <p className="muted pequeno vies-nota">
              {`${CARGOS_VIES.find((c) => c.chave === esc.cargo)!.rotulo}: só os anos em que o cargo foi disputado (${ANOS_VIES.filter((a) => cargoNoAno(esc.cargo, a)).join(", ")}). `}
              {lugarRef && serieRef.length > 0 && <>Tracejado: {nomeRef}. </>}
              O score de cada partido é o da eleição daquele ano, então a linha mexe quando o eleitor muda de partido e quando o partido muda de posição.
            </p>
          </div>

          {extremos && (
            <div className="bloco noite s12 vies-extremos">
              <h3>Os municípios mais à esquerda e mais à direita {deUf(uf!)}</h3>
              <p className="muted pequeno">Votos para {cargoMin} em {ano}. Clique para ver o município.</p>
              <div className="vies-colunas">
                {([["Mais à esquerda", extremos.esq], ["Mais à direita", extremos.dir]] as const).map(([rot, lista]) => (
                  <div key={rot}>
                    <h4>{rot}</h4>
                    <ol>
                      {lista.map((x) => (
                        <li key={x.cod}>
                          <a href={href({ mun: x.cod })} data-mapa=""><i className={classeMapaVies(x.v)} aria-hidden="true" /><span>{nomeMun.get(x.cod)}</span><b>{fmtVies(x.v)}</b></a>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ul className="atalhos s12">
            <li><Link href="/sobre#p7">Como calculamos</Link></li>
            <li><Link href="/legislativo">Quem ocupa as cadeiras do Legislativo</Link></li>
          </ul>
        </div>
      ) : (
        <div className="painel s12" key={`idade-${uf}-${mun?.cod_ibge}-${ano}-${esc.cargo}-${med}-${fonte}-${eixo}`}>
          <div className="bloco noite painel-cab s4">
            <p className="palco-sobre">{cabSobre}</p>
            <h2>{nomeLugar}</h2>
            {valor !== null ? (
              <>
                <p className="painel-num"><Rolar valor={fmtIdade(valor, med)} /></p>
                <p>{med === "media" ? "é a idade média" : `${med === "jovens" ? "têm de 16 a 29 anos" : "têm 60 anos ou mais"}`} {med === "media" ? `do ${daFonte}` : `no ${daFonte}`}.</p>
                {comparaIdade && <p className="vies-compara">{comparaIdade}</p>}
                {vt.idade !== null && (
                  <p>Os candidatos a {cargoMin} votados ali tinham, em média, <b>{fmtIdade(vt.idade, "media")}</b> (ponderado pelos votos){vtRef?.idade != null ? `; em ${nomeRef}, ${fmtIdade(vtRef.idade, "media")}` : ""}. {vt.jovem !== null && `${pct(vt.jovem, 1)} dos votos foram para quem tinha até 29 anos.`}</p>
                )}
              </>
            ) : <p>Sem dado de idade.</p>}
            {escolhaMun}
          </div>

          <div className="bloco noite s8 bloco-dispersao">
            <div>
              <h3>{medida.rotulo} × {rotuloY.toLowerCase()}</h3>
              <nav className="chips" aria-label="Eixo vertical">
                <Link scroll={false} className={`chip${eixo === "votados" ? " on" : ""}`} href={href({ eixo: "votados" })} aria-current={eixo === "votados" ? "true" : undefined}>Idade dos votados</Link>
                <Link scroll={false} className={`chip${eixo === "vies" ? " on" : ""}`} href={href({ eixo: "vies" })} aria-current={eixo === "vies" ? "true" : undefined}>Viés</Link>
              </nav>
              {pontos.length >= 3 ? (
                <>
                  <p className="r-texto">{r != null && lerRelacao(r, xNome, yNome)}{r != null && <small> (r = {r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })})</small>}</p>
                  <p className="muted pequeno vies-nota">
                    Cada ponto é um município {uf ? deUf(uf) : "dos seis estados"}{mun ? "; o círculo grande é o escolhido" : ""}. Votos para {cargoMin} em {ano}.
                    {" "}O TSE não diz em quem cada eleitor votou: a relação é entre municípios, não entre pessoas. Correlação não é causa.
                    {majoritario && " Com poucos candidatos por lugar, a idade dos votados reflete onde cada candidato é forte, mais do que a idade de quem votou."}
                  </p>
                </>
              ) : <p>Poucos municípios com os dois dados.</p>}
            </div>
            {pontos.length >= 3 && eixoY && (
              <Dispersao
                pontos={pontos} tendencia={tendencia(pontos)} rotuloX={rotuloX} eixoY={eixoY}
                formatoX={(v) => fmtIdade(v, med)}
                descricao={`Cada ponto é um município ${uf ? deUf(uf) : "dos seis estados"}: ${rotuloX.toLowerCase()} no eixo horizontal, ${rotuloY.toLowerCase()} (${cargoMin}, ${ano}) no vertical.${r != null ? ` Correlação ${r.toFixed(2)}.` : ""}`}
              />
            )}
          </div>

          <ul className="atalhos s12">
            <li><Link href="/sobre#p6">Como calculamos</Link></li>
            <li><Link href={uf ? `/candidatos?uf=${uf}` : "/candidatos"}>Candidatos</Link></li>
          </ul>
        </div>
      )}
      <MiniMapa recorte={`${sub === "vies" ? "Viés" : `Idade · ${medida.rotulo}`} · ${mun ? nomeLugar : uf ?? "seis estados"} · ${ano}`} foco={focoMini}>{mapa}</MiniMapa>
    </>
  );
}
