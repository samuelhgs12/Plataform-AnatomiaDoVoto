import { describe, expect, it } from "vitest";
import type { LinhaLegenda } from "../src/lib/legenda";
import { agrupar, candidatoNaPaleta, filtrarPaleta, indicePaleta } from "../src/lib/paleta";
import { anoNaLegenda, casasDosCortes, conjunto, escalaDoMaior, dinheiroTotal, doCargo, faixasFixas, legendaPorUf, medirLegenda, rankingPartidos, resumoCamadas, situacaoComparativo } from "../src/lib/mapa";
import {
  censoDoAno, classe, compararComReferencia, composicaoEleitorado, corMunicipio, correlacao, distribuicao, extremosAbstencao, reguaIndicador, enquadrar, formatarIndicador, indicadorNoCenso, indicadoresDoCenso, indicadoresPorMunicipio, lerCorrelacao, mediaPonderada, nomeProprio, posicao, quantis,
  rotulosFaixas, serieAbstencao, somarParticipacao, taxaDe, tendencia, type LinhaParticipacao,
} from "../src/lib/abstencao";
import { aproximar, arrastar, centrarLupa, LUPA_INICIAL, LUPA_MAX, TELA } from "../src/lib/lupa";
import { lerFicha, naRegua, posicionarDica } from "../src/lib/dica";
import { naLinhaDoTempo, rotulosPartido } from "../src/lib/carreira";
import type { CarreiraItem } from "../src/lib/types";
import { destacarBusca, normalizarBusca } from "../src/lib/busca";
import { fotoDaBusca, fotoDaPessoa, fotoDoPerfil, urlFoto } from "../src/lib/foto-candidato";
import { compacto, iniciais, pctSinal, reais } from "../src/lib/format";
import { respostaSucesso, resumoCampanhas, contarFaixas, deCada100, descreverMudancas, emCada10, ordenarPartidos, parteDosEleitos, sucessoPorFaixa, sucessoTresGrupos, type LinhaSucesso, medianasPorCargo, porAno, porPartido, porUf, somar, textoDe100, type LinhaFaixa, type LinhaFontes, type LinhaMediana } from "../src/lib/financiamento";

describe("format", () => {
  it("abrevia números e gera iniciais", () => {
    expect(compacto(629200)).toBe("629,2 mil");
    expect(compacto(3700000)).toBe("3,7 mi");
    expect(iniciais("MARIA DA SILVA")).toBe("MS");
    expect(pctSinal(0.25)).toBe("+25%");
    expect(pctSinal(-0.555, 1)).toBe("−55,5%");
    expect(pctSinal(-0.004)).toBe("0%");
  });
});

