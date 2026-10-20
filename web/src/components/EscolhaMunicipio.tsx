"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Lista de municípios do estado: o caminho pelo teclado e por leitor de tela até cada município do mapa (no mapa eles
 * ficam fora da ordem de tabulação, senão seriam 853 paradas em Minas). Aplica na hora; sem JavaScript, envia o
 * formulário como GET comum.
 */
export function EscolhaMunicipio({ opcoes, atual, params }: { opcoes: [number, string][]; atual?: number; params: Record<string, string> }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const ir = (mun: string) => {
    const sp = new URLSearchParams(params);
    if (mun) sp.set("mun", mun);
    iniciar(() => router.push(`/?${sp.toString()}#mapa`, { scroll: false }));
  };
  return (
    <form method="get" action="/#mapa" className="escolha-mun" aria-busy={carregando}>
      {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label>
        <span className="rotulo">Município</span>
        <select name="mun" value={atual ?? ""} onChange={(e) => ir(e.target.value)}>
          <option value="">O estado inteiro</option>
          {opcoes.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
      </label>
      <noscript><button type="submit">Ver</button></noscript>
    </form>
  );
}
