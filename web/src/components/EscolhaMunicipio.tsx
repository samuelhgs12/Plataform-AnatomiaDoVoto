"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface Props {
  opcoes: [number | string, string][];
  atual?: number | string;
  /** os outros filtros da página inicial, que a escolha mantém */
  params: Record<string, string>;
  /** parâmetro da URL que a lista escolhe (padrão: o município) */
  nome?: string;
  rotulo?: string;
  /** a opção vazia, que tira o filtro */
  vazio?: string;
}

/**
 * Lista de municípios do estado: o caminho pelo teclado e por leitor de tela até cada município do mapa (no mapa eles
 * ficam fora da ordem de tabulação, senão seriam 853 paradas em Minas). Na visão de legenda, a mesma lista escolhe o
 * partido (`nome="p"`). Aplica na hora; sem JavaScript, envia o formulário como GET comum.
 */
export function EscolhaMunicipio({ opcoes, atual, params, nome = "mun", rotulo = "Município", vazio = "O estado inteiro" }: Props) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const ir = (valor: string) => {
    const sp = new URLSearchParams(params);
    if (valor) sp.set(nome, valor);
    iniciar(() => router.push(`/?${sp.toString()}#mapa`, { scroll: false }));
  };
  return (
    <form method="get" action="/#mapa" className="escolha-mun" aria-busy={carregando}>
      {Object.entries(params).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label>
        <span className="rotulo">{rotulo}</span>
        <select name={nome} value={atual ?? ""} onChange={(e) => ir(e.target.value)}>
          <option value="">{vazio}</option>
          {opcoes.map(([id, texto]) => <option key={id} value={id}>{texto}</option>)}
        </select>
      </label>
      <noscript><button type="submit">Ver</button></noscript>
    </form>
  );
}
