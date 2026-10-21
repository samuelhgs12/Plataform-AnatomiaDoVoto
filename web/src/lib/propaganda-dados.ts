// Leitura dos recortes da pergunta 9 no servidor (página e busca), com cache em memória: um recorte grande (MG tem
// ~8 MB de JSON) é lido e interpretado uma vez, e a busca por nome a cada letra não relê o arquivo. O cache confere a
// data de modificação do arquivo: gerar os dados de novo (export_static.py q9) vale sem reiniciar o servidor.
// Só lê public/data/q9/ (JSON estático): nenhuma consulta à API ou ao banco.

import { stat } from "node:fs/promises";
import path from "node:path";
import { lerEstatico } from "./data";
import { conferirRecorte, lerRecorte, prepararBusca, type EntradaBusca, type Recorte } from "./propaganda";

export interface RecorteCarregado { recorte: Recorte | null; problemas: string[]; busca: () => EntradaBusca[] }

const MAX_RECORTES = 4;   // os recortes maiores (MG) ocupam dezenas de MB depois de interpretados
const cache = new Map<string, { versao: number; carregado: Promise<RecorteCarregado> }>();

/** Recorte "<ano>-<UF>" interpretado e conferido; recorte null se o arquivo não existe ou está incompleto. */
export async function carregarRecorte(arquivo: string): Promise<RecorteCarregado> {
  if (!/^\d{4}-[A-Z]{2}$/.test(arquivo)) return { recorte: null, problemas: [], busca: () => [] };
  const versao = await stat(path.join(process.cwd(), "public", "data", "q9", `${arquivo}.json`)).then((s) => s.mtimeMs, () => -1);
  const atual = cache.get(arquivo);
  if (atual && atual.versao === versao) {
    cache.delete(arquivo);
    cache.set(arquivo, atual);   // mais recente no fim (o mais antigo sai primeiro)
    return atual.carregado;
  }
  const carregado = lerEstatico(`q9/${arquivo}`).then((dados) => {
    const recorte = lerRecorte(dados);
    let indice: EntradaBusca[] | undefined;
    return { recorte, problemas: recorte ? conferirRecorte(recorte) : [], busca: () => (indice ??= recorte ? prepararBusca(recorte.candidaturas) : []) };
  });
  cache.set(arquivo, { versao, carregado });
  while (cache.size > MAX_RECORTES) cache.delete(cache.keys().next().value!);
  return carregado;
}
