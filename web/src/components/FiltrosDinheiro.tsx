"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Opcao = [string, string];

/**
 * O recorte da área "Dinheiro nas eleições": eleição, cargo, estado e município, escolhidos uma vez para as três abas.
 * Cada lista aplica na hora (router.push); sem JavaScript, o formulário é um GET comum. Sem estado escolhido, a lista
 * de municípios traz todas as cidades, agrupadas por estado (dá para achar a sua direto); com estado, só as dele.
 * Trocar o estado solta o município; escolher um município define o estado (o estado vem da cidade).
 */
export function FiltrosDinheiro({ anos, cargos, ufs, cidades, atual, fixos }: {
  anos: Opcao[]; cargos: string[]; ufs: Opcao[];
  /** null = eleição geral: não há dados por município */
  cidades: { uf: string; nome: string; opcoes: Opcao[] }[] | null;
  atual: { ano: string; cargo: string; uf: string; mun: string };
  /** parâmetros que a lista não muda (aba, vista) */
  fixos: Record<string, string>;
}) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const ir = (campo: string, valor: string) => {
    const p = new URLSearchParams({ ...fixos, ...atual, [campo]: valor });
    if (campo === "uf" || campo === "ano") p.delete("mun");
    if (campo === "mun" && valor) p.delete("uf");   // a página tira o estado da cidade: nunca fica um par incompatível
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    iniciar(() => router.push(`/analises/dinheiro?${p}`, { scroll: false }));
  };
  return (
    <form method="get" action="/analises/dinheiro" className="filtros-dinheiro" aria-busy={carregando} aria-label="Recorte: eleição, cargo e lugar">
      {Object.entries(fixos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label><span>Eleição</span>
        <select name="ano" value={atual.ano} onChange={(e) => ir("ano", e.target.value)}>
          {anos.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label><span>Cargo</span>
        <select name="cargo" value={atual.cargo} onChange={(e) => ir("cargo", e.target.value)}>
          {cargos.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label><span>Estado</span>
        <select name="uf" value={atual.uf} onChange={(e) => ir("uf", e.target.value)}>
          <option value="">Seis estados</option>
          {ufs.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label><span>Município</span>
        {cidades ? (
          <select name="mun" value={atual.mun} onChange={(e) => ir("mun", e.target.value)}>
            <option value="">Todos</option>
            {cidades.map((g) => (
              <optgroup key={g.uf} label={g.nome}>
                {g.opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </optgroup>
            ))}
          </select>
        ) : <select disabled aria-describedby="mun-geral"><option>Não se aplica</option></select>}
      </label>
      {!cidades && <p id="mun-geral" className="filtros-nota">Nas eleições gerais não há dados por município.</p>}
      <noscript><button type="submit">Aplicar</button></noscript>
    </form>
  );
}
