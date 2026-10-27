import { describe, expect, it } from "vitest";
import {
  abrangencia, partesDoNome, candidaturasDe, corCandidato, cortesCandidato, doTurno, fraseMunicipal, fraseResumo, noMapaEstatico, notaValidos, proporcaoNoMunicipio,
  proporcaoPorUf, resumoCandidatura, rotulosCandidato, semDadosDeCampanha, sugestoesDe, textoPontos, trechosDaCarreira, turnosDe, variacaoTurnos, type CandidaturaMapa, type VotoMunicipio,
} from "../src/lib/candidato-mapa";
import type { CandidaturaItem } from "../src/lib/types";

const c = (o: Partial<CandidaturaMapa>): CandidaturaMapa => ({
  id_candidato: 1, id_candidatura: 10, ano: 2022, cargo: "Deputado federal", uf: "MG", partido: "PFA", numero: "1234", nome_urna: "ANA LIMA", ue: "MG", sequencial: "1",
  resultado: "ELEITO", votos_total: 1000, gasto_total: 50_000, mediana_gasto_cargo: 20_000, parte_publica: 0.6, disputas: 1, mandatos: 1, ...o,
});
const v = (o: Partial<VotoMunicipio>): VotoMunicipio => ({ id_candidatura: 10, id_municipio: 1, cod_ibge: "3100001", uf: "MG", turno: 1, votos: 10, validos_cargo: 100, posicao: 3, ...o });

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
  it("UF para cargos estaduais, seis estados para presidente, o município para prefeito e vereador", () => {
    expect(abrangencia("Senador")).toBe("uf");
    expect(abrangencia("Presidente")).toBe("seis");
    expect(abrangencia("Prefeito")).toBe("municipio");
    expect(abrangencia("Vereador")).toBe("municipio");
    expect(abrangencia("Vice-prefeito")).toBe("fora");
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
  it("sem prestação de contas (antes de 2018), sem gasto por voto nem comparação", () => {
    const r = resumoCandidatura(c({ gasto_total: null, mediana_gasto_cargo: null }));
    expect(r.gastoPorVoto).toBeNull();
    expect(r.textoMediana).toBeNull();
  });
  it("acima de 10 vezes arredonda para inteiro", () => {
    expect(resumoCandidatura(c({ gasto_total: 123_000, mediana_gasto_cargo: 10_000 })).textoMediana).toBe("12× a mediana do cargo");
  });
});

describe("trechosDaCarreira", () => {
  it("junta anos seguidos no mesmo cargo e UF, sem juntar o que volta depois", () => {
    const anos = (t: { itens: CandidaturaMapa[] }) => t.itens.map((x) => x.ano);
    const t = trechosDaCarreira([
      c({ ano: 2002, cargo: "Deputado estadual" }), c({ ano: 2006, cargo: "Deputado estadual" }), c({ ano: 2016, cargo: "Prefeito" }),
      c({ ano: 2018, cargo: "Deputado estadual" }), c({ ano: 2022, cargo: "Deputado estadual", uf: "RJ" }),
    ]);
    expect(t.map((x) => [x.cargo, x.uf, anos(x)])).toEqual([
      ["Deputado estadual", "MG", [2002, 2006]], ["Prefeito", "MG", [2016]], ["Deputado estadual", "MG", [2018]], ["Deputado estadual", "RJ", [2022]],
    ]);
    expect(trechosDaCarreira([])).toEqual([]);
  });
});

describe("variacaoTurnos", () => {
  it("soma votos e válidos de cada turno e dá a diferença em pontos", () => {
    const r = variacaoTurnos([
      v({ turno: 1, votos: 30, validos_cargo: 100 }), v({ id_municipio: 2, turno: 1, votos: 10, validos_cargo: 100 }),
      v({ turno: 2, votos: 60, validos_cargo: 100 }), v({ id_municipio: 2, turno: 2, votos: 50, validos_cargo: 100 }),
    ])!;
    expect(r.t1).toEqual({ turno: 1, votos: 40, validos: 200, p: 0.2 });
    expect(r.t2.p).toBe(0.55);
    expect(r.pontos).toBeCloseTo(0.35);
  });
  it("sem 2º turno, null; sem válidos num turno, sem diferença", () => {
    expect(variacaoTurnos([v({ turno: 1 })])).toBeNull();
    expect(variacaoTurnos([v({ turno: 1 }), v({ turno: 2, validos_cargo: 0 })])!.pontos).toBeNull();
  });
});

