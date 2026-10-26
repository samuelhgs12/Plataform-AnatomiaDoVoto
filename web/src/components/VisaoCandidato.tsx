import type { ReactNode } from "react";
import Link from "next/link";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { FichaCandidato } from "./FichaCandidato";
import { MiniMapa } from "./MiniMapa";
import { VariacaoTurnos } from "./VariacaoTurnos";
import { classe, enquadrar, nomeProprio, type LinhaMunicipio } from "@/lib/abstencao";
import {
  abrangencia, corCandidato, cortesCandidato, doTurno, fraseResumo, notaValidos, proporcaoPorUf, rotulosCandidato, trechosDaCarreira, variacaoTurnos,
  type CandidaturaMapa, type VotoMunicipio,
} from "@/lib/candidato-mapa";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { faixasFixas } from "@/lib/mapa";
import { NOME_UF } from "@/lib/financiamento";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { TELA } from "@/lib/lupa";
import { inteiro, pct } from "@/lib/format";

/** O estado da URL, já validado contra os dados pela página. */
export interface EscolhaCandidato {
  campanha?: CandidaturaMapa;
  lista: CandidaturaMapa[];
  turno: number;
  turnos: number[];
  /** estado em zoom: o da candidatura (cargos estaduais) ou o clicado (presidente, ou sem candidato: filtra a busca) */
  uf?: string;
  mun?: number;
}

interface Props {
  /** o menu do mapa (SubmenuMapa), encaixado na lateral do palco */
  menu: ReactNode;
  escolha: EscolhaCandidato;
  votos: VotoMunicipio[];
  municipios: LinhaMunicipio[];
  ufs: string[];
}

const SEIS = "AP, ES, MG, PE, RJ e RR";

/**
 * Visão "Candidato" do mapa da página inicial: onde a candidatura teve votos, com a
 * ficha e os números embaixo do mapa. Cargos estaduais abrem no estado; presidente abre nos seis estados e o clique dá zoom.
 * Sem candidato, o clique num estado dá zoom nele e o menu passa a buscar só quem disputou ali (a página filtra). Só
 * desenha: as contas são de src/lib/candidato-mapa.ts.
 */
