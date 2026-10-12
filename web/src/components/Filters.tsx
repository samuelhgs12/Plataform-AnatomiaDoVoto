import type { Meta } from "@/lib/types";

export interface FiltrosAtuais { cargo?: string; ano?: string; uf?: string; eleito?: string; ordem?: string }

/** Formulário GET comum (funciona sem JavaScript): os filtros viram parâmetros da URL. */
export function Filters({ meta, atual }: { meta: Meta; atual: FiltrosAtuais }) {
  return (
    <form method="get" className="filters card" aria-label="Filtros">
      <label>Cargo
        <select name="cargo" defaultValue={atual.cargo ?? ""}>
          <option value="">Todos</option>
          {meta.cargos.filter((c) => c.eh_titular).map((c) => <option key={c.id_cargo} value={c.id_cargo}>{c.nome}</option>)}
        </select>
      </label>
      <label>Ano
        <select name="ano" defaultValue={atual.ano ?? ""}>
          <option value="">Todos</option>
          {[...meta.anos].reverse().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </label>
      <label>UF
        <select name="uf" defaultValue={atual.uf ?? ""}>
          <option value="">Todas</option>
          {meta.ufs.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>
      <label>Resultado
        <select name="eleito" defaultValue={atual.eleito ?? ""}>
          <option value="">Todos</option>
          <option value="true">Só eleitos</option>
          <option value="false">Não eleitos</option>
        </select>
      </label>
      <label>Ordenar por
        <select name="ordem" defaultValue={atual.ordem ?? "votos"}>
          <option value="votos">Votos</option>
          <option value="nome">Nome</option>
        </select>
      </label>
      <button type="submit">Filtrar</button>
    </form>
  );
}
