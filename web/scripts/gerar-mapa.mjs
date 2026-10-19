// Converte a malha de UFs do IBGE (SVG, qualidade mínima) em caminhos absolutos para src/lib/brasil-uf.ts.
// Uso (a partir de web/):
//   curl -o br.svg "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=image/svg%2Bxml&qualidade=minima&intrarregiao=UF"
//   node scripts/gerar-mapa.mjs br.svg src/lib/brasil-uf.ts
import { readFileSync, writeFileSync } from "node:fs";

const [entrada, saida] = process.argv.slice(2);
const svg = readFileSync(entrada, "utf-8");
const UF = {
  11: ["RO", "Rondônia"], 12: ["AC", "Acre"], 13: ["AM", "Amazonas"], 14: ["RR", "Roraima"], 15: ["PA", "Pará"],
  16: ["AP", "Amapá"], 17: ["TO", "Tocantins"], 21: ["MA", "Maranhão"], 22: ["PI", "Piauí"], 23: ["CE", "Ceará"],
  24: ["RN", "Rio Grande do Norte"], 25: ["PB", "Paraíba"], 26: ["PE", "Pernambuco"], 27: ["AL", "Alagoas"],
  28: ["SE", "Sergipe"], 29: ["BA", "Bahia"], 31: ["MG", "Minas Gerais"], 32: ["ES", "Espírito Santo"],
  33: ["RJ", "Rio de Janeiro"], 35: ["SP", "São Paulo"], 41: ["PR", "Paraná"], 42: ["SC", "Santa Catarina"],
  43: ["RS", "Rio Grande do Sul"], 50: ["MS", "Mato Grosso do Sul"], 51: ["MT", "Mato Grosso"], 52: ["GO", "Goiás"],
  53: ["DF", "Distrito Federal"],
};

// lê os anéis (lon, lat) de cada estado
const estados = [...svg.matchAll(/<path id="(\d+)" d="([^"]+)"/g)].map(([, id, d]) => {
  const aneis = [];
  let x = 0, y = 0, anel;
  for (const [, cmd, args] of d.matchAll(/([MlhvZ])([^MlhvZ]*)/g)) {
    if (cmd === "Z") continue;
    const nums = args.split(/[ ,]+/).filter(Boolean).map(Number);
    if (cmd === "h" || cmd === "v") { // relativo, só um eixo
      for (const n of nums) { if (cmd === "h") x += n; else y += n; anel.push([x * 1e-4, y * 1e-4]); }
      continue;
    }
    for (let i = 0; i < nums.length; i += 2) {
      if (cmd === "M" && i === 0) { x = nums[0]; y = nums[1]; anel = []; aneis.push(anel); }
      else { x += nums[i]; y += nums[i + 1]; }
      anel.push([x * 1e-4, y * 1e-4]); // grupo tem scale(0.0001,-0.0001): y é a latitude
    }
  }
  return { id: Number(id), aneis };
});

const todos = estados.flatMap((e) => e.aneis.flat());
const lonMin = Math.min(...todos.map((p) => p[0])), lonMax = Math.max(...todos.map((p) => p[0]));
const latMin = Math.min(...todos.map((p) => p[1])), latMax = Math.max(...todos.map((p) => p[1]));
const k = Math.cos((((latMin + latMax) / 2) * Math.PI) / 180); // equirretangular corrigida no centro
const LARGURA = 600;
const escala = LARGURA / ((lonMax - lonMin) * k);
const proj = ([lon, lat]) => [(lon - lonMin) * k * escala, (latMax - lat) * escala];
const r = (n) => Math.round(n * 10) / 10;

const area = (a) => a.reduce((s, p, i) => { const q = a[(i + 1) % a.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
function centroide(a) {
  const A = area(a);
  let cx = 0, cy = 0;
  a.forEach((p, i) => { const q = a[(i + 1) % a.length]; const f = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; });
  return [cx / (6 * A), cy / (6 * A)];
}

const saidaUFs = estados.map(({ id, aneis }) => {
  const planos = aneis.map((a) => {
    const pts = [];
    for (const p of a.map(proj)) { // descarta pontos a menos de 1,2 unidade do anterior
      const ult = pts[pts.length - 1];
      if (!ult || Math.hypot(p[0] - ult[0], p[1] - ult[1]) >= 1.2) pts.push(p);
    }
    return pts;
  }).filter((a) => a.length >= 3);
  const d = planos.map((a) => "M" + a.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join("L") + "Z").join("");
  const maior = planos.reduce((m, a) => (Math.abs(area(a)) > Math.abs(area(m)) ? a : m));
  const [x, y] = centroide(maior);
  const [uf, nome] = UF[id];
  return { uf, nome, d, x: r(x), y: r(y) };
});

const altura = r((latMax - latMin) * escala);
const ts = `// Gerado a partir da malha de UFs do IBGE (API de malhas v3, qualidade mínima). Não editar à mão.
// Fonte: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
// Projeção equirretangular, ${LARGURA} × ${altura} unidades; x/y = centroide do maior polígono (posição do rótulo).

export type EstadoMapa = { uf: string; nome: string; d: string; x: number; y: number };

export const MAPA_LARGURA = ${LARGURA};
export const MAPA_ALTURA = ${altura};

export const ESTADOS_MAPA: EstadoMapa[] = [
${saidaUFs.map((e) => "  " + JSON.stringify(e)).join(",\n")},
];
`;
writeFileSync(saida, ts);
console.log(saidaUFs.length, "UFs;", ts.length, "bytes; altura", altura);