describe("financiamento (pergunta 8)", () => {
  const fo = (o: Partial<LinhaFontes>): LinhaFontes => ({
    ano: 2022, cargo: "Deputado federal", uf: "MG", partido: "PT", eleito: false, candidaturas: 10, com_receita: 8,
    fundo_eleitoral: 600, fundo_partidario: 100, doacoes_pessoas: 200, recursos_proprios: 100, outros_privados: 0, ...o,
  });
  const linhas = [fo({}), fo({ uf: "PE", partido: "PL", eleito: true, fundo_eleitoral: 0, fundo_partidario: 0 }), fo({ ano: 2024, cargo: "Vereador" })];

  it("soma as fontes e separa público de privado", () => {
    const s = somar(linhas, { ano: 2022, uf: "MG" });
    expect(s.total).toBe(1000);
    expect(s.publico).toBe(700);
    expect(s.privado).toBe(300);
    expect(s.candidaturas).toBe(10);
    expect(somar(linhas, { ano: 2022 }).total).toBe(1300);
  });
  it("agrupa por ano e por partido (maior primeiro)", () => {
    expect(porAno(linhas, { cargo: "Vereador" }).map((a) => a.soma.total)).toEqual([0, 1000]);
    expect(porPartido(linhas, { ano: 2022 }).map((p) => p.partido)).toEqual(["PT", "PL"]);
  });
  it("compara estados pelo % público, sem a campanha nacional", () => {
    const l = [...linhas, fo({ uf: "BR", cargo: "Presidente" })];
    const u = porUf(l, { ano: 2022 });
    expect(u.map((x) => x.uf)).toEqual(["MG", "PE"]);
    expect(u[0].soma.publico).toBe(700);
  });
  it("compara geral com geral e municipal com municipal", () => {
    const l = [fo({ ano: 2018, fundo_eleitoral: 582, fundo_partidario: 0 }), fo({ ano: 2022, fundo_eleitoral: 1279, fundo_partidario: 0 }), fo({ ano: 2024, cargo: "Vereador" })];
    const m = descreverMudancas(porAno(l, {}));
    expect(m).toEqual([{ tipo: "gerais", texto: "o dinheiro público foi de 66% em 2018 para 81% em 2022 (subiu 15 pontos)." }]);
  });
  it("ordena partidos por valor ou por % público, sem os muito pequenos", () => {
    const l = [fo({ partido: "A" }), fo({ partido: "B", fundo_eleitoral: 5000 }), fo({ partido: "NANICO", fundo_eleitoral: 1, fundo_partidario: 0, doacoes_pessoas: 0, recursos_proprios: 0 })];
    const p = porPartido(l, { ano: 2022 });
    expect(ordenarPartidos(p, "valor").map((x) => x.partido)).toEqual(["B", "A", "NANICO"]);
    expect(ordenarPartidos(p, "publico").map((x) => x.partido)).toEqual(["B", "A"]);
  });
  it("calcula a taxa de eleição por faixa de dinheiro público", () => {
    const su = (o: Partial<LinhaSucesso>): LinhaSucesso => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", faixa: 4, candidaturas: 100, eleitos: 22, publico_min: 200000, publico_max: 3000000, ...o });
    const r = sucessoPorFaixa([su({}), su({ uf: "PE", candidaturas: 100, eleitos: 18 }), su({ faixa: 0, candidaturas: 50, eleitos: 0, publico_min: 0, publico_max: 0 })], { ano: 2022 });
    expect(r).toHaveLength(5);
    expect(r[4].taxa).toBeCloseTo(0.2);
    expect(r[0].taxa).toBe(0);
    expect(r[2].candidaturas).toBe(0);
  });
  it("junta as faixas em nada / pouco / muito", () => {
    const su = (o: Partial<LinhaSucesso>): LinhaSucesso => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", faixa: 1, candidaturas: 100, eleitos: 1, publico_min: 1, publico_max: 2, ...o });
    const g = sucessoTresGrupos([su({ faixa: 0, eleitos: 0 }), su({}), su({ faixa: 2 }), su({ faixa: 3, eleitos: 4 }), su({ faixa: 4, eleitos: 22 })], { ano: 2022 });
    expect(g.nada.taxa).toBe(0);
    expect(g.pouco.candidaturas).toBe(300);
    expect(g.pouco.taxa).toBeCloseTo(0.02);
    expect(g.muito.taxa).toBeCloseTo(0.22);
  });
  it("mede a parte do dinheiro público que ficou com os eleitos", () => {
    const r = parteDosEleitos([fo({ eleito: true, candidaturas: 1 }), fo({ candidaturas: 9, fundo_eleitoral: 0, fundo_partidario: 300 })], { ano: 2022 });
    expect(r.pctCandidatos).toBeCloseTo(0.1);
    expect(r.pctPublico).toBeCloseTo(0.7);
  });
  it("divide em 100 sem sobrar nem faltar", () => {
    expect(deCada100([1, 1, 1])).toEqual([34, 33, 33]);
    expect(deCada100([600, 100, 200, 100, 0])).toEqual([60, 10, 20, 10, 0]);
    expect(deCada100([0, 0]).reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("conta faixas e filtra eleitos", () => {
    const fx = (o: Partial<LinhaFaixa>): LinhaFaixa => ({ ano: 2022, cargo: "Senador", uf: "RJ", eleito: false, faixa: "so_publico", candidaturas: 3, ...o });
    const l = [fx({}), fx({ faixa: "sem_receita", candidaturas: 1 }), fx({ eleito: true, faixa: "mais_privado", candidaturas: 2 })];
    expect(contarFaixas(l, { ano: 2022 }).total).toBe(6);
    expect(contarFaixas(l, { ano: 2022 }, true).porFaixa.mais_privado).toBe(2);
  });
  it("usa a linha sem UF para 'todas as UFs' nas medianas", () => {
    const m = (o: Partial<LinhaMediana>): LinhaMediana => ({ ano: 2024, cargo: "Vereador", uf: null, eleito: true, candidaturas: 5, mediana_total: 20000, mediana_publico: 12000, mediana_pct_publico: 0.6, ...o });
    const l = [m({}), m({ eleito: false, mediana_total: 2000 }), m({ uf: "MG", mediana_total: 1 }), m({ cargo: "Prefeito" })];
    const r = medianasPorCargo(l, 2024);
    expect(r.map((x) => x.cargo)).toEqual(["Prefeito", "Vereador"]);
    expect(r[1].eleito?.mediana_total).toBe(20000);
    expect(r[1].naoEleito?.mediana_total).toBe(2000);
  });
  it("escreve frações e valores para leigos", () => {
    expect(emCada10(0.31)).toBe("3 em cada 10 candidatos");
    expect(textoDe100(0, 2000)).toBe("menos de R$ 1 de cada R$ 100");
    expect(textoDe100(14, 1)).toBe("R$ 14 de cada R$ 100");
    expect(emCada10(0)).toBe("nenhum candidato");
    expect(emCada10(0.97)).toBe("quase todos os candidatos");
    expect(reais(1665900000)).toBe("R$ 1,7 bilhão");
    expect(reais(2023700000)).toBe("R$ 2 bilhões");
    expect(reais(120400000)).toBe("R$ 120 milhões");
    expect(reais(20400)).toBe("R$ 20 mil");
  });
});

describe("destacarBusca", () => {
  const marcado = (nome: string, q: string) => destacarBusca(nome, q).filter((t) => t.casou).map((t) => t.texto).join("|");

  it("normaliza como a API", () => {
    expect(normalizarBusca("  João, do Comércio! ")).toBe("joao do comercio");
  });
  it("marca o trecho contínuo ignorando acento e caixa", () => {
    expect(destacarBusca("JOÃO DO COMÉRCIO", "joao do com")).toEqual([
      { texto: "JOÃO DO COM", casou: true },
      { texto: "ÉRCIO", casou: false },
    ]);
    expect(marcado("MARIA DA SILVA SANTOS", "silva san")).toBe("SILVA SAN");
  });
  it("atravessa pontuação", () => {
    expect(marcado("DR. LULA PEREIRA", "dr lula")).toBe("DR. LULA");
  });
  it("só casa no início de palavra e na ordem", () => {
    expect(marcado("CELULAR", "lula")).toBe("");
    expect(marcado("MARIA DA SILVA", "maria silva")).toBe("");
    expect(destacarBusca("MARIA DA SILVA", "maria silva")).toEqual([{ texto: "MARIA DA SILVA", casou: false }]);
  });
});

describe("urlFoto", () => {
  it("monta a rota da API pela chave (ano, ue, sequencial)", () => {
    expect(urlFoto({ ano: 2022, ue: "RR", sequencial: "230001604255" })).toBe("/api/fotos/2022/RR/230001604255?tam=mini");
    expect(urlFoto({ ano: 2024, ue: "54038", sequencial: "1" }, "ficha")).toBe("/api/fotos/2024/54038/1?tam=ficha");
  });
  it("sem chave ou antes de 2018 não pede foto", () => {
    expect(urlFoto({ ano: 2016, ue: "MG", sequencial: "1" })).toBeNull();
    expect(urlFoto({ ano: 2022, ue: "MG" })).toBeNull();
    expect(urlFoto({ ano: 2022, ue: null, sequencial: "1" })).toBeNull();
  });
});

describe("fotoDaPessoa", () => {
  it("a mesma rota para a pessoa, qualquer que seja a candidatura", () => {
    expect(fotoDaPessoa({ id_candidato: 7, ultimo_ano: 2022 })).toBe("/api/candidatos/7/foto?tam=mini");
    expect(fotoDaBusca({ id_candidato: 7, ultimo_ano: 2024 }, "ficha")).toBe("/api/candidatos/7/foto?tam=ficha");
  });
  it("sem pessoa ou sem candidatura de 2018 em diante, sem foto", () => {
    expect(fotoDaPessoa({ id_candidato: null, ultimo_ano: 2022 })).toBeNull();
    expect(fotoDaPessoa({ id_candidato: 7, ultimo_ano: 2016 })).toBeNull();
    expect(fotoDaPessoa({ id_candidato: 7 })).toBe("/api/candidatos/7/foto?tam=mini");   // sem o último ano, a API decide
  });
  it("no perfil, pela candidatura mais recente da carreira", () => {
    expect(fotoDoPerfil(3, [{ ano: 2014 }, { ano: 2018 }])).toBe("/api/candidatos/3/foto?tam=ficha");
    expect(fotoDoPerfil(3, [{ ano: 2010 }])).toBeNull();
    expect(fotoDoPerfil(3, [])).toBeNull();
  });
});

describe("naLinhaDoTempo", () => {
  const c = (o: Partial<CarreiraItem>): CarreiraItem => ({
    id_candidatura: 1, ano: 2020, cargo: "Vereador", id_cargo: 13, nivel: 1, eh_titular: true, uf: "MG", municipio: null, partido: "PT",
    nome_urna: null, numero_urna: null, ue: "MG", sequencial: "1", tipo_eleicao: "ORDINARIA", resultado: "ELEITO", eleito: true, disputou: true, votos_1t: 0, ...o,
  });

  it("inclui vice-prefeito entre vereador e prefeito e deixa outros vices de fora", () => {
    const r = naLinhaDoTempo([
      c({ id_candidatura: 3, ano: 2024, id_cargo: 11 }),
      c({ id_candidatura: 2, ano: 2020, id_cargo: 12, eh_titular: false }),
      c({ id_candidatura: 1, ano: 2016, id_cargo: 13 }),
      c({ id_candidatura: 4, ano: 2022, id_cargo: 4, eh_titular: false }),
    ]);
    expect(r.map((x) => [x.id_candidatura, x.nivel])).toEqual([[1, 1], [2, 2], [3, 3]]);
  });
  it("descarta suplementar e quem não disputou", () => {
    expect(naLinhaDoTempo([c({ tipo_eleicao: "SUPLEMENTAR" }), c({ disputou: false })])).toEqual([]);
  });
});

describe("rotulosPartido", () => {
  it("uma etiqueta por ponto e partido, empilhando as que se sobrepõem", () => {
    const r = rotulosPartido([{ x: 100, partido: "REPUBLICANOS" }, { x: 140, partido: "PT" }, { x: 140, partido: "PT" }, { x: 300, partido: null }], 10);
    expect(r.map((e) => [e.partido, e.linha])).toEqual([["REPUBLICANOS", 0], ["PT", 1]]);
  });
  it("lado a lado quando há espaço e sem passar dos limites", () => {
    const r = rotulosPartido([{ x: 0, partido: "PT" }, { x: 200, partido: "PSD" }], 10, { min: 0, max: 210 });
    expect(r.map((e) => e.linha)).toEqual([0, 0]);
    expect(r[0].x - r[0].largura / 2).toBe(0);
    expect(r[1].x + r[1].largura / 2).toBe(210);
    expect(r[0].xPonto).toBe(0);
  });
});

describe("resumoCampanhas", () => {
  const cand = (o: Partial<CarreiraItem>): CarreiraItem => ({
    id_candidatura: 1, ano: 2024, cargo: "Vereador", id_cargo: 13, nivel: 1, eh_titular: true, uf: "MG", municipio: null, partido: "PT",
    nome_urna: null, numero_urna: null, ue: "MG", sequencial: "1", tipo_eleicao: "ORDINARIA", resultado: "ELEITO", eleito: true, disputou: true, votos_1t: 0, ...o,
  });
  const rec = (publica: number, privada: number) => ({
    id_candidatura: 1, publica, privada, total: publica + privada, pct_publica: null, mediana_pct_publica_cargo: null,
    fundo_eleitoral: publica, fundo_partidario: 0, doacoes_pessoas: privada, recursos_proprios: 0, outros_privados: 0,
  });

  it("uma linha por campanha, na ordem recebida, com a parte pública de cada R$ 100", () => {
    const r = resumoCampanhas([
      { c: cand({ id_candidatura: 2, ano: 2024 }), r: rec(300, 100) },
      { c: cand({ id_candidatura: 1, ano: 2020, eleito: false }), r: rec(0, 0) },
      { c: cand({ id_candidatura: 3, ano: 2018 }), r: null },
    ]);
    expect(r.map((x) => [x.id, x.total, x.publicoDe100, x.eleito])).toEqual([[2, 400, 75, true], [1, 0, 0, false], [3, null, 0, true]]);
  });
});

describe("respostaSucesso", () => {
  const grupo = (chave: "nada" | "pouco" | "muito", candidaturas: number, eleitos: number) => ({ chave, candidaturas, eleitos, taxa: candidaturas ? eleitos / candidaturas : 0 });
  it("compara 'muito' com 'nada' e diz quantas vezes mais", () => {
    const r = respostaSucesso({ nada: grupo("nada", 100, 10), pouco: grupo("pouco", 100, 12), muito: grupo("muito", 100, 30) });
    expect(r.curta).toBe("Sim.");
    expect(r.base.chave).toBe("nada");
    expect(r.vezes).toBeCloseTo(3);
  });
  it("sem ninguém em 'nada', compara com 'pouco'; diferença pequena não é 'sim'", () => {
    const r = respostaSucesso({ nada: grupo("nada", 0, 0), pouco: grupo("pouco", 100, 20), muito: grupo("muito", 100, 22) });
    expect(r.base.chave).toBe("pouco");
    expect(r.curta).toBe("Quase não faz diferença.");
    expect(respostaSucesso({ nada: grupo("nada", 100, 0), pouco: grupo("pouco", 100, 0), muito: grupo("muito", 100, 5) }).vezes).toBeNull();
  });
});

describe("mapa", () => {
  const fo = (o: Partial<LinhaFontes>): LinhaFontes => ({
    ano: 2022, cargo: "Deputado federal", uf: "MG", partido: "PT", eleito: false, candidaturas: 1, com_receita: 1,
    fundo_eleitoral: 0, fundo_partidario: 0, doacoes_pessoas: 0, recursos_proprios: 0, outros_privados: 0, ...o,
  });
  const le = (o: Partial<LinhaLegenda>): LinhaLegenda => ({ ano: 2022, cargo: "Deputado federal", uf: "MG", numero: 13, partido: "PT", votos_nominais: 90, votos_legenda: 10, eleitos: 0, ...o });

  it("legendaPorUf: soma partidos do estado e ignora outros anos", () => {
    const r = legendaPorUf([le({}), le({ partido: "PL", votos_nominais: 70, votos_legenda: 30 }), le({ uf: "AP", votos_legenda: 50, votos_nominais: 50 }), le({ ano: 2018, votos_legenda: 1000 })], 2022);
    expect(r).toEqual([{ uf: "AP", valor: 0.5, base: 100 }, { uf: "MG", valor: 0.2, base: 200 }]);
    expect(legendaPorUf([le({ votos_legenda: 0, votos_nominais: 0 })], 2022)).toEqual([]);
  });

  it("conjunto: média ponderada pela base", () => {
    expect(conjunto([{ uf: "MG", valor: 0.5, base: 300 }, { uf: "AP", valor: 0.1, base: 100 }])).toEqual({ uf: "todos", valor: 0.4, base: 400 });
    expect(conjunto([])).toBeNull();
  });

  it("anoNaLegenda: o mesmo ano ou o mais perto do mesmo tipo de eleição", () => {
    const anos = [2018, 2020, 2022, 2024];
    expect(anoNaLegenda(2022, anos)).toBe(2022);
    expect(anoNaLegenda(2012, anos)).toBe(2020);
    expect(anoNaLegenda(2010, anos)).toBe(2018);
    expect(anoNaLegenda(2016, [2018, 2022])).toBe(2018);   // sem municipal: o mais perto
    expect(anoNaLegenda(2012, [])).toBeUndefined();
  });

  it("doCargo: recorta só as eleições gerais", () => {
    const ls = [le({}), le({ cargo: "Deputado estadual" }), le({ ano: 2024, cargo: "Vereador" })];
    expect(doCargo(ls, "ambos")).toHaveLength(3);
    expect(doCargo(ls, "estadual").map((l) => l.cargo)).toEqual(["Deputado estadual", "Vereador"]);
  });

  it("medirLegenda: parte da legenda sobre todos os votos; com partido, a dele sobre os votos de legenda", () => {
    const ls = [le({}), le({ partido: "PL", votos_nominais: 70, votos_legenda: 30 }), le({ uf: "AP", votos_legenda: 50, votos_nominais: 50 })];
    expect(medirLegenda(ls, { ano: 2022, uf: "MG" })).toEqual({ valor: 0.2, legenda: 40, total: 200 });
    expect(medirLegenda(ls, { ano: 2022, uf: "MG", partido: "PL" })).toEqual({ valor: 0.75, legenda: 30, total: 40 });
    expect(medirLegenda(ls, { ano: 2022 }).total).toBe(300);
    expect(medirLegenda(ls, { ano: 2022, uf: "AP", partido: "PL" }).valor).toBeNull();   // não disputou: sem dado, não zero
    expect(medirLegenda(ls, { ano: 2018 }).valor).toBeNull();
  });

  it("rankingPartidos: maior legenda primeiro, sem quem não teve voto de legenda", () => {
    const r = rankingPartidos([le({}), le({ partido: "PL", votos_nominais: 70, votos_legenda: 30 }), le({ partido: "NOVO", votos_legenda: 0 })], { ano: 2022 });
    expect(r).toEqual([{ partido: "PL", legenda: 30, valor: 0.75 }, { partido: "PT", legenda: 10, valor: 0.25 }]);
  });

  it("faixasFixas e casasDosCortes: passos redondos até o maior valor", () => {
    expect(faixasFixas(0.14)).toEqual([0.03, 0.06, 0.09, 0.12]);
    expect(faixasFixas(0.1)).toEqual([0.02, 0.04, 0.06, 0.08]);
    expect(faixasFixas(0.012)).toEqual([0.0025, 0.005, 0.0075, 0.01]);
    expect(faixasFixas(0)).toEqual([]);
    expect(casasDosCortes([0.03, 0.06])).toBe(0);
    expect(casasDosCortes([0.0025, 0.005])).toBe(2);
    expect(casasDosCortes([0.025])).toBe(1);
  });

  it("dinheiroTotal: soma todos os anos sem as campanhas nacionais", () => {
    const r = dinheiroTotal([fo({ fundo_eleitoral: 60, doacoes_pessoas: 40 }), fo({ ano: 2024, uf: "PE", fundo_partidario: 50 }), fo({ uf: "BR", cargo: "Presidente", fundo_eleitoral: 1000 })]);
    expect(r).toEqual({ total: 150, publico: 110, anos: [2022, 2024] });
    expect(dinheiroTotal([])).toBeNull();
  });
});

const pa = (o: Partial<LinhaParticipacao>): LinhaParticipacao => ({ id_municipio: 1, ano: 2012, aptos: 100, comparecimento: 80, abstencoes: 20, brancos: 2, nulos: 3, ...o });

describe("somarParticipacao", () => {
  it("taxa do conjunto é abstenções / aptos, não a média das taxas", () => {
    const t = somarParticipacao([pa({}), pa({ id_municipio: 2, aptos: 900, abstencoes: 90, comparecimento: 810 })]);
    expect(t.aptos).toBe(1000);
    expect(t.taxa).toBeCloseTo(0.11);
    expect(somarParticipacao([]).taxa).toBe(0);
  });
});

describe("serieAbstencao", () => {
  it("uma taxa por ano, só dos municípios pedidos", () => {
    const linhas = [pa({}), pa({ id_municipio: 2, abstencoes: 50 }), pa({ ano: 2008, abstencoes: 10 })];
    expect(serieAbstencao(linhas, new Set([1]))).toEqual([{ ano: 2008, taxa: 0.1 }, { ano: 2012, taxa: 0.2 }]);
    expect(serieAbstencao(linhas, null)[1].taxa).toBeCloseTo(0.35);
  });
});

describe("censoDoAno", () => {
  it("a eleição do ano do Censo e as municipais em volta; nos outros anos, nenhum", () => {
    expect([2008, 2010, 2012].map(censoDoAno)).toEqual([2010, 2010, 2010]);
    expect([2020, 2022, 2024].map(censoDoAno)).toEqual([2022, 2022, 2022]);
    expect([2014, 2016, 2018].map(censoDoAno)).toEqual([undefined, undefined, undefined]);
  });
});

describe("indicadoresDoCenso e indicadorNoCenso", () => {
  it("o Censo 2022 só tem os equivalentes do IBGE, com o rótulo da definição dele", () => {
    expect(indicadoresDoCenso(2010)).toHaveLength(10);
    expect(indicadoresDoCenso(2022)).toEqual([
      { chave: "rdpc", rotulo: "Renda por pessoa" }, { chave: "pmpob", rotulo: "Pobres" },
      { chave: "t_analf18m", rotulo: "Analfabetismo (15 anos ou mais)" }, { chave: "t_med18m", rotulo: "Ensino médio completo (18 ou mais)" },
      { chave: "t_des18m", rotulo: "Desocupação (14 ou mais)" },
    ]);
  });
  it("mantém o pedido se o Censo o tem; senão, o primeiro do Censo", () => {
    expect(indicadorNoCenso("pmpob", 2022)).toBe("pmpob");
    expect(indicadorNoCenso("idhm", 2022)).toBe("rdpc");
    expect(indicadorNoCenso("idhm", 2010)).toBe("idhm");
  });
});

describe("indicadores", () => {
  const ind = indicadoresPorMunicipio([
    { id_municipio: 1, censo: 2010, indicador: "idhm", valor: 0.8 }, { id_municipio: 1, censo: 2010, indicador: "pesotot", valor: 300 },
    { id_municipio: 2, censo: 2010, indicador: "idhm", valor: 0.6 }, { id_municipio: 2, censo: 2010, indicador: "pesotot", valor: 100 },
    { id_municipio: 3, censo: 2010, indicador: "pesotot", valor: 500 },
    { id_municipio: 1, censo: 2022, indicador: "idhm", valor: 0.1 }, { id_municipio: 1, censo: 2022, indicador: "pesotot", valor: 900 },
  ], 2010);
  it("indicadoresPorMunicipio fica só com o Censo pedido", () => {
    expect(ind.get(1)).toEqual({ idhm: 0.8, pesotot: 300 });
  });
  it("mediaPonderada pesa pela população e pula quem não tem o dado", () => {
    expect(mediaPonderada([1, 2, 3], ind, "idhm")).toBeCloseTo(0.75);
    expect(mediaPonderada([3], ind, "idhm")).toBeNull();
  });
  it("formatarIndicador usa a unidade de cada um", () => {
    expect(formatarIndicador("idhm", 0.7)).toBe("0,700");
    expect(formatarIndicador("t_analf18m", 12.34)).toBe("12,3%");
    expect(formatarIndicador("rdpc", 1234.5)).toBe("R$ 1.235");
    expect(formatarIndicador("espvida", 73.25)).toBe("73,3 anos");
  });
});

describe("quantis e classe", () => {
  it("divide em grupos de mesmo tamanho", () => {
    const c = quantis([5, 1, 4, 2, 3, 6], 3);
    expect(c).toEqual([3, 5]);
    expect([1, 2, 3, 4, 5, 6].map((v) => classe(v, c))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(quantis([], 5)).toEqual([]);
  });
});

describe("correlacao e tendencia", () => {
  it("reta perfeita dá r = ±1", () => {
    const p = [1, 2, 3, 4].map((x) => ({ x, y: 10 - 2 * x }));
    expect(correlacao(p)).toBeCloseTo(-1);
    expect(tendencia(p)).toEqual({ a: 10, b: -2 });
  });
  it("sem variação ou com poucos pontos não há correlação", () => {
    expect(correlacao([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBeNull();
    expect(correlacao([1, 2, 3].map((y) => ({ x: 5, y })))).toBeNull();
    expect(tendencia([1, 2].map((y) => ({ x: 5, y })))).toBeNull();
  });
  it("lerCorrelacao descreve força e sentido", () => {
    expect(lerCorrelacao(-0.6, "IDHM")).toBe("Relação forte: onde IDHM é maior, a abstenção tende a ser menor");
    expect(lerCorrelacao(0.2, "Gini")).toMatch(/^Relação fraca: .* maior$/);
    expect(lerCorrelacao(0.05, "Gini")).toMatch(/^Quase nenhuma/);
  });
});

describe("posicao", () => {
  it("0 no menor, 1 no maior", () => {
    expect(posicao(1, [1, 2, 3])).toBe(0);
    expect(posicao(3, [1, 2, 3])).toBe(1);
    expect(posicao(2, [2])).toBe(0.5);
  });
});

describe("nomeProprio", () => {
  it("capitaliza nomes de municípios", () => {
    expect(nomeProprio("SÃO JOSÉ DO EGITO")).toBe("São José do Egito");
    expect(nomeProprio("PALMEIRA D'OESTE")).toBe("Palmeira D'Oeste");
    expect(nomeProprio("BOM JESUS DOS PERDÕES")).toBe("Bom Jesus dos Perdões");
    expect(nomeProprio("E")).toBe("E");
  });
});

describe("enquadrar", () => {
  it("centraliza a caixa e a ajusta ao lado mais apertado", () => {
    expect(enquadrar([0, 0, 100, 50], 400, 400, 0)).toEqual({ x: 0, y: 100, k: 4 });
    const c = enquadrar([10, 10, 20, 20], 100, 100, 0.25);
    expect(c.k).toBeCloseTo(100 / 15);
  });
});

describe("taxaDe", () => {
  it("abstenções / aptos; null sem linha ou sem eleitorado", () => {
    expect(taxaDe(pa({}))).toBe(0.2);
    expect(taxaDe(undefined)).toBeNull();
    expect(taxaDe(pa({ aptos: 0 }))).toBeNull();
  });
});

describe("rotulosFaixas", () => {
  it("uma faixa a mais que os cortes, abertas nas pontas", () => {
    expect(rotulosFaixas([0.1, 0.2], (v) => `${v * 100}%`)).toEqual(["até 10%", "10%–20%", "20% ou mais"]);
    expect(rotulosFaixas([], String)).toEqual([]);
  });
});

describe("corMunicipio", () => {
  const c = { quintos: [0.1, 0.15, 0.2, 0.25], tercosAbst: [0.12, 0.2], tercosInd: [0.6, 0.7] };
  it("quinto da abstenção ou terço do indicador × terço da abstenção", () => {
    expect(corMunicipio(0.22, 0.65, c, false)).toBe("q3");
    expect(corMunicipio(0.22, 0.65, c, true)).toBe("b12");
    expect(corMunicipio(0.05, 0.9, c, true)).toBe("b20");
  });
  it("sem o dado usado, sem cor", () => {
    expect(corMunicipio(null, 0.7, c, false)).toBe("sem");
    expect(corMunicipio(0.2, undefined, c, true)).toBe("sem");
    expect(corMunicipio(0.2, undefined, c, false)).toBe("q3");   // no corte, já é o quinto de cima
  });
});

describe("lupa", () => {
  it("aproximar mantém parado o ponto do cursor", () => {
    const p = { x: 200, y: 100 };
    const l = aproximar(LUPA_INICIAL, 2, p);
    expect(l.k).toBe(2);
    expect(p.x * l.k + l.x).toBeCloseTo(p.x);
    expect(p.y * l.k + l.y).toBeCloseTo(p.y);
  });
  it("a escala fica entre 1 e o máximo, e afastar até 1 volta ao início", () => {
    expect(aproximar(LUPA_INICIAL, 1000, { x: 0, y: 0 }).k).toBe(LUPA_MAX);
    expect(aproximar(aproximar(LUPA_INICIAL, 3, { x: 300, y: 300 }), 0.01, { x: 0, y: 0 })).toEqual(LUPA_INICIAL);
  });
  it("arrastar não deixa a tela sair do desenho", () => {
    const l = aproximar(LUPA_INICIAL, 2, { x: 0, y: 0 });
    expect(arrastar(l, 5000, 5000)).toEqual({ k: 2, x: 0, y: 0 });
    expect(arrastar(l, -5000, -5000)).toEqual({ k: 2, x: -TELA.larg, y: -TELA.alt });
  });
});

describe("paleta (busca rápida)", () => {
  const indice = indicePaleta([[1, "Belo Horizonte", "MG"], [2, "Belém de Maria", "PE"], [3, "Macapá", "AP"]]);
  const titulos = (busca: string) => filtrarPaleta(indice, busca).map((i) => i.titulo);

  it("indicePaleta: páginas, um estado por UF dos municípios e os municípios com o link do mapa", () => {
    expect(indice.filter((i) => i.tipo === "estado").map((i) => i.titulo)).toEqual(["Amapá", "Minas Gerais", "Pernambuco"]);
    expect(indice.find((i) => i.titulo === "Belo Horizonte")).toEqual({ tipo: "municipio", titulo: "Belo Horizonte", detalhe: "Município · MG", href: "/?uf=MG&mun=1#mapa" });
  });

  it("filtrarPaleta: cada palavra começa uma palavra do título ou do detalhe, sem acento", () => {
    expect(titulos("bel hor")).toEqual(["Belo Horizonte"]);
    expect(titulos("macapa")).toEqual(["Macapá"]);
    expect(titulos("orizonte")).toEqual([]);   // só início de palavra
    expect(titulos("mg")).toEqual(["Minas Gerais", "Belo Horizonte"]);   // pelo detalhe; estados antes, na ordem dos itens
    expect(titulos("")).toEqual([]);
  });

  it("filtrarPaleta: quem começa pelo texto inteiro vem primeiro; limite por grupo", () => {
    expect(titulos("bel")).toEqual(["Belém de Maria", "Belo Horizonte"]);
    expect(filtrarPaleta(indice, "legenda").map((i) => i.titulo)).toEqual(["Voto de legenda", "Mapa do voto de legenda"]);
    expect(filtrarPaleta(indice, "bel", 1).map((i) => i.titulo)).toEqual(["Belém de Maria"]);   // no máximo 1 por grupo
  });

  it("candidatoNaPaleta: nome de urna e a última candidatura", () => {
    const c = { id_candidato: 7, nome_civil: "MARIA DA SILVA", nome_urna: "MARIA", uf: "PE", ultimo_ano: 2022, partido: "PT", ultimo_cargo: "Deputado federal", ultimo_eleito: true };
    expect(candidatoNaPaleta(c)).toEqual({ tipo: "candidato", titulo: "MARIA", detalhe: "Deputado federal · PE · 2022 · PT · eleito", href: "/candidato/7", foto: "/api/candidatos/7/foto?tam=mini" });
    expect(candidatoNaPaleta({ ...c, nome_urna: null, partido: null, ultimo_eleito: false }).detalhe).toBe("Deputado federal · PE · 2022");
    expect(candidatoNaPaleta({ ...c, ultimo_ano: 2016 }).foto).toBeUndefined();   // antes de 2018 o TSE não tem foto
  });

  it("agrupar: na ordem dos grupos, sem grupo vazio", () => {
    const g = agrupar([{ tipo: "candidato", titulo: "X", detalhe: "", href: "/candidato/1" }, ...filtrarPaleta(indice, "bel")]);
    expect(g.map((x) => x.tipo)).toEqual(["municipio", "candidato"]);
  });
});

describe("situacaoComparativo", () => {
  const anosPorCenso = { 2010: [2008, 2010, 2012], 2022: [2020, 2022, 2024] };
  it("fora dos anos de Censo, a camada não existe e o motivo lista os anos de cada um", () => {
    expect(situacaoComparativo({ ano: 2018, anosPorCenso, uf: "PE" })).toEqual({
      disponivel: false, pinta: false,
      motivo: "Os indicadores do Censo só são comparados com as eleições em volta dele: 2008, 2010 e 2012 (Censo 2010) e 2020, 2022 e 2024 (Censo 2022).",
    });
  });
  it("sem estado aberto, guarda a escolha mas não pinta; com estado, pinta", () => {
    expect(situacaoComparativo({ ano: 2012, anosPorCenso })).toMatchObject({ disponivel: true, pinta: false });
    expect(situacaoComparativo({ ano: 2024, anosPorCenso, uf: "RJ" })).toEqual({ disponivel: true, pinta: true, motivo: null });
  });
});

describe("resumoCamadas", () => {
  it("descreve a visão e a camada ligada", () => {
    expect(resumoCamadas({ ver: "abstencao" })).toBe("Abstenção");
    expect(resumoCamadas({ ver: "abstencao", comparativo: "IDHM" })).toBe("Abstenção × IDHM");
    expect(resumoCamadas({ ver: "legenda", partido: "PSOL" })).toBe("Voto de legenda · PSOL");
    expect(resumoCamadas({ ver: "candidato", comparativo: "IDHM" })).toBe("Votos de um candidato");
  });
});

describe("composicaoEleitorado", () => {
  const t = { aptos: 100, abstencoes: 20, comparecimento: 80, brancos: 6, nulos: 4, taxa: 0.2 };
  it("divide os aptos em quem faltou, branco ou nulo e voto válido", () => {
    expect(composicaoEleitorado(t).map((x) => [x.chave, x.n, x.p])).toEqual([["faltaram", 20, 0.2], ["brancos_nulos", 10, 0.1], ["validos", 70, 0.7]]);
  });
  it("sem eleitorado, tudo zero", () => {
    expect(composicaoEleitorado({ aptos: 0, abstencoes: 0, comparecimento: 0, brancos: 0, nulos: 0, taxa: 0 }).map((x) => x.p)).toEqual([0, 0, 0]);
  });
});

describe("compararComReferencia", () => {
  it("diferença em pontos e posição das duas na mesma régua", () => {
    const c = compararComReferencia(0.2, 0.15);
    expect(c.sentido).toBe("acima");
    expect(c.pontos).toBeCloseTo(5);
    expect(c.pTaxa).toBeCloseTo(1 / 1.2);
    expect(c.pRef).toBeCloseTo(0.75 / 1.2);
    expect(compararComReferencia(0.1, 0.15).sentido).toBe("abaixo");
    expect(compararComReferencia(0.1502, 0.15).sentido).toBe("igual");
  });
});

describe("naRegua", () => {
  const cortes = [0.1, 0.2];   // três faixas: até 10%, 10–20%, 20% ou mais; valores de 0 a 0,4
  it("cai na faixa da cor e interpola dentro dela", () => {
    expect(naRegua(0.05, cortes, 0, 0.4)).toBeCloseTo(0.5 / 3);
    expect(naRegua(0.15, cortes, 0, 0.4)).toBeCloseTo(1.5 / 3);
    expect(naRegua(0.4, cortes, 0, 0.4)).toBeCloseTo(1);
    expect(naRegua(0.1, cortes, 0, 0.4)).toBeCloseTo(1 / 3);   // no corte, já é a faixa de cima
  });
  it("faixa sem largura fica no meio dela", () => {
    expect(naRegua(0.4, [0.1, 0.4], 0, 0.4)).toBeCloseTo(2.5 / 3);   // o maior valor é o próprio corte de cima
  });
});

describe("posicionarDica", () => {
  const dica = { larg: 200, alt: 100 }, janela = { larg: 1000, alt: 800 };
  it("abaixo e à direita do cursor quando cabe", () => {
    expect(posicionarDica({ x: 100, y: 100 }, dica, janela)).toEqual({ x: 116, y: 116, esquerda: false, acima: false });
  });
  it("vira para a esquerda perto da borda direita e para cima perto da de baixo", () => {
    expect(posicionarDica({ x: 900, y: 750 }, dica, janela)).toEqual({ x: 684, y: 634, esquerda: true, acima: true });
  });
  it("numa janela menor que a dica, fica presa à margem", () => {
    expect(posicionarDica({ x: 150, y: 50 }, dica, { larg: 180, alt: 800 })).toMatchObject({ x: 8 });
  });
});

describe("lerFicha", () => {
  it("só aceita uma ficha válida", () => {
    expect(lerFicha('{"titulo":"Recife","sub":"PE","medidas":[]}')).toEqual({ titulo: "Recife", sub: "PE", medidas: [] });
    expect(lerFicha("Recife: 20%")).toBeNull();
    expect(lerFicha('{"x":1}')).toBeNull();
    expect(lerFicha(null)).toBeNull();
  });
});

describe("distribuicao", () => {
  const v = [{ id: 1, v: 0.1 }, { id: 2, v: 0.3 }, { id: 3, v: 0.2 }];
  it("escala do menor ao maior, posição e ordem do escolhido", () => {
    const d = distribuicao(v, 3);
    expect(d.pontos.map((x) => x.p)).toEqual([0, 1, expect.closeTo(0.5)]);
    expect(d).toMatchObject({ p: expect.closeTo(0.5), ordem: 2, total: 3 });
    expect(distribuicao(v, 2).ordem).toBe(1);
  });
  it("sem o escolhido, sem posição", () => {
    expect(distribuicao(v, 9)).toMatchObject({ p: null, ordem: null });
  });
});

describe("extremosAbstencao", () => {
  const l = [0.1, 0.4, 0.2, 0.3, 0.25].map((t, i) => ({ id: i, t }));
  it("os que mais e os que menos faltaram, com barras de 0 ao maior", () => {
    const e = extremosAbstencao(l, 2, 0.2);
    expect(e.mais.map((x) => x.t)).toEqual([0.4, 0.3]);
    expect(e.menos.map((x) => x.t)).toEqual([0.1, 0.2]);   // do menor para o maior
    expect(e.mais[0].p).toBe(1);
    expect(e.pMedia).toBeCloseTo(0.5);
  });
  it("com poucos municípios, não repete nenhum", () => {
    const e = extremosAbstencao(l.slice(0, 3), 4, 0.2);
    expect(e.mais.map((x) => x.id)).toEqual([1, 2]);
    expect(e.menos.map((x) => x.id)).toEqual([0]);
  });
});

describe("centrarLupa", () => {
  it("leva o ponto ao centro da tela", () => {
    const l = centrarLupa({ x: 100, y: 50 }, 3);
    expect(100 * l.k + l.x).toBe(TELA.larg / 2);
    expect(50 * l.k + l.y).toBe(TELA.alt / 2);
  });
});

describe("reguaIndicador", () => {
  it("escala do menor ao maior, um traço por posição e a média na mesma régua", () => {
    const r = reguaIndicador(0.6, [0.5, 0.7, 0.6, 0.6], 0.65);
    expect(r).toMatchObject({ min: 0.5, max: 0.7, p: expect.closeTo(0.5), pMedia: expect.closeTo(0.75) });
    expect(r.tracos).toBe("M0 0V10M50 0V10M100 0V10");
  });
  it("média fora da escala fica presa à ponta; sem dado, sem posição", () => {
    expect(reguaIndicador(null, [1, 2], 3)).toMatchObject({ p: null, pMedia: 1 });
    expect(reguaIndicador(1, [1, 2], null).pMedia).toBeNull();
  });
});

describe("escalaDoMaior", () => {
  it("o maior vale 1 e os outros, a fração dele", () => {
    expect(escalaDoMaior([{ valor: 0.26 }, { valor: 0.13 }]).map((x) => x.p)).toEqual([1, 0.5]);
    expect(escalaDoMaior([{ valor: 0 }]).map((x) => x.p)).toEqual([0]);
  });
});
