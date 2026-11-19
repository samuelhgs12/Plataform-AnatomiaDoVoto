"use client";

import { useEffect, useRef, useState } from "react";
import type { DespesasCandidato } from "@/lib/types";
import { brlCentavos, pct } from "@/lib/format";

async function obterDespesas(id: number, signal = AbortSignal.timeout(15000)): Promise<DespesasCandidato> {
  const r = await fetch(`/api/dinheiro/candidaturas/${id}/despesas`, { signal });
  if (!r.ok) throw new Error("Despesas indisponíveis");
  return r.json();
}

/** Busca só ao expandir: listas grandes não disparam uma consulta para cada campanha. */
export function DespesasDoCandidato({ id, nome, abertoInicial = false }: { id: number; nome: string; abertoInicial?: boolean }) {
  const [dados, setDados] = useState<DespesasCandidato | null>(null);
  const [estado, setEstado] = useState<"inicial" | "carregando" | "pronto" | "erro">(abertoInicial ? "carregando" : "inicial");
  const buscando = useRef(false);

  async function carregar() {
    if (buscando.current) return;
    buscando.current = true;
    try {
      const resposta = await obterDespesas(id);
      setDados(resposta);
      setEstado("pronto");
    } catch {
      setEstado("erro");
    } finally {
      buscando.current = false;
    }
  }

  useEffect(() => {
    if (!abertoInicial) return;
    const ctl = new AbortController();
    void obterDespesas(id, AbortSignal.any([ctl.signal, AbortSignal.timeout(15000)]))
      .then((resposta) => { if (!ctl.signal.aborted) { setDados(resposta); setEstado("pronto"); } })
      .catch(() => { if (!ctl.signal.aborted) setEstado("erro"); });
    return () => ctl.abort();
  }, [abertoInicial, id]);

  const categorias = [...(dados?.categorias ?? [])].sort((a, b) => b.valor - a.valor);
  const teto = Math.max(0, ...categorias.map((c) => c.valor));
  return (
    <details className="despesas-candidato" open={abertoInicial || undefined} onToggle={(e) => {
      if (e.currentTarget.open && estado === "inicial") { setEstado("carregando"); void carregar(); }
    }}>
      <summary>{abertoInicial ? "Onde o dinheiro foi gasto" : "Ver despesas por tipo"}<span className="sr-only"> de {nome}</span></summary>
      <div className="despesas-candidato-corpo" aria-busy={estado === "carregando"}>
        {estado === "carregando" && <p role="status">Carregando despesas…</p>}
        {estado === "erro" && <p role="status">Não foi possível carregar as despesas. <button type="button" onClick={() => { setEstado("carregando"); void carregar(); }}>Tentar novamente</button></p>}
        {dados && !dados.prestou && <p>Não há prestação de contas final identificada na base. O gasto desta campanha é desconhecido.</p>}
        {dados?.prestou && <>
          <div className="despesas-candidato-totais">
            <span>Gasto declarado <b>{brlCentavos(dados.total ?? 0)}</b></span>
            <span>Propaganda <b>{brlCentavos(dados.propaganda ?? 0)}</b>{dados.total != null && dados.total > 0 && <small>{pct((dados.propaganda ?? 0) / dados.total, 1)} do gasto declarado</small>}</span>
          </div>
          {dados.categorias.length === 0 ? <p>Nenhuma despesa registrada na prestação final desta campanha.</p> : (
            <div className="tabela-rolar">
              <p className="despesas-candidato-ordem">Da maior para a menor despesa · Barras comparam os valores entre categorias</p>
              <table className="despesas-candidato-tabela">
                <caption className="sr-only">Despesas de {nome} por categoria do TSE</caption>
                <thead><tr><th scope="col">Tipo de despesa</th><th scope="col" className="num">Valor</th><th scope="col" className="num">Do gasto total</th></tr></thead>
                <tbody>{categorias.map((c) => (
                  <tr key={c.categoria} data-publicidade={c.publicidade}>
                    <th scope="row"><span>{c.categoria}</span>{c.publicidade && <small>Propaganda</small>}
                      <span className="despesa-trilho" aria-hidden="true"><i style={{ width: `${teto > 0 ? Math.max(0, c.valor / teto * 100) : 0}%` }} /></span>
                    </th>
                    <td className="num">{brlCentavos(c.valor)}</td><td className="num">{pct(c.pct, 1)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <details className="despesas-candidato-metodo">
            <summary>Sobre as categorias</summary>
            <p className="despesas-candidato-nota">Categorias declaradas ao TSE, incluindo propaganda, eventos e transporte quando registrados. Panfletos e santinhos podem estar agrupados em materiais impressos. Valores contratados, sem transferências a outras campanhas ou partidos.</p>
          </details>
        </>}
      </div>
    </details>
  );
}
