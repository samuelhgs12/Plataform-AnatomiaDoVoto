import { describe, expect, it } from "vitest";
import {
  agruparEleitos, anosDisponiveis, escolherAno, nomeDoGrupo, parteDoEleito, resumoEstado, valorEstado, valorMunicipio,
  type Eleito, type LinhaEstado, type LinhaResumo,
} from "../src/lib/territorio";

const r = (o: Partial<LinhaResumo>): LinhaResumo => ({
  ano: 2024, id_municipio: 1, uf: "PE", vereador_candidatos: 100, vereador_eleitos: 10, vereador_vagas: 10,
  vereador_gasto: 500_000, vereador_receita: 600_000, vereador_publica: 300_000,
  prefeito_candidatos: 3, prefeito_gasto: 900_000, prefeito_receita: 400_000, prefeito_publica: 300_000,
  prefeito_id_candidato: 7, prefeito_nome: "FULANO", prefeito_partido: "PFA", prefeito_votos: 5000, prefeito_gasto_eleito: 400_000,
  maior_venceu: true, ...o,
});
const e = (o: Partial<LinhaEstado>): LinhaEstado => ({
  ano: 2024, uf: "PE", cargo: "Vereador", candidatos: 100, eleitos: 10, vagas: 10, gasto: 1_000_000, receita: 800_000, receita_publica: 400_000,
  disputas_maior: null, maior_venceu: null, ...o,
});
const el = (o: Partial<Eleito>): Eleito => ({
  cargo: "Vereador", id_cargo: 13, id_candidato: 1, id_candidatura: 1, nome_urna: "A", partido: "PFA", votos: 100, gasto: 1000, receita: 2000, receita_publica: 500, ...o,
});

describe("valorMunicipio", () => {
  it("calcula o custo da cadeira, a parte pública e o maior gastador", () => {
    expect(valorMunicipio(r({}), "custo")).toBe(50_000);
    expect(valorMunicipio(r({}), "publico")).toBeCloseTo(0.6);
    expect(valorMunicipio(r({}), "maior")).toBe(1);
    expect(valorMunicipio(r({ maior_venceu: false }), "maior")).toBe(0);
  });
  it("devolve null sem dado", () => {
    expect(valorMunicipio(undefined, "custo")).toBeNull();
    expect(valorMunicipio(r({ vereador_vagas: 0 }), "custo")).toBeNull();
    expect(valorMunicipio(r({ vereador_receita: 0, prefeito_receita: 0 }), "publico")).toBeNull();
    expect(valorMunicipio(r({ maior_venceu: null }), "maior")).toBeNull();
  });
});

describe("resumoEstado e valorEstado", () => {
  const linhas = [
    e({}), e({ cargo: "Prefeito", eleitos: 5, vagas: 5, gasto: 2_000_000, receita: 200_000, receita_publica: 100_000, disputas_maior: 4, maior_venceu: 3 }),
    e({ uf: "RJ", vagas: 20, gasto: 4_000_000 }), e({ ano: 2020, gasto: 1 }),
  ];
  it("soma os cargos municipais de um estado", () => {
    const s = resumoEstado(linhas, 2024, "PE");
    expect(s.custoCadeira).toBe(100_000);
    expect(s.partePublica).toBeCloseTo(0.5);
    expect(s.parteMaior).toBeCloseTo(0.75);
    expect(s.prefeitos).toBe(5);
  });
  it("junta os seis estados quando não há UF", () => {
    expect(resumoEstado(linhas, 2024).custoCadeira).toBeCloseTo(5_000_000 / 30);
    expect(resumoEstado(linhas, 2024, "RR").custoCadeira).toBeNull();
  });
  it("dá o valor do estado para cada indicador", () => {
    expect(valorEstado(linhas, 2024, "PE", "custo")).toBe(100_000);
    expect(valorEstado(linhas, 2024, "PE", "publico")).toBeCloseTo(0.5);
    expect(valorEstado(linhas, 2024, "PE", "maior")).toBeCloseTo(0.75);
  });
});

describe("agruparEleitos", () => {
  it("ordena os cargos e, em cada um, do mais votado ao menos votado", () => {
    const g = agruparEleitos([el({ nome_urna: "B", votos: 50 }), el({ cargo: "Prefeito", id_cargo: 11, nome_urna: "P" }), el({ nome_urna: "C", votos: 900 })]);
    expect(g.map((x) => x.cargo)).toEqual(["Prefeito", "Vereador"]);
    expect(g[1].pessoas.map((p) => p.nome_urna)).toEqual(["C", "B"]);
    expect(g[1].titulo).toBe("Vereadores");
    expect(g[0].titulo).toBe("Prefeito");
  });
  it("usa o singular para um só", () => {
    expect(nomeDoGrupo("Senador", 1)).toBe("Senador");
    expect(nomeDoGrupo("Senador", 2)).toBe("Senadores");
  });
});

describe("parteDoEleito, anos", () => {
  it("calcula a parte pública do eleito", () => {
    expect(parteDoEleito(el({}))).toBeCloseTo(0.25);
    expect(parteDoEleito(el({ receita: 0 }))).toBeNull();
  });
  it("separa anos municipais e gerais e escolhe o pedido ou o mais recente", () => {
    expect(anosDisponiveis([e({ ano: 2018 }), e({ ano: 2020 }), e({ ano: 2022 }), e({ ano: 2024 })])).toEqual({ municipais: [2020, 2024], gerais: [2018, 2022] });
    expect(escolherAno(2020, [2020, 2024])).toBe(2020);
    expect(escolherAno(1999, [2020, 2024])).toBe(2024);
  });
});
