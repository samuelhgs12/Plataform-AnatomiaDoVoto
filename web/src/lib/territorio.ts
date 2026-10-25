// Lógica da página /municipios (as perguntas 1, 2 e 8 no mapa: estado → município → eleitos), sem React: fácil de testar.
// Os dados vêm de /api/analises/municipios (tabelas municipios, resumo e estados) e das listas de eleitos de
// /api/municipios/<id>/eleitos e /api/estados/<uf>/eleitos.

/** Um município dos seis estados, com o código IBGE que o desenho do mapa usa. */
export interface LinhaMunicipio { id_municipio: number; uf: string; nome: string; cod_ibge: string }

/** Um município numa eleição municipal (2020 ou 2024). maior_venceu: o candidato a prefeito que mais gastou venceu? */
export interface LinhaResumo {
  ano: number; id_municipio: number; uf: string;
  vereador_candidatos: number; vereador_eleitos: number; vereador_vagas: number;
  vereador_gasto: number; vereador_receita: number; vereador_publica: number;
  prefeito_candidatos: number; prefeito_gasto: number; prefeito_receita: number; prefeito_publica: number;
  prefeito_id_candidato: number | null; prefeito_nome: string | null; prefeito_partido: string | null;
  prefeito_votos: number | null; prefeito_gasto_eleito: number | null;
  maior_venceu: boolean | null;
}

/** Um cargo num estado e ano. disputas_maior/maior_venceu: só para prefeito (P2). */
export interface LinhaEstado {
  ano: number; uf: string; cargo: string; candidatos: number; eleitos: number; vagas: number;
  gasto: number; receita: number; receita_publica: number; disputas_maior: number | null; maior_venceu: number | null;
}

/** Um eleito (resposta de /api/municipios/<id>/eleitos ou /api/estados/<uf>/eleitos). */
export interface Eleito {
  cargo: string; id_cargo: number; id_candidato: number | null; id_candidatura: number; nome_urna: string | null; partido: string | null;
  votos: number; gasto: number; receita: number; receita_publica: number;
}

/** O que colore o mapa: uma pergunta de cada vez. */
export type Indicador = "custo" | "publico" | "maior";
export const INDICADORES: { chave: Indicador; pergunta: string; rotulo: string; explicacao: string }[] = [
  { chave: "custo", pergunta: "Pergunta 1", rotulo: "Custo da cadeira de vereador",
    explicacao: "Tudo o que os candidatos a vereador gastaram na campanha, dividido pelo número de vagas na câmara." },
  { chave: "publico", pergunta: "Pergunta 8", rotulo: "Dinheiro público nas campanhas",
    explicacao: "Parte do dinheiro recebido pelos candidatos a prefeito e vereador que veio do Fundo Eleitoral e do Fundo Partidário." },
  { chave: "maior", pergunta: "Pergunta 2", rotulo: "Quem mais gastou para prefeito venceu?",
    explicacao: "Se o candidato a prefeito que mais gastou foi o eleito. Nos estados, em quantas cidades isso aconteceu." },
];

/** Cargos na ordem em que aparecem nas listas de eleitos. */
export const ORDEM_ELEITOS = ["Governador", "Vice-governador", "Senador", "Deputado federal", "Deputado estadual", "Prefeito", "Vice-prefeito", "Vereador"];
const PLURAL: Record<string, string> = {
  Governador: "Governador", "Vice-governador": "Vice-governador", Senador: "Senadores", "Deputado federal": "Deputados federais",
  "Deputado estadual": "Deputados estaduais", Prefeito: "Prefeito", "Vice-prefeito": "Vice-prefeito", Vereador: "Vereadores",
};
export const nomeDoGrupo = (cargo: string, n: number) => (n === 1 ? cargo : PLURAL[cargo] ?? cargo);

