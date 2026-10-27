// Pergunta 8 no perfil do candidato ("Dinheiro da campanha e resultado"): o topo, os cartões público × privado e a régua de
// comparação, sem React. Dados: GET /api/candidaturas/<id>/receitas (o que a campanha recebeu, inclusive de outros
// candidatos), a tabela "medianas" da análise q8 (cargos proporcionais) e GET /api/candidaturas/<id>/disputa (cargos de
// uma vaga).

import { nomeProprio } from "./abstencao";
import type { Fonte, LinhaMediana } from "./financiamento";
import { reais } from "./format";
import { LARGURA_LETRA } from "./nuvem";
import { noEstado } from "./propaganda";
import type { CarreiraItem, Receitas } from "./types";

/** Um candidato da mesma disputa (GET /api/candidaturas/<id>/disputa). pct_publica nulo = não declarou receitas. */
export interface CandidatoDisputa { id_candidatura: number; nome_urna: string | null; eleito: boolean; pct_publica: number | null }

/** Cargos em que a comparação é com a campanha típica de eleitos e não eleitos (mediana). */
export const CARGOS_PROPORCIONAIS = ["Vereador", "Deputado estadual", "Deputado federal", "Deputado distrital"];
/** Cargos de uma vaga por disputa: a comparação é com cada adversário. */
export const CARGOS_UMA_VAGA = ["Presidente", "Governador", "Senador", "Prefeito"];
export const ehProporcional = (cargo: string) => CARGOS_PROPORCIONAIS.includes(cargo);
export const ehUmaVaga = (cargo: string) => CARGOS_UMA_VAGA.includes(cargo);

/** As fontes de cada cartão, na ordem, com o nome desta seção. */
export const GRUPOS_FONTES: { chave: "publico" | "privado"; titulo: string; classe: string; fontes: { chave: Fonte; rotulo: string }[] }[] = [
  { chave: "publico", titulo: "Público", classe: "pub", fontes: [{ chave: "fundo_eleitoral", rotulo: "Fundo Eleitoral" }, { chave: "fundo_partidario", rotulo: "Fundo Partidário" }] },
  { chave: "privado", titulo: "Privado", classe: "priv", fontes: [
    { chave: "doacoes_pessoas", rotulo: "Doações de pessoas" }, { chave: "recursos_proprios", rotulo: "Recursos próprios" },
    { chave: "outros_privados", rotulo: "Outras fontes privadas" }] },
];

