import { describe, expect, it } from "vitest";
import {
  abrangencia, buscarCandidato, candidaturasDe, corCandidato, cortesCandidato, doTurno, fraseResumo, indiceCandidatos, proporcaoNoMunicipio,
  proporcaoPorUf, resumoCandidatura, rotulosCandidato, turnosDe, type CandidaturaMapa, type VotoMunicipio,
} from "../src/lib/candidato-mapa";

const c = (o: Partial<CandidaturaMapa>): CandidaturaMapa => ({
  id_candidato: 1, id_candidatura: 10, ano: 2022, cargo: "Deputado federal", uf: "MG", partido: "PFA", numero: 1234, nome_urna: "ANA LIMA",
  resultado: "ELEITO", votos_total: 1000, gasto_total: 50_000, mediana_gasto_cargo: 20_000, parte_publica: 0.6, disputas: 1, mandatos: 1, ...o,
});
const v = (o: Partial<VotoMunicipio>): VotoMunicipio => ({ id_candidatura: 10, id_municipio: 1, uf: "MG", turno: 1, votos: 10, validos_cargo: 100, posicao: 3, ...o });

describe("proporcaoNoMunicipio", () => {
  it("divide pelos válidos do cargo; sem válidos, null", () => {
    expect(proporcaoNoMunicipio(31, 100)).toBe(0.31);
    expect(proporcaoNoMunicipio(0, 100)).toBe(0);
    expect(proporcaoNoMunicipio(5, 0)).toBeNull();
  });
});

describe("cortesCandidato", () => {
  it("quintos simples quando poucos municípios ficam perto de 0%", () => {
    expect(cortesCandidato([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])).toEqual([0.3, 0.5, 0.7, 0.9]);
  });
  it("com muitos municípios abaixo de 0,5%, essa vira a 1ª faixa e o resto se divide em quatro", () => {
    const valores = [...Array(12).fill(0.001), 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08];
    const cortes = cortesCandidato(valores);
    expect(cortes[0]).toBe(0.005);
    expect(cortes).toEqual([0.005, 0.03, 0.05, 0.07]);
    expect(corCandidato(0.001, cortes)).toBe("c0");
    expect(corCandidato(0.08, cortes)).toBe("c4");
    expect(corCandidato(null, cortes)).toBe("sem");
  });
  it("arredonda a 0,1 ponto e não repete cortes", () => {
    expect(cortesCandidato([0.0123, 0.0124, 0.0124, 0.0124, 0.0124, 0.0124])).toEqual([0.012]);
    expect(cortesCandidato([])).toEqual([]);
  });
});

describe("rotulosCandidato", () => {
  it("escreve a 1ª faixa como 'menos de' e a última como 'ou mais'", () => {
    expect(rotulosCandidato([0.005, 0.021, 0.08, 0.18])).toEqual(["menos de 0,5%", "0,5–2,1%", "2,1–8,0%", "8,0–18%", "18% ou mais"]);
    expect(rotulosCandidato([])).toEqual([]);
  });
});

describe("doTurno e turnosDe", () => {
  it("separa os turnos e calcula a proporção de cada município", () => {
    const linhas = [v({ turno: 1, votos: 20 }), v({ turno: 2, votos: 60, validos_cargo: 0 })];
    expect(turnosDe(linhas)).toEqual([1, 2]);
    expect(doTurno(linhas, 1)[0].p).toBe(0.2);
    expect(doTurno(linhas, 2)[0].p).toBeNull();
  });
});

describe("abrangencia", () => {
  it("UF para cargos estaduais, seis estados para presidente, fora para municipais", () => {
    expect(abrangencia("Senador")).toBe("uf");
    expect(abrangencia("Presidente")).toBe("seis");
    expect(abrangencia("Vereador")).toBe("fora");
  });
});

describe("resumoCandidatura", () => {
  it("gasto por voto, razão com a mediana do cargo e parte pública × privada", () => {
    const r = resumoCandidatura(c({ gasto_total: 46_000, mediana_gasto_cargo: 20_000, votos_total: 2000, parte_publica: 0.25 }));
    expect(r.gastoPorVoto).toBe(23);
    expect(r.razaoMediana).toBeCloseTo(2.3);
    expect(r.textoMediana).toBe("2,3× a mediana do cargo");
    expect(r.privado).toBe(0.75);
  });
  it("sem votos, sem mediana ou sem receitas devolve null em vez de dividir por zero", () => {
    const r = resumoCandidatura(c({ votos_total: 0, mediana_gasto_cargo: 0, parte_publica: null }));
    expect(r.gastoPorVoto).toBeNull();
    expect(r.textoMediana).toBeNull();
    expect(r.privado).toBeNull();
  });
  it("acima de 10 vezes arredonda para inteiro", () => {
    expect(resumoCandidatura(c({ gasto_total: 123_000, mediana_gasto_cargo: 10_000 })).textoMediana).toBe("12× a mediana do cargo");
  });
});

