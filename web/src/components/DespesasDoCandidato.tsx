"use client";

import { useRef, useState } from "react";
import type { DespesasCandidato } from "@/lib/types";
import { brlCentavos, pct } from "@/lib/format";

/** Busca só ao expandir: listas grandes não disparam uma consulta para cada campanha. */
export function DespesasDoCandidato({ id, nome }: { id: number; nome: string }) {
  const [dados, setDados] = useState<DespesasCandidato | null>(null);
  const [estado, setEstado] = useState<"inicial" | "carregando" | "pronto" | "erro">("inicial");
  const buscando = useRef(false);

  async function carregar() {
    if (buscando.current) return;
    buscando.current = true;
    setEstado("carregando");
    try {
      const r = await fetch(`/api/dinheiro/candidaturas/${id}/despesas`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("Despesas indisponíveis");
      const resposta: DespesasCandidato = await r.json();
      setDados(resposta);
      setEstado("pronto");
    } catch {
      setEstado("erro");
    } finally {
      buscando.current = false;
    }
  }

  const teto = Math.max(0, ...(dados?.categorias.map((c) => c.valor) ?? []));
  return (
    <details className="despesas-candidato" onToggle={(e) => {
      if (e.currentTarget.open && estado === "inicial") void carregar();
    }}>
      <summary>Ver despesas por tipo<span className="sr-only"> de {nome}</span></summary>
      <div className="despesas-candidato-corpo" aria-busy={estado === "carregando"}>
        {estado === "carregando" && <p role="status">Carregando despesas…</p>}
        {estado === "erro" && <p role="status">Não foi possível carregar as despesas. <button type="button" onClick={() => void carregar()}>Tentar novamente</button></p>}
        {dados && !dados.prestou && <p>Não há prestação de contas final identificada na base. O gasto desta campanha é desconhecido.</p>}
        {dados?.prestou && <>
          <div className="despesas-candidato-totais">
            <span>Gasto declarado <b>{brlCentavos(dados.total ?? 0)}</b></span>
            <span>Propaganda <b>{brlCentavos(dados.propaganda ?? 0)}</b></span>
          </div>
          {dados.categorias.length === 0 ? <p>Nenhuma despesa registrada na prestação final desta campanha.</p> : (
            <div className="tabela-rolar">
              <table className="despesas-candidato-tabela">
                <caption className="sr-only">Despesas de {nome} por categoria do TSE</caption>
                <thead><tr><th scope="col">Tipo de despesa</th><th scope="col" className="num">Valor</th><th scope="col" className="num">Do gasto total</th></tr></thead>
                <tbody>{dados.categorias.map((c) => (
                  <tr key={c.categoria}>
                    <th scope="row"><span>{c.categoria}</span>{c.publicidade && <small>Propaganda</small>}
                      <span className="despesa-trilho" aria-hidden="true"><i style={{ width: `${teto > 0 ? Math.max(0, c.valor / teto * 100) : 0}%` }} /></span>
                    </th>
                    <td className="num">{brlCentavos(c.valor)}</td><td className="num">{pct(c.pct, 1)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <p className="despesas-candidato-nota">Categorias declaradas ao TSE, incluindo propaganda, eventos e transporte quando registrados. Panfletos e santinhos podem estar agrupados em materiais impressos. Valores contratados, sem transferências a outras campanhas ou partidos.</p>
        </>}
      </div>
    </details>
  );
}
