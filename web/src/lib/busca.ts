/** Pedaço de um nome, marcado se é o trecho que casou com a busca. */
export type Trecho = { texto: string; casou: boolean };

const semAcento = (c: string) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Texto digitado -> palavras sem acento e minúsculas separadas por um espaço (mesma regra de `palavras_busca` da API). */
export function normalizarBusca(texto: string): string {
  return (semAcento(texto).match(/[a-z0-9]+/g) ?? []).join(" ");
}

/**
 * Divide `nome` em trechos, marcando a 1ª ocorrência da busca que começa numa palavra, como a API casa
 * (ignora acentos, maiúsculas e pontuação: "dr lula" casa com "DR. LULA"). Sem ocorrência, devolve o nome inteiro sem marca.
 */
export function destacarBusca(nome: string, busca: string): Trecho[] {
  const alvo = normalizarBusca(busca);
  if (!alvo || !nome) return nome ? [{ texto: nome, casou: false }] : [];

  // nome normalizado com o índice de origem de cada caractere; pontuação seguida vira um espaço só
  let norm = "";
  const origem: number[] = [];
  for (let i = 0; i < nome.length; i++) {
    const c = semAcento(nome[i]);
    if (/^[a-z0-9]$/.test(c)) { norm += c; origem.push(i); }
    else if (norm && !norm.endsWith(" ")) { norm += " "; origem.push(i); }
  }

  const pos = ` ${norm}`.indexOf(` ${alvo}`);   // o espaço na frente garante início de palavra
  if (pos < 0) return [{ texto: nome, casou: false }];
  const ini = origem[pos];
  const fim = origem[pos + alvo.length - 1] + 1;
  return [
    { texto: nome.slice(0, ini), casou: false },
    { texto: nome.slice(ini, fim), casou: true },
    { texto: nome.slice(fim), casou: false },
  ].filter((t) => t.texto);
}