/** Valor de um município para o indicador (null: sem dado). "maior" vira 1 (venceu) ou 0 (perdeu). */
export function valorMunicipio(r: LinhaResumo | undefined, ind: Indicador): number | null {
  if (!r) return null;
  if (ind === "custo") return r.vereador_vagas > 0 ? r.vereador_gasto / r.vereador_vagas : null;
  if (ind === "publico") {
    const receita = r.vereador_receita + r.prefeito_receita;
    return receita > 0 ? (r.vereador_publica + r.prefeito_publica) / receita : null;
  }
  return r.maior_venceu === null ? null : r.maior_venceu ? 1 : 0;
}

/** Números de um estado (ou dos seis, com uf ausente) numa eleição municipal, somando os cargos de prefeito e vereador. */
export function resumoEstado(linhas: LinhaEstado[], ano: number, uf?: string) {
  const sel = linhas.filter((l) => l.ano === ano && (!uf || l.uf === uf));
  const ver = sel.filter((l) => l.cargo === "Vereador"), pre = sel.filter((l) => l.cargo === "Prefeito");
  const soma = (ls: LinhaEstado[], k: "gasto" | "receita" | "receita_publica" | "vagas" | "candidatos" | "eleitos") => ls.reduce((a, l) => a + l[k], 0);
  const vagas = soma(ver, "vagas"), gastoVer = soma(ver, "gasto");
  const receita = soma(ver, "receita") + soma(pre, "receita"), publica = soma(ver, "receita_publica") + soma(pre, "receita_publica");
  const disputas = pre.reduce((a, l) => a + (l.disputas_maior ?? 0), 0), venceu = pre.reduce((a, l) => a + (l.maior_venceu ?? 0), 0);
  return {
    vagasVereador: vagas, candidatosVereador: soma(ver, "candidatos"), prefeitos: soma(pre, "eleitos"),
    custoCadeira: vagas > 0 ? gastoVer / vagas : null,
    partePublica: receita > 0 ? publica / receita : null,
    disputas, venceu, parteMaior: disputas > 0 ? venceu / disputas : null,
  };
}

/** Valor de um estado para o indicador, na mesma escala dos municípios ("maior" = parte das cidades em que venceu). */
export function valorEstado(linhas: LinhaEstado[], ano: number, uf: string, ind: Indicador): number | null {
  const r = resumoEstado(linhas, ano, uf);
  return ind === "custo" ? r.custoCadeira : ind === "publico" ? r.partePublica : r.parteMaior;
}

/** Os eleitos agrupados por cargo, na ordem de ORDEM_ELEITOS, cada grupo do mais votado ao menos votado. */
export function agruparEleitos(eleitos: Eleito[]): { cargo: string; titulo: string; pessoas: Eleito[] }[] {
  const grupos = new Map<string, Eleito[]>();
  for (const e of eleitos) grupos.set(e.cargo, [...(grupos.get(e.cargo) ?? []), e]);
  const pos = (c: string) => (ORDEM_ELEITOS.indexOf(c) + 1 || 99);
  return [...grupos.entries()].sort((a, b) => pos(a[0]) - pos(b[0]))
    .map(([cargo, pessoas]) => ({ cargo, titulo: nomeDoGrupo(cargo, pessoas.length), pessoas: [...pessoas].sort((a, b) => b.votos - a.votos) }));
}

/** Parte pública do dinheiro recebido por um eleito (null sem receita). */
export const parteDoEleito = (e: Eleito) => (e.receita > 0 ? e.receita_publica / e.receita : null);

/** Anos de eleição municipal e geral presentes nos dados, em ordem. */
export function anosDisponiveis(estados: LinhaEstado[]): { municipais: number[]; gerais: number[] } {
  const anos = [...new Set(estados.map((l) => l.ano))].sort((a, b) => a - b);
  return { municipais: anos.filter((a) => a % 4 === 0), gerais: anos.filter((a) => a % 4 === 2) };
}

/** Escolhe o ano pedido se ele existir; senão, o mais recente. */
export const escolherAno = (pedido: number, anos: number[]) => (anos.includes(pedido) ? pedido : anos[anos.length - 1]);
