"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Meta } from "@/lib/types";
import { cargoPadrao, cargosDoAno, exigeUf } from "@/lib/eleicao";

export interface FiltrosAtuais { cargo: number; ano: number; uf?: string; partido?: string; eleito?: string; ordem?: string }

/**
 * Cada filtro aplica na hora: a mudança vira parâmetro da URL e a página é renderizada de novo no servidor.
 * A lista de cargos acompanha o ano, a UF some quando o cargo é nacional e o partido só aparece depois de
 * escolhida a eleição (as opções são os partidos que tiveram candidatos nela). Sem JavaScript, o botão em
 * <noscript> envia o formulário como GET comum.
 */
export function Filters({ meta, atual, partidos }: { meta: Meta; atual: FiltrosAtuais; partidos: string[] }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const cargos = cargosDoAno(meta, atual.ano);
  const mostrarUf = exigeUf(cargos.find((c) => c.id_cargo === atual.cargo));

  const aplicar = (mudanca: Partial<Record<keyof FiltrosAtuais, string>>) => {
    const novo: Record<string, string | undefined> = {
      ano: String(atual.ano), cargo: String(atual.cargo), uf: atual.uf, partido: atual.partido, eleito: atual.eleito, ordem: atual.ordem, ...mudanca,
    };
    const ano = Number(novo.ano);
    // ao mudar de eleição geral para municipal (ou o contrário), o cargo anterior deixa de existir
    if (!cargosDoAno(meta, ano).some((c) => String(c.id_cargo) === novo.cargo)) novo.cargo = String(cargoPadrao(ano));
    if (!exigeUf(meta.cargos.find((c) => String(c.id_cargo) === novo.cargo))) delete novo.uf;

    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(novo)) if (v) sp.set(k, v);
    iniciar(() => router.push(`/candidatos?${sp.toString()}`, { scroll: false }));
  };

  return (
    <form method="get" className="filters card" aria-label="Filtros" aria-busy={carregando} style={{ opacity: carregando ? 0.6 : 1 }}>
      <label>Ano
        <select name="ano" value={atual.ano} onChange={(e) => aplicar({ ano: e.target.value })}>
          {[...meta.anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label>Cargo
        <select name="cargo" value={atual.cargo} onChange={(e) => aplicar({ cargo: e.target.value })}>
          {cargos.map((c) => <option key={c.id_cargo} value={c.id_cargo}>{c.nome}</option>)}
        </select>
      </label>
      {mostrarUf && (
        <label>UF
          <select name="uf" value={atual.uf ?? ""} onChange={(e) => aplicar({ uf: e.target.value })}>
            <option value="">Escolha…</option>
            {meta.ufs.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      )}
      {partidos.length > 0 && (
        <label>Partido
          <select name="partido" value={atual.partido ?? ""} onChange={(e) => aplicar({ partido: e.target.value })}>
            <option value="">Todos</option>
            {partidos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      )}
      <label>Resultado
        <select name="eleito" value={atual.eleito ?? ""} onChange={(e) => aplicar({ eleito: e.target.value })}>
          <option value="">Todos</option>
          <option value="true">Só eleitos</option>
          <option value="false">Não eleitos</option>
        </select>
      </label>
      <label>Ordenar por
        <select name="ordem" value={atual.ordem ?? "votos"} onChange={(e) => aplicar({ ordem: e.target.value })}>
          <option value="votos">Votos</option>
          <option value="nome">Nome</option>
        </select>
      </label>
      <noscript><button type="submit">Filtrar</button></noscript>
    </form>
  );
}