export function VisaoCandidato({ menu, escolha, votos, municipios, ufs }: Props) {
  const { campanha: c, lista, turno, turnos, uf, mun } = escolha;
  const alcance = c ? abrangencia(c.cargo) : "fora";
  const seis = alcance === "seis";
  const comUf = !c || seis;   // o estado vem da URL (?uf=): sem candidato ou com presidente

  const href = (nova: { campanha?: number; turno?: number; uf?: string | null; mun?: number | null }) => {
    const p = new URLSearchParams({ ver: "candidato" });
    if (c) p.set("cand", String(c.id_candidato));
    const outraCampanha = nova.campanha !== undefined && nova.campanha !== c?.id_candidatura;
    const camp = nova.campanha ?? c?.id_candidatura;
    if (camp && camp !== lista[0]?.id_candidatura) p.set("campanha", String(camp));
    if (!outraCampanha) {
      const t = nova.turno ?? turno;
      if (t !== 1) p.set("turno", String(t));
      const u = nova.uf === undefined ? uf : nova.uf;
      if (comUf && u) p.set("uf", u);
      const m = nova.mun === undefined && nova.uf === undefined ? mun : nova.mun;
      if (c && m) p.set("mun", String(m));
    }
    return `/?${p.toString()}#mapa`;
  };

  const nomes = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const doMun = new Map(municipios.map((m) => [m.id_municipio, m]));
  const linhas = doTurno(votos, turno);
  const linhas1 = turno === 1 ? linhas : doTurno(votos, 1);
  const naUf = uf ? linhas.filter((l) => l.uf === uf) : [];
  const nome = c ? nomeProprio(c.nome_urna) : "";

  // cores: municípios em faixas de cortesCandidato (no presidente, as mesmas para os seis estados); estados em faixas fixas
  const cortes = cortesCandidato((seis ? linhas : naUf).flatMap((l) => l.p ?? []));
  const porUf = seis ? proporcaoPorUf(linhas) : [];
  const cortesUf = faixasFixas(Math.max(0, ...porUf.map((u) => u.valor ?? 0)));
  const fmtUf = (v: number) => pct(v, 0);
  const comMunicipios = !!uf && (!c || alcance !== "fora");

  const estados: EstadoNoMapa[] = ufs.map((u) => {
    const medida = porUf.find((x) => x.uf === u);
    if (seis && medida) {
      const desc = medida.valor == null ? `${NOME_UF[u]}: sem votos válidos` : `${NOME_UF[u]}: ${pct(medida.valor, 1)} dos votos válidos (${inteiro(medida.votos)} votos)`;
      return { uf: u, classe: medida.valor == null ? "sem" : `c${classe(medida.valor, cortesUf)}`, href: href({ uf: u === uf ? null : u }), sigla: u, valor: medida.valor == null ? "—" : fmtUf(medida.valor), descricao: desc };
    }
    if (!c) {
      const desc = u === uf ? `${NOME_UF[u]}: voltar aos seis estados` : `${NOME_UF[u]}: ver quem disputou aqui`;
      return { uf: u, classe: "neutro", href: href({ uf: u === uf ? null : u }), sigla: u, valor: "", descricao: desc };
    }
    const desc = u === c.uf ? NOME_UF[u] : `${NOME_UF[u]}: fora da disputa de ${nome}`;
    return { uf: u, classe: "neutro", href: u === c.uf ? href({ mun: null }) : href({}), sigla: u, valor: "", descricao: desc };
  });

  const caixa = comMunicipios ? CAIXA_UF[uf!] : undefined;
  const atrasoDe = (centro: [number, number]) => Math.round(((centro[0] - caixa![0]) / (caixa![2] - caixa![0])) * 100) / 100;
  // sem candidato, os municípios do estado aparecem sem cor: o zoom mostra onde a busca vai procurar
  const noMapa: MunicipioNoMapa[] = !caixa ? [] : !c ? municipios.flatMap((m) => {
    const centro = m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge];
    return centro ? [{ ibge: m.cod_ibge, classe: "neutro", href: href({}), dica: nomes.get(m.id_municipio)!, atraso: atrasoDe(centro) }] : [];
  }) : naUf.flatMap((l) => {
    const m = doMun.get(l.id_municipio);
    const centro = m && CENTRO_MUNICIPIO[m.cod_ibge];
    if (!m || !centro) return [];
    const nomeM = nomes.get(l.id_municipio)!;
    const dica = l.p == null ? `${nomeM}: sem votos válidos` : `${nomeM}: ${pct(l.p, 1)} (${inteiro(l.votos)} ${l.votos === 1 ? "voto" : "votos"})`;
    return [{ ibge: m.cod_ibge, classe: corCandidato(l.p, cortes), href: href({ mun: l.id_municipio === mun ? null : l.id_municipio }), dica, atraso: atrasoDe(centro) }];
  });
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.1 : 0.02);   // folga maior que na abstenção: o título é mais alto e os botões de zoom ficam à direita
  const munSel = mun ? doMun.get(mun) : undefined;
  const centroSel = munSel ? CENTRO_MUNICIPIO[munSel.cod_ibge] : undefined;
  const linhaSel = mun ? linhas.find((l) => l.id_municipio === mun) : undefined;

  // textos
  const onde = seis ? (uf ? `de ${uf}` : "dos seis estados") : c ? `de ${c.uf}` : "";
  const frase = c && alcance !== "fora" ? fraseResumo(seis && !uf ? linhas : naUf, nomes, onde) : "";
  const turnoTexto = `${turno}º turno`;
  const sub = c ? `${c.cargo} · ${seis ? `só ${SEIS}` : c.uf} · ${turnoTexto}` : "";
  const legenda = comMunicipios ? rotulosCandidato(cortes) : seis ? rotulosCandidato(cortesUf).map((t) => t.replace("menos de", "até")) : [];
  const algumSem = (comMunicipios ? naUf : porUf).some((l) => ("p" in l ? l.p : l.valor) == null);
  const tabela = seis && !uf
    ? porUf.map((u) => ({ id: u.uf, nome: NOME_UF[u.uf], votos: u.votos, p: u.valor, posicao: null as number | null }))
    : naUf.map((l) => ({ id: String(l.id_municipio), nome: nomes.get(l.id_municipio) ?? "", votos: l.votos, p: l.p, posicao: l.posicao }));
  tabela.sort((a, b) => (b.p ?? -1) - (a.p ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
  const noMapaT1 = linhas1.reduce((s, l) => ({ votos: s.votos + l.votos, validos: s.validos + l.validos_cargo }), { votos: 0, validos: 0 });
  const cargoMin = c?.cargo.toLowerCase();
  // do 1º ao 2º turno, no recorte do mapa: o estado da candidatura, o estado aberto ou os seis estados (presidente)
  // a carreira da esquerda (a mais antiga) para a direita, com os anos seguidos no mesmo cargo num trecho só
  const trechos = trechosDaCarreira([...lista].reverse());
  const turnos2 = c && turnos.length > 1 ? variacaoTurnos(seis && uf ? votos.filter((l) => l.uf === uf) : votos) : null;
  const ondeTurnos = seis && !uf ? "nos seis estados" : `em ${NOME_UF[uf ?? c?.uf ?? ""] ?? ""}`;

  // o mapa do palco, repetido pequeno no mini-mapa que acompanha a rolagem
  const mapa = (
    <MapaAbstencao
      titulo={c ? `${nome}, ${cargoMin} em ${c.ano}, ${turnoTexto}: votos ${comMunicipios ? `nos municípios de ${NOME_UF[uf!]}` : "nos seis estados"}. ${frase}` : uf ? `Municípios de ${NOME_UF[uf]}, à espera de um candidato` : "Os seis estados, à espera de um candidato"}
      camera={camera} estados={estados} uf={comMunicipios ? uf : undefined} municipios={noMapa}
      destaque={munSel && centroSel ? { ibge: munSel.cod_ibge, nome: nomes.get(munSel.id_municipio)!, x: centroSel[0], y: centroSel[1] } : undefined}
    />
  );

  return (
    <>
      <MapaVivo className="palco cand s12" estado={comMunicipios ? uf : undefined}>
        {menu}
        <div className="palco-topo">
          <div>
            {c ? (
              <>
                <h1 id="h-mapa">Onde {nome} teve votos em {c.ano}</h1>
                <p className="palco-sobre">{sub}</p>
              </>
            ) : uf ? (
              <>
                <h1 id="h-mapa">Quem disputou em {NOME_UF[uf]}</h1>
                <p className="palco-sobre">A busca do menu agora procura só neste estado. Escolha um nome para pintar os municípios</p>
              </>
            ) : (
              <>
                <h1 id="h-mapa">Onde cada candidato teve votos</h1>
                <p className="palco-sobre">Escolha um nome para pintar o mapa, município a município, ou clique num estado para buscar só nele</p>
              </>
            )}
            {lista.length > 1 && (
              <nav className="carreira-trilho" aria-label={`Candidaturas de ${nome}, da mais antiga para a mais recente`}>
                <ol>
                  {trechos.map((t) => {
                    const cargo = `${t.cargo}${t.uf !== c?.uf && t.uf !== "BR" ? ` · ${t.uf}` : ""}`;
                    return (
                      <li key={t.itens[0].id_candidatura} className={`carreira-trecho${t.itens.some((x) => x.id_candidatura === c?.id_candidatura) ? " on" : ""}`}>
                        <ol className="carreira-anos">
                          {t.itens.map((x) => {
                            const on = x.id_candidatura === c?.id_candidatura;
                            return (
                              <li key={x.id_candidatura}>
                                <Link scroll={false} href={href({ campanha: x.id_candidatura })} className="carreira-passo" aria-current={on ? "true" : undefined} aria-label={`${x.ano}, ${cargo}`}>
                                  {x.ano}
                                </Link>
                              </li>
                            );
                          })}
                        </ol>
                        <span className="carreira-cargo" aria-hidden="true">{cargo}</span>
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
          </div>
          {((c && alcance !== "fora") || (!c && uf)) && (
            <nav className="trilha" aria-label="Onde você está no mapa">
              {comUf && <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>}
              {uf && <>{comUf && <span aria-hidden="true">/</span>}<a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
              {munSel && <><span aria-hidden="true">/</span><span aria-current="true">{nomes.get(munSel.id_municipio)}</span></>}
            </nav>
          )}
        </div>

        <div className="palco-mapa">
          {mapa}
          {c && alcance === "fora" && <p className="palco-aviso">Para este cargo o mapa por município ainda não está disponível.</p>}
          {c && alcance !== "fora" && !votos.length && <p className="palco-aviso">Os votos por município desta candidatura não estão disponíveis agora.</p>}
          {comUf && !uf && <p className="palco-dica" aria-hidden="true">{c ? "Clique num estado para ver os municípios" : "Clique num estado para buscar quem disputou nele"}</p>}
        </div>

        <div className="palco-base">
          {legenda.length > 0 ? (
            <ul className="legenda-q legenda-cand" aria-label={comMunicipios ? "Cores: parte dos votos válidos do cargo em cada município; a primeira faixa reúne quem ficou perto de zero" : "Cores: faixas iguais da parte dos votos válidos em cada estado"}>
              {legenda.map((t, i) => <li key={i}><i className={`c${i}`} />{t}</li>)}
              {algumSem && <li className="legenda-sem"><i className="sem" />sem votos válidos</li>}
            </ul>
          ) : <span />}
          {turnos.length > 1 && (
            <div className="anos turnos-escolha" role="group" aria-label="Turno mostrado no mapa">
              {turnos.map((t) => (
                <Link key={t} scroll={false} href={href({ turno: t })} className={`ano${t === turno ? " on" : ""}`} aria-current={t === turno ? "true" : undefined}>{t}º turno</Link>
              ))}
            </div>
          )}
        </div>
      </MapaVivo>

      {c && (
        <div className="painel painel-cand s12" key={`cand-${c.id_candidatura}`}>
          <div className="s4">
            <FichaCandidato
              c={c} noMapa={noMapaT1} onde={seis ? "dos seis estados" : `de ${c.uf}`}
              foto={fotoDaPessoa({ id_candidato: c.id_candidato, ultimo_ano: lista[0]?.ano }, "ficha")}
            />
          </div>
          <div className="painel-pilha s8">
            {turnos2 && <VariacaoTurnos v={turnos2} nome={nome} onde={ondeTurnos} cargo={cargoMin!} />}
            {linhaSel && munSel && (
              <div className="bloco noite painel-cab">
                <p className="palco-sobre">Município · {munSel.uf} · {turnoTexto}</p>
                <h2>{nomes.get(munSel.id_municipio)}</h2>
                {linhaSel.p != null ? (
                  <>
                    <p className="painel-num">{pct(linhaSel.p, 1)}</p>
                    <p>dos {inteiro(linhaSel.validos_cargo)} votos válidos para {cargoMin} foram para {nome}.</p>
                    <dl className="painel-mini">
                      <div><dt>Votos</dt><dd>{inteiro(linhaSel.votos)}</dd></div>
                      <div><dt>Colocação no município</dt><dd>{linhaSel.posicao}º</dd></div>
                    </dl>
                  </>
                ) : <p>Sem votos válidos para {cargoMin} no {turnoTexto}.</p>}
                <Link scroll={false} className="chip" href={href({ mun: null })}>Ver o estado inteiro</Link>
              </div>
            )}

            {alcance !== "fora" && tabela.length > 0 && (
              <div className="bloco noite">
                <h3>Onde estão os votos</h3>
                <p className="r-texto">{frase}</p>
                {notaValidos(c) && <p className="r-texto">{notaValidos(c)}</p>}
                <details className="tabela-cand">
                  <summary>Ver votos por {seis && !uf ? "estado" : "município"}</summary>
                  <div className="tabela-rola">
                    <table>
                      <caption className="sr-only">Votos de {nome} por {seis && !uf ? "estado" : "município"}, {turnoTexto}, da maior para a menor proporção</caption>
                      <thead><tr><th scope="col">{seis && !uf ? "Estado" : "Município"}</th><th scope="col">Votos</th><th scope="col">% válidos</th>{!(seis && !uf) && <th scope="col">Posição</th>}</tr></thead>
                      <tbody>
                        {tabela.map((t) => (
                          <tr key={t.id}><th scope="row">{t.nome}</th><td>{inteiro(t.votos)}</td><td>{t.p == null ? "—" : pct(t.p, 1)}</td>{t.posicao != null && <td>{t.posicao}º</td>}</tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      )}
      {c && <MiniMapa recorte={`${nome} · ${c.cargo} · ${comMunicipios ? uf : "seis estados"} · ${c.ano}`}>{mapa}</MiniMapa>}
    </>
  );
}