describe("textoPontos", () => {
  it("sinal, uma casa e singular abaixo de 2", () => {
    expect(textoPontos(0.1234)).toBe("+12,3 pontos");
    expect(textoPontos(-0.04)).toBe("−4,0 pontos");
    expect(textoPontos(0.012)).toBe("+1,2 ponto");
    expect(textoPontos(0.00004)).toBe("0,0 ponto");
  });
});

describe("semDadosDeCampanha", () => {
  it("diz o motivo só quando não há gasto nem receitas", () => {
    expect(semDadosDeCampanha(c({}))).toBeNull();
    expect(semDadosDeCampanha(c({ gasto_total: null }))).toBeNull();   // ainda há a origem do dinheiro
    expect(semDadosDeCampanha(c({ ano: 2014, gasto_total: null, parte_publica: null }))).toMatch(/de 2018 em diante/);
    expect(semDadosDeCampanha(c({ ano: 2022, gasto_total: null, parte_publica: null }))).toMatch(/desta candidatura/);
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

describe("noMapaEstatico", () => {
  it("troca o id da API pelo do mapa estático pelo código IBGE e deixa de fora quem não casa", () => {
    const municipios = [{ id_municipio: 2426, cod_ibge: "3106200" }, { id_municipio: 2428, cod_ibge: "3106309" }];
    const votos = [v({ id_municipio: 2428, cod_ibge: "3106200", votos: 97 }), v({ id_municipio: 7, cod_ibge: null }), v({ id_municipio: 8, cod_ibge: "9999999" })];
    expect(noMapaEstatico(votos, municipios)).toEqual([v({ id_municipio: 2426, cod_ibge: "3106200", votos: 97 })]);
  });
});

describe("fraseMunicipal", () => {
  it("a parte dos válidos e a colocação no município da disputa", () => {
    expect(fraseMunicipal(v({ votos: 300, validos_cargo: 1000, posicao: 1 }), "Alfa", "Prefeito")).toBe("Disputou só em Alfa: 30,0% dos votos válidos para prefeito, 1º lugar.");
    expect(fraseMunicipal(v({ votos: 12, validos_cargo: 4000, posicao: 37 }), "Beta", "Vereador")).toBe("Disputou só em Beta: 0,3% dos votos válidos para vereador, 37º lugar.");
  });
  it("sem votos ou sem válidos, não inventa proporção", () => {
    expect(fraseMunicipal(v({ votos: 0, validos_cargo: 1000, posicao: 5 }), "Alfa", "Vereador")).toBe("Disputou só em Alfa, sem votos registrados neste turno.");
    expect(fraseMunicipal(v({ votos: 0, validos_cargo: 0 }), "Alfa", "Prefeito")).toMatch(/sem votos registrados/);
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

describe("partesDoNome", () => {
  it("a última palavra em destaque, o resto acima", () => {
    expect(partesDoNome("Otávio Cerejeira")).toEqual({ antes: "Otávio", destaque: "Cerejeira" });
    expect(partesDoNome(" Ana  da Silva ")).toEqual({ antes: "Ana da", destaque: "Silva" });
    expect(partesDoNome("Fulano")).toEqual({ antes: "", destaque: "Fulano" });
  });
});

describe("sugestoesDe", () => {
  const item = (o: Partial<CandidaturaItem>): CandidaturaItem => ({
    id_candidatura: 1, id_candidato: 1, nome_urna: "ANA", numero_urna: "11", uf: "RR", ano: 2022, ue: "RR", sequencial: "9",
    partido: "PP", cargo: "Governador", resultado: "ELEITO", eleito: true, votos: 10, ...o,
  });
  it("uma por pessoa, na ordem da listagem, com a chave da foto; sem id_candidato fica de fora", () => {
    const s = sugestoesDe([item({}), item({ id_candidatura: 2 }), item({ id_candidato: null }), item({ id_candidato: 2, uf: "MG" })]);
    expect(s.map((x) => [x.id_candidato, x.uf])).toEqual([[1, "RR"], [2, "MG"]]);
    expect(s[0]).toMatchObject({ ultimo_ano: 2022, ultimo_cargo: "Governador", ultimo_ue: "RR", ultimo_sequencial: "9" });
  });
  it("limita a quantidade", () => {
    expect(sugestoesDe([1, 2, 3, 4, 5].map((id) => item({ id_candidato: id })), 3)).toHaveLength(3);
  });
});

describe("notaValidos", () => {
  it("avisa só em cargo proporcional antes de 2018 (sem legenda por município)", () => {
    expect(notaValidos({ ano: 2014, cargo: "Deputado federal" })).toMatch(/só sobre os votos nominais/);
    expect(notaValidos({ ano: 2018, cargo: "Deputado estadual" })).toBeNull();
    expect(notaValidos({ ano: 2010, cargo: "Governador" })).toBeNull();
  });
});
