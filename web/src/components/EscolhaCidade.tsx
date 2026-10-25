"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Lista de cidades do estado na página /municipios: o caminho pelo teclado e por leitor de tela até cada cidade do mapa
 * (no mapa elas ficam fora da ordem de tabulação). Aplica na hora; sem JavaScript, envia o formulário como GET comum.
 * Próprio desta página (o EscolhaMunicipio da página inicial leva para "/").
 */
export function EscolhaCidade({ opcoes, atual, params }: { opcoes: [number, string][]; atual?: number; params: Record<string, string> }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const ir = (valor: string) => {
    const sp = new URLSearchParams(params);
    if (valor) sp.set("mun", valor);
    iniciar(() => router.push(`/municipios?${sp.toString()}#mapa`, { scroll: false }));
  };
  return (
    <form method="get" action="/municipios#mapa" className="escolha-mun" aria-busy={carregando}>
      {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label>
        <span className="rotulo">Cidade</span>
        <select name="mun" value={atual ?? ""} onChange={(e) => ir(e.target.value)}>
          <option value="">O estado inteiro</option>
          {opcoes.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
        </select>
      </label>
      <noscript><button type="submit">Ver</button></noscript>
    </form>
  );
}