describe("fraseResumo", () => {
  const nomes = new Map([[1, "Alfa"], [2, "Beta"], [3, "Gama"], [4, "Delta"]]);
  it("conta em quantos municípios está metade dos votos e diz onde foi a maior proporção", () => {
    const linhas = [v({ id_municipio: 1, votos: 60, validos_cargo: 1000 }), v({ id_municipio: 2, votos: 30, validos_cargo: 100 }), v({ id_municipio: 3, votos: 10 }), v({ id_municipio: 4, votos: 0 })];
    expect(fraseResumo(linhas, nomes, "de MG")).toBe("Metade dos votos veio de 1 município entre os 4 de MG; a maior proporção foi em Beta (30,0%).");
  });
  it("plural e caso sem votos", () => {
    const linhas = [v({ id_municipio: 1, votos: 40 }), v({ id_municipio: 2, votos: 30 }), v({ id_municipio: 3, votos: 30 })];
    expect(fraseResumo(linhas, nomes, "de MG")).toMatch(/^Metade dos votos veio de 2 municípios entre os 3 de MG; a maior proporção foi em Alfa/);
    expect(fraseResumo([v({ votos: 0 })], nomes, "dos seis estados")).toBe("Sem votos registrados nos 1 municípios dos seis estados.");
  });
});

describe("proporcaoPorUf", () => {
  it("soma as contagens por UF em vez de tirar a média das porcentagens", () => {
    const linhas = [v({ uf: "RR", votos: 90, validos_cargo: 100 }), v({ uf: "RR", votos: 10, validos_cargo: 900 }), v({ uf: "AP", votos: 0, validos_cargo: 0 })];
    expect(proporcaoPorUf(linhas)).toEqual([
      { uf: "AP", votos: 0, validos: 0, valor: null },
      { uf: "RR", votos: 100, validos: 1000, valor: 0.1 },   // a média das porcentagens daria 50%
    ]);
  });
});

describe("candidaturasDe", () => {
  const todas = [c({ id_candidatura: 1, ano: 2014 }), c({ id_candidatura: 3, ano: 2022 }), c({ id_candidatura: 2, ano: 2018 }), c({ id_candidato: 2, id_candidatura: 9 })];
  it("lista da mais recente para a mais antiga; a padrão é a mais recente", () => {
    const { padrao, lista } = candidaturasDe(todas, 1);
    expect(padrao?.id_candidatura).toBe(3);
    expect(lista.map((x) => x.ano)).toEqual([2022, 2018, 2014]);
  });
  it("pessoa sem candidaturas", () => {
    expect(candidaturasDe(todas, 99)).toEqual({ padrao: undefined, lista: [] });
  });
});

describe("indiceCandidatos e buscarCandidato", () => {
  const todas = [c({ id_candidato: 1, nome_urna: "ÂNGELA SOUZA", ano: 2018, id_candidatura: 1 }), c({ id_candidato: 1, nome_urna: "ÂNGELA SOUZA", ano: 2022, cargo: "Senador", id_candidatura: 2 }), c({ id_candidato: 2, nome_urna: "BRUNO ANGELIM", id_candidatura: 3 })];
  it("uma entrada por pessoa, com o cargo da candidatura mais recente", () => {
    const ind = indiceCandidatos(todas);
    expect(ind.map((e) => [e.id_candidato, e.ultimo_cargo])).toEqual([[1, "Senador"], [2, "Deputado federal"]]);
  });
  it("casa o começo de qualquer palavra, sem acento", () => {
    const ind = indiceCandidatos(todas);
    expect(buscarCandidato(ind, "angel").map((e) => e.id_candidato)).toEqual([1, 2]);
    expect(buscarCandidato(ind, "souza").map((e) => e.id_candidato)).toEqual([1]);
    expect(buscarCandidato(ind, "ouza")).toEqual([]);
    expect(buscarCandidato(ind, "  ")).toEqual([]);
  });
});

describe("mock da visão Candidato", () => {
  it("é determinístico, cobre os municípios da abrangência e fecha o 2º turno entre os dois lados", async () => {
    const { lerCandidaturasMapa, lerVotosCandidatura } = await import("../src/lib/candidato-mapa.mock");
    const todas = await lerCandidaturasMapa();
    expect(new Set(todas.map((x) => x.id_candidato)).size).toBeGreaterThanOrEqual(6);
    const presidente = await lerVotosCandidatura(900701);
    expect(doTurno(presidente, 1)).toHaveLength(1239);
    expect(proporcaoPorUf(doTurno(presidente, 1)).map((u) => u.uf)).toEqual(["AP", "ES", "MG", "PE", "RJ", "RR"]);
    const [a, b] = [doTurno(await lerVotosCandidatura(900301), 2), doTurno(await lerVotosCandidatura(900401), 2)];
    expect(a.every((l, i) => l.votos + b[i].votos === l.validos_cargo)).toBe(true);
    expect(doTurno(await lerVotosCandidatura(900102), 1)).toHaveLength(853);
    expect(await lerVotosCandidatura(900201)).toEqual([]);   // prefeito: fora do mapa
  });
});
