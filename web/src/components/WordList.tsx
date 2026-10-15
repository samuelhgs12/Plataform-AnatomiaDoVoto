import type { Palavra } from "@/lib/types";

/**
 * Termos mais frequentes nas descrições das despesas de propaganda, com tamanho proporcional à frequência.
 * TODO: trocar por uma nuvem de palavras de verdade (echarts-wordcloud ou d3-cloud) mantendo esta lista como alternativa acessível.
 */
export function WordList({ palavras }: { palavras: Palavra[] }) {
  if (!palavras.length) return <p className="muted">Sem descrições de propaganda para esta candidatura.</p>;
  const max = Math.max(...palavras.map((p) => p.freq));
  return (
    <ul className="words" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {palavras.slice(0, 40).map((p) => (
        <li key={p.termo} style={{ fontSize: 14 + Math.round((p.freq / max) * 16), opacity: 0.6 + 0.4 * (p.freq / max) }} title={`${p.freq} ocorrência(s)`}>{p.termo}</li>
      ))}
    </ul>
  );
}
