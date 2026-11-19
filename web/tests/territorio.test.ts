import { describe, expect, it } from "vitest";
import {
  mediana, porteDe, PORTES, referenciaPorte, situacaoDado, TEXTO_SITUACAO, disputaPrefeito, nomeDoGrupo, valorMunicipio, type CandidatoLocal, type Eleito, type LinhaResumo,
} from "../src/lib/territorio";

const r = (o: Partial<LinhaResumo>): LinhaResumo => ({
  ano: 2024, id_municipio: 1, uf: "PE", vereador_candidatos: 100, vereador_eleitos: 10, vereador_vagas: 10,
  vereador_gasto: 500_000, vereador_receita: 600_000, vereador_publica: 300_000, vereador_sem_prestacao: 0, prefeito_sem_prestacao: 0,
  prefeito_candidatos: 3, prefeito_gasto: 900_000, prefeito_receita: 400_000, prefeito_publica: 300_000,
  prefeito_id_candidato: 7, prefeito_nome: "FULANO", prefeito_partido: "PFA", prefeito_votos: 5000, prefeito_gasto_eleito: 400_000,
  maior_venceu: true, ...o,
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

describe("agruparEleitos", () => {
  it("usa o singular para um só", () => {
    expect(nomeDoGrupo("Senador", 1)).toBe("Senador");
    expect(nomeDoGrupo("Senador", 2)).toBe("Senadores");
  });
});

describe("disputaPrefeito", () => {
  const c = (o: Partial<CandidatoLocal>): CandidatoLocal => ({ ...el({ cargo: "Prefeito", id_cargo: 11 }), eleito: false, resultado: "NÃO ELEITO", prestou: true, ...o });
  it("ordena por votos, dá a parte dos votos e marca quem gastou mais", () => {
    const d = disputaPrefeito([c({ id_candidatura: 1, votos: 300, gasto: 10 }), c({ id_candidatura: 2, votos: 700, gasto: 90, eleito: true })]);
    expect(d.candidatos.map((x) => x.id_candidatura)).toEqual([2, 1]);
    expect(d.candidatos[0].parteVotos).toBeCloseTo(0.7);
    expect(d.candidatos.map((x) => x.maisGastou)).toEqual([true, false]);
  });
  it("não aponta quem gastou mais se alguém não prestou contas ou ninguém gastou", () => {
    expect(disputaPrefeito([c({ id_candidatura: 1, gasto: 90 }), c({ id_candidatura: 2, prestou: false })]).candidatos.some((x) => x.maisGastou)).toBe(false);
    expect(disputaPrefeito([c({ gasto: 0, votos: 0 })]).candidatos[0]).toMatchObject({ maisGastou: false, parteVotos: null });
    expect(disputaPrefeito([]).todosPrestaram).toBe(false);
  });
});

describe("porteDe e PORTES", () => {
  it("põe cada cidade na faixa de eleitorado", () => {
    expect(porteDe(4_999)?.chave).toBe("ate5");
    expect(porteDe(5_000)?.chave).toBe("ate10");
    expect(porteDe(1_040_000)?.chave).toBe("mais200");
    expect(porteDe(null)).toBeNull();
    expect(porteDe(0)).toBeNull();
    expect(PORTES.map((p) => p.chave)).toHaveLength(6);
  });
});

describe("mediana e referenciaPorte", () => {
  it("calcula a mediana (par e ímpar) e null sem valores", () => {
    expect(mediana([3, 1, 2])).toBe(2);
    expect(mediana([4, 1, 3, 2])).toBe(2.5);
    expect(mediana([])).toBeNull();
  });
  it("compara só com cidades do mesmo porte e ano (e estado, se pedido)", () => {
    const linhas = [
      r({ id_municipio: 1, eleitorado: 3_000, vereador_gasto: 100_000 }), r({ id_municipio: 2, eleitorado: 4_000, vereador_gasto: 300_000 }),
      r({ id_municipio: 3, eleitorado: 900_000, vereador_gasto: 9_000_000 }), r({ id_municipio: 4, eleitorado: 4_500, vereador_gasto: 200_000, uf: "RJ" }),
      r({ ano: 2020, id_municipio: 5, eleitorado: 4_000, vereador_gasto: 1 }),
    ];
    expect(referenciaPorte(linhas, 2024, "ate5", "custo")).toEqual({ valor: 20_000, n: 3 });
    expect(referenciaPorte(linhas, 2024, "ate5", "custo", "PE")).toEqual({ valor: 20_000, n: 2 });
    expect(referenciaPorte(linhas, 2024, "ate5", "maior").valor).toBe(1);
    expect(referenciaPorte(linhas, 2024, "ate10", "custo")).toEqual({ valor: null, n: 0 });
  });
});

describe("situacaoDado", () => {
  it("separa zero declarado, ausente e não se aplica", () => {
    expect(situacaoDado(0)).toBe("zero");
    expect(situacaoDado(null)).toBe("ausente");
    expect(situacaoDado(NaN)).toBe("ausente");
    expect(situacaoDado(5, false)).toBe("nao_se_aplica");
    expect(situacaoDado(5)).toBe("valor");
    expect(TEXTO_SITUACAO.ausente).toBe("Não informado");
  });
});
