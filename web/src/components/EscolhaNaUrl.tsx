"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Lista de escolha que vira parâmetro da URL (mesmo padrão de EscolhaMunicipio e Filters): aplica na hora e a página é
 * renderizada de novo no servidor. `params` são os outros filtros, mantidos; `limpar` são os que deixam de valer com a
 * mudança (ex.: trocar de município apaga a candidatura). Sem JavaScript, o botão em <noscript> envia o formulário como GET.
 */
export function EscolhaNaUrl({ caminho, nome, rotulo, opcoes, atual, vazio, params, limpar = [], ancora }: {
  caminho: string; nome: string; rotulo: string; opcoes: [string, string][]; atual?: string; vazio: string;
  params: Record<string, string>; limpar?: string[]; ancora?: string;
}) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const mantidos = Object.fromEntries(Object.entries(params).filter(([k]) => k !== nome && !limpar.includes(k)));
  const ir = (valor: string) => {
    const sp = new URLSearchParams(mantidos);
    if (valor) sp.set(nome, valor);
    iniciar(() => router.push(`${caminho}?${sp.toString()}${ancora ? `#${ancora}` : ""}`, { scroll: false }));
  };
  return (
    <form method="get" action={caminho} className="escolha-url" aria-busy={carregando} style={{ opacity: carregando ? 0.6 : 1 }}>
      {Object.entries(mantidos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label>
        <span className="sr-only">{rotulo}</span>
        <select name={nome} value={atual ?? ""} onChange={(e) => ir(e.target.value)}>
          <option value="">{vazio}</option>
          {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <noscript><button type="submit">Ver</button></noscript>
    </form>
  );
}