/** Valor curto dos cartões: "R$ 1,6 mi", "R$ 12 mi", "R$ 63 mil", "R$ 6,3 mil", "R$ 950". */
export function valorCurto(v: number): string {
  const n = (x: number, casas: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: casas });
  if (v >= 999_500) { const mi = v / 1e6; return `R$ ${n(mi < 10 ? Math.round(mi * 10) / 10 : Math.round(mi), 1)} mi`; }
  if (v >= 9_995) return `R$ ${n(Math.round(v / 1e3), 0)} mil`;
  if (v >= 1_000) return `R$ ${n(Math.round(v / 100) / 10, 1)} mil`;
  return `R$ ${n(Math.round(v), 0)}`;
}
/** Percentual com uma casa: "80,7%"; um valor que existe mas arredonda para zero, "menos de 0,1%". */
export function pctUmaCasa(p: number): string {
  if (p > 0 && p < 0.0005) return "menos de 0,1%";
  return `${(p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
/** Percentual inteiro: "81%"; um valor que existe mas arredonda para zero, "menos de 1%". */
export const pctInteiro = (p: number) => (p > 0 && p < 0.005 ? "menos de 1%" : `${Math.round(p * 100)}%`);

/** Uma fonte num cartão: o texto "R$ 63 mil (3,1%)" e a barrinha (parte no TOTAL da campanha, para comparar os cartões). */
export interface FonteCartao { chave: Fonte; rotulo: string; valor: number; parte: number; texto: string }
export interface Cartao { chave: "publico" | "privado"; titulo: string; classe: string; total: number; parte: number; texto: string; fontes: FonteCartao[]; vazio: boolean }
export interface BlocoDinheiro {
  /** Parte pública (0 a 1). */ parte: number;
  topo: { pct: string; total: string; rotulo: string; eleito: boolean };
  cartoes: Cartao[];
  /** Texto para leitor de tela dos cartões. */ descricao: string;
  /** As cinco fontes com o valor exato, para a tabela recolhida. */ tabela: { grupo: string; fontes: { rotulo: string; valor: number; parte: number }[]; total: number; parte: number }[];
}

/**
 * O bloco de uma campanha com receita (null sem nenhuma receita declarada: não quer dizer gasto zero). Os percentuais das
 * fontes e dos grupos são do total da campanha; fontes com R$ 0 ficam de fora; um grupo inteiro zero fica vazio.
 */
export function blocoDinheiro(c: CarreiraItem, r: Receitas): BlocoDinheiro | null {
  const total = GRUPOS_FONTES.flatMap((g) => g.fontes).reduce((s, f) => s + Math.max(r[f.chave] ?? 0, 0), 0);
  if (total <= 0) return null;
  const cartoes: Cartao[] = GRUPOS_FONTES.map((g) => {
    const todas = g.fontes.map((f) => {
      const valor = Math.max(r[f.chave] ?? 0, 0);
      return { chave: f.chave, rotulo: f.rotulo, valor, parte: valor / total, texto: `${valorCurto(valor)} (${pctUmaCasa(valor / total)})` };
    });
    const soma = todas.reduce((s, f) => s + f.valor, 0);
    return { chave: g.chave, titulo: g.titulo, classe: g.classe, total: soma, parte: soma / total,
      texto: soma > 0 ? `${valorCurto(soma)} (${pctUmaCasa(soma / total)})` : "R$ 0 (0%)", fontes: todas.filter((f) => f.valor > 0), vazio: soma <= 0 };
  });
  const parte = cartoes[0].parte;
  const onde = [c.cargo, ...(c.uf && c.uf !== "BR" ? [c.uf] : []), String(c.ano)].join(", ");
  return {
    parte,
    topo: { pct: pctInteiro(parte), total: reais(total), rotulo: `recebidos · ${onde}`, eleito: c.eleito },
    cartoes,
    descricao: "Dinheiro recebido pela campanha. " + cartoes.map((k) => k.vazio ? `${k.titulo}: R$ 0 (0%), nenhum recurso desta origem.`
      : `${k.titulo}: ${k.texto}; ${k.fontes.map((f) => `${f.rotulo} ${f.texto}`).join(", ")}.`).join(" "),
    tabela: cartoes.map((k) => ({ grupo: k.titulo, total: k.total, parte: k.parte,
      fontes: GRUPOS_FONTES.find((g) => g.chave === k.chave)!.fontes.map((f) => ({ rotulo: f.rotulo, valor: Math.max(r[f.chave] ?? 0, 0), parte: Math.max(r[f.chave] ?? 0, 0) / total })) })),
  };
}

/**
 * Uma marca na régua: posição (0 = todo privado, 1 = todo público), círculo cheio ou vazado, altura do empilhamento na
 * largura de referência larga e na estreita (só adversários) e rótulo (só os típicos).
 */
export interface MarcaRegua {
  pos: number; cheio: boolean; nivel: number; nivelEstreito: number; rotulo: string | null; titulo: string;
  /** Eleito e não eleito típicos com o mesmo percentual inteiro: um marcador só (anel com um ponto cheio dentro). */ ambos?: boolean;
}
export interface Regua {
  /** "tipicos": eleito e não eleito típicos (cargos proporcionais); "adversarios": cargos de uma vaga; "sem": sem referência. */
  caso: "tipicos" | "adversarios" | "sem";
  rotulo: string;
  esta: { pos: number; pct: string; rotulo: string };
  marcas: MarcaRegua[];
  frases: string[];
  descricao: string;
}

/**
 * Larguras de referência da régua (px), para converter o diâmetro do círculo em fração da régua: sem JS, a página não sabe
 * a largura real, então as alturas são calculadas para a régua larga (acima de 1000px, ao lado dos cartões) e para a
 * estreita (celular), e o CSS escolhe uma das duas.
 */
export const LARGURA_REF = 560;
export const LARGURA_REF_ESTREITA = 340;
/** Diâmetro do círculo de um adversário (px) e quantas alturas há acima da linha. */
export const DIAMETRO_ADVERSARIO = 16;
export const ALTURAS = 3;

/**
 * Altura de cada posição (na ordem recebida), sem nunca mudar a posição horizontal: do menor percentual para o maior, cada
 * círculo fica na primeira altura em que o último círculo dela está a pelo menos um diâmetro (DIAMETRO_ADVERSARIO na
 * `larguraRef`); sem nenhuma livre (mais de ALTURAS círculos juntos), na altura cujo último círculo está mais longe.
 */
export function empilhar(posicoes: number[], larguraRef = LARGURA_REF): number[] {
  const distancia = DIAMETRO_ADVERSARIO / larguraRef;
  const ordem = posicoes.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const ultimo: number[] = Array(ALTURAS).fill(-Infinity);
  const nivel: number[] = Array(posicoes.length).fill(0);
  for (const [p, i] of ordem) {
    let n = ultimo.findIndex((u) => p - u >= distancia - 1e-12);
    if (n < 0) n = ultimo.indexOf(Math.min(...ultimo));
    nivel[i] = n;
    ultimo[n] = p;
  }
  return nivel;
}

/** Perto das pontas (menos de LIMITE_BORDA da régua), o rótulo deixa de ficar centrado no traço. */
export const LIMITE_BORDA = 0.15;

/**
 * Deslocamento horizontal de um rótulo centrado num ponto (translateX, em % da largura do próprio rótulo): -50 = centrado;
 * abaixo de LIMITE_BORDA, 0 (começa no ponto); acima de 1 - LIMITE_BORDA, de -70 (termina um pouco depois do ponto) até
 * -100 em 100% (termina no ponto), para nunca sair da área do gráfico.
 */
export function deslocamentoRotulo(pos: number): number {
  if (pos > 1 - LIMITE_BORDA) return -Math.round((70 + (30 * (pos - (1 - LIMITE_BORDA))) / LIMITE_BORDA) * 10) / 10;
  if (pos < LIMITE_BORDA) return 0;
  return -50;
}

/** Posição e alinhamento do rótulo de esta campanha (duas linhas, logo acima do traço). */
export function alinhamentoEsta(pos: number): { left: string; transform: string; textAlign: "left" | "center" | "right" } {
  const d = deslocamentoRotulo(pos);
  return { left: `${pos * 100}%`, transform: `translateX(${d}%)`, textAlign: d === -50 ? "center" : d === 0 ? "left" : "right" };
}

/** Largura estimada de um rótulo dos círculos típicos (13px), sem medir no navegador. */
const larguraRotulo = (texto: string) => texto.length * 13 * LARGURA_LETRA;
const FOLGA_ROTULOS = 8;   // px entre dois rótulos vizinhos
/** Raio do círculo típico (px): os rótulos das pontas começam ou terminam na borda dele. */
export const RAIO_TIPICO = 9;

/** Rótulo de um círculo típico: posição, deslocamento e linha (0 = a de cima, 1 = a de baixo). */
export interface RotuloTipico { left: string; transform: string; linha: number }

/**
 * Os rótulos dos círculos típicos, na `larguraRef`. Com o círculo abaixo de LIMITE_BORDA, o rótulo começa na borda esquerda
 * do círculo; acima de 1 - LIMITE_BORDA, termina na borda direita; entre os dois, fica centrado. Assim nenhum sai da área (a
 * área tem margem de um raio). Se os dois rótulos se sobrepõem (pela largura estimada), o do menor valor fica na primeira
 * linha e o do maior na segunda. Marca sem rótulo: null.
 */
export function rotulosTipicos(marcas: MarcaRegua[], larguraRef = LARGURA_REF): (RotuloTipico | null)[] {
  const css = (pos: number) => `${Math.round(pos * 1e6) / 1e4}%`;
  const caixa = (m: MarcaRegua) => {
    const x = m.pos * larguraRef, w = larguraRotulo(m.rotulo!);
    if (m.pos < LIMITE_BORDA) return { left: `calc(${css(m.pos)} - ${RAIO_TIPICO}px)`, transform: "translateX(0%)", de: x - RAIO_TIPICO, ate: x - RAIO_TIPICO + w };
    if (m.pos > 1 - LIMITE_BORDA) return { left: `calc(${css(m.pos)} + ${RAIO_TIPICO}px)`, transform: "translateX(-100%)", de: x + RAIO_TIPICO - w, ate: x + RAIO_TIPICO };
    return { left: css(m.pos), transform: "translateX(-50%)", de: x - w / 2, ate: x + w / 2 };
  };
  const saida: (RotuloTipico | null)[] = marcas.map((m) => {
    if (m.rotulo === null) return null;
    const { left, transform } = caixa(m);
    return { left, transform, linha: 0 };
  });
  const com = marcas.map((m, i) => [m, i] as const).filter(([m]) => m.rotulo !== null).sort((a, b) => a[0].pos - b[0].pos || a[1] - b[1]);
  if (com.length === 2) {
    const [a, b] = [caixa(com[0][0]), caixa(com[1][0])];
    if (a.de < b.ate + FOLGA_ROTULOS && b.de < a.ate + FOLGA_ROTULOS) saida[com[1][1]]!.linha = 1;
  }
  return saida;
}

/**
 * A segunda frase do caso dos típicos, comparando os percentuais INTEIROS mostrados na tela (a frase nunca contradiz os
 * números): igual às duas; típicos iguais e esta diferente; abaixo das duas; acima das duas; entre elas, mais perto de qual
 * (mesma distância: nenhuma).
 */
export function fraseTipicos(parte: number, ne: number, el: number): string | null {
  const [p, n, e] = [parte, ne, el].map((v) => Math.round(v * 100));
  if (n === e) return p === n ? "Esta ficou igual às duas."
    : `As duas tiveram a mesma parte de dinheiro público; esta usou ${p > n ? "mais" : "menos"}.`;
  if (p < Math.min(n, e)) return "Esta usou menos dinheiro público que as duas.";
  if (p > Math.max(n, e)) return "Esta usou mais dinheiro público que as duas.";
  const [dE, dN] = [Math.abs(p - e), Math.abs(p - n)];
  return dE === dN ? null : dE < dN ? "Esta ficou mais perto dos eleitos." : "Esta ficou mais perto dos não eleitos.";
}

const cargoMin = (c: CarreiraItem) => c.cargo.toLowerCase();
/** " em Belo Horizonte" (prefeito), " em Minas Gerais" (governador, senador), "" (presidente). */
function lugarDaDisputa(c: CarreiraItem): string {
  if (c.cargo === "Prefeito" && c.municipio) {
    const m = nomeProprio(c.municipio);
    return m === "Rio de Janeiro" ? " no Rio de Janeiro" : ` em ${m}`;
  }
  return noEstado(c.uf);
}

/**
 * A régua da campanha `c` (parte pública `parte`). Cargos proporcionais: o não eleito típico (círculo vazado) e o eleito
 * típico (cheio), medianas da q8 do mesmo cargo, ano e UF. Cargos de uma vaga: um círculo vazado por adversário da mesma
 * disputa com receita. Sem referência: só esta campanha, com o rótulo "Parte de dinheiro público".
 */
export function reguaComparacao(c: CarreiraItem, parte: number, medianas: LinhaMediana[] | null, disputa: CandidatoDisputa[] | null): Regua {
  const pct = pctInteiro(parte);
  const eleita = c.eleito ? "eleita" : "não eleita";
  const sem = (frases: string[] = []): Regua => ({
    caso: "sem", rotulo: "Parte de dinheiro público", marcas: [], frases,
    esta: { pos: parte, pct, rotulo: "esta campanha" },
    descricao: `Parte de dinheiro público desta campanha: ${pct}.`,
  });

  if (ehProporcional(c.cargo)) {
    const uf = c.uf && c.uf !== "BR" ? c.uf : null;
    const doGrupo = (medianas ?? []).filter((l) => l.ano === c.ano && l.cargo === c.cargo && (l.uf ?? null) === uf);
    const tip = (eleito: boolean) => {
      const v = doGrupo.find((l) => l.eleito === eleito)?.mediana_pct_publico;
      return v === null || v === undefined || !Number.isFinite(v) ? null : Math.min(Math.max(v, 0), 1);
    };
    const [ne, el] = [tip(false), tip(true)];
    if (ne === null && el === null) return sem();
    const iguais = ne !== null && el !== null && Math.round(ne * 100) === Math.round(el * 100);
    const marcas: MarcaRegua[] = iguais
      ? [{ pos: (ne! + el!) / 2, cheio: true, ambos: true, nivel: 0, nivelEstreito: 0, rotulo: `○● eleito e não eleito ${pctInteiro(el)}`,
          titulo: `Eleito e não eleito típicos: ${pctInteiro(el)}` }]
      : [
          ...(ne === null ? [] : [{ pos: ne, cheio: false, nivel: 0, nivelEstreito: 0, rotulo: `○ não eleito ${pctInteiro(ne)}`, titulo: `Não eleito típico: ${pctInteiro(ne)}` }]),
          ...(el === null ? [] : [{ pos: el, cheio: true, nivel: 0, nivelEstreito: 0, rotulo: `● eleito ${pctInteiro(el)}`, titulo: `Eleito típico: ${pctInteiro(el)}` }]),
        ];
    const frases = [ne !== null && el !== null ? "Os círculos são a campanha típica de quem se elegeu e de quem não se elegeu."
      : `O círculo é a campanha típica de quem ${el !== null ? "se elegeu" : "não se elegeu"}.`];
    const segunda = ne !== null && el !== null ? fraseTipicos(parte, ne, el) : null;
    if (segunda) frases.push(segunda);
    const quem = `entre os candidatos a ${cargoMin(c)}${noEstado(uf)} em ${c.ano}`;
    const partes = iguais ? [`ao eleito e ao não eleito típicos, ambos com ${pctInteiro(el!)}`]
      : [...(ne === null ? [] : [`ao não eleito típico, ${pctInteiro(ne)}`]), ...(el === null ? [] : [`ao eleito típico, ${pctInteiro(el)}`])];
    return {
      caso: "tipicos", rotulo: `Comparada aos outros candidatos a ${cargoMin(c)}${noEstado(uf)}`,
      esta: { pos: parte, pct, rotulo: "esta campanha" }, marcas, frases,
      descricao: `Parte de dinheiro público desta campanha, ${pct}, comparada ${partes.join(", e ")}, ${quem}.`,
    };
  }

  if (ehUmaVaga(c.cargo)) {
    const outros = (disputa ?? []).filter((x) => x.id_candidatura !== c.id_candidatura);
    const comReceita = outros.filter((x): x is CandidatoDisputa & { pct_publica: number } => x.pct_publica !== null && Number.isFinite(x.pct_publica));
    const semReceita = outros.length - comReceita.length;
    const fraseSem = semReceita > 0 ? [semReceita === 1 ? "1 adversário não declarou receitas." : `${semReceita} adversários não declararam receitas.`] : [];
    if (!comReceita.length) return sem(fraseSem);
    const pos = comReceita.map((x) => Math.min(Math.max(x.pct_publica, 0), 1));
    const [niveis, estreitos] = [empilhar(pos), empilhar(pos, LARGURA_REF_ESTREITA)];
    const marcas = comReceita.map((x, i) => ({ pos: pos[i], cheio: false, nivel: niveis[i], nivelEstreito: estreitos[i], rotulo: null,
      titulo: `${x.nome_urna ?? "Candidato"}${x.eleito ? " (eleito)" : ""}: ${pctInteiro(pos[i])}` }));
    const frases = ["Cada círculo é um adversário."];
    // o eleito da disputa (esta campanha ou um adversário) contra os adversários DELE que declararam receitas
    const todos = [{ id: c.id_candidatura, eleito: c.eleito, pct: parte }, ...comReceita.map((x) => ({ id: x.id_candidatura, eleito: x.eleito, pct: x.pct_publica }))];
    const eleitos = todos.filter((x) => x.eleito);
    if (eleitos.length === 1) {
      const rivais = todos.filter((x) => x.id !== eleitos[0].id);
      const acima = rivais.filter((x) => x.pct > eleitos[0].pct).length, abaixo = rivais.filter((x) => x.pct < eleitos[0].pct).length;
      if (acima * 2 > rivais.length) frases.push("O eleito usou menos dinheiro público que a maioria dos adversários.");
      else if (abaixo * 2 > rivais.length) frases.push("O eleito usou mais dinheiro público que a maioria dos adversários.");
    }
    frases.push(...fraseSem);
    const n = outros.length;
    const quem = `${n === 1 ? "ao outro candidato" : `aos outros ${n} candidatos`} a ${cargoMin(c)}${lugarDaDisputa(c)} em ${c.ano}`;
    const lista = [...comReceita].sort((a, b) => b.pct_publica - a.pct_publica)
      .map((x) => `${x.nome_urna ? nomeProprio(x.nome_urna) : "Candidato"}${x.eleito ? " (eleito)" : ""}, ${pctInteiro(x.pct_publica)}`);
    return {
      caso: "adversarios", rotulo: `Comparada ${quem}`, esta: { pos: parte, pct, rotulo: `esta campanha · ${eleita}` }, marcas, frases,
      descricao: `Parte de dinheiro público desta campanha, ${pct}, ${eleita}, comparada ${quem}: ${lista.join("; ")}.${semReceita > 0 ? ` ${fraseSem[0]}` : ""}`,
    };
  }
  return sem();
}
