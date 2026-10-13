import type { Metadata } from "next";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import type { Listagem, Meta } from "@/lib/types";
import { inteiro } from "@/lib/format";
import { exigeUf, resolverSelecao } from "@/lib/eleicao";
import { BuscaNome } from "@/components/BuscaNome";
import { CandidateCard } from "@/components/CandidateCard";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = { title: "Candidatos" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Candidatos({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const meta = await apiGet<Meta>("/meta", 86400);
  // sem filtros: a eleição mais recente; em ano de eleição geral o cargo padrão é presidente
  const sel = resolverSelecao(meta, um(sp.ano), um(sp.cargo), um(sp.uf));
  const faltaUf = exigeUf(sel.cargo) && !sel.uf;

  // partidos que disputaram essa eleição; um partido que não disputou (ex.: após trocar de ano) é descartado
  const consultaPartidos = new URLSearchParams({ ano: String(sel.ano), cargo: String(sel.cargo.id_cargo), ...(sel.uf && { uf: sel.uf }) });
  const partidos = faltaUf ? [] : await apiGet<string[]>(`/partidos?${consultaPartidos.toString()}`, 86400);
  const partido = um(sp.partido);
  const f = {
    ano: String(sel.ano), cargo: String(sel.cargo.id_cargo), uf: sel.uf,
    partido: partido && partidos.includes(partido) ? partido : undefined,
    eleito: um(sp.eleito), ordem: um(sp.ordem), pagina: um(sp.pagina),
  };
  const filtros = { ano: sel.ano, cargo: sel.cargo.id_cargo, uf: sel.uf, partido: f.partido, eleito: f.eleito, ordem: f.ordem };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1>Candidatos</h1>
        <BuscaNome />
      </div>
      <p className="muted">Quem disputou cada eleição: escolha o ano e o cargo e abra o perfil para ver a carreira e os gastos de campanha.</p>
      <Filters meta={meta} atual={filtros} partidos={partidos} />
      {faltaUf ? <EscolhaUf meta={meta} params={f} cargo={sel.cargo.nome} ano={sel.ano} /> : <Lista params={f} titulo={[sel.cargo.nome, sel.uf ?? "Brasil", sel.ano, f.partido].filter(Boolean).join(" · ")} />}
    </>
  );
}

/** Cargos estaduais e municipais: antes de listar, o usuário escolhe a UF. */
function EscolhaUf({ meta, params, cargo, ano }: { meta: Meta; params: Record<string, string | undefined>; cargo: string; ano: number }) {
  const href = (uf: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "pagina") sp.set(k, v);
    sp.set("uf", uf);
    return `/candidatos?${sp.toString()}`;
  };
  return (
    <section className="card" aria-labelledby="h-uf">
      <h2 id="h-uf">Escolha o estado</h2>
      <p className="muted">{cargo} é um cargo disputado em cada estado. Selecione a UF para ver os candidatos de {ano}.</p>
      <div className="chips">{meta.ufs.map((u) => <Link key={u} className="chip" href={href(u)}>{u}</Link>)}</div>
    </section>
  );
}

async function Lista({ params, titulo }: { params: Record<string, string | undefined>; titulo: string }) {
  const consulta = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) consulta.set(k, v);
  const lista = await apiGet<Listagem>(`/candidaturas?${consulta.toString()}`);
  return (
    <>
      <p className="muted" aria-live="polite"><strong>{titulo}</strong> · {inteiro(lista.total)} candidato(s)</p>
      {lista.itens.length === 0 ? (
        <div className="card"><p className="muted">Nenhum resultado para esses filtros.</p></div>
      ) : (
        <div className="grid">{lista.itens.map((c) => <CandidateCard key={c.id_candidatura} c={c} />)}</div>
      )}
      <Pagination pagina={lista.pagina} total={lista.total} tamanho={lista.tamanho} params={params} />
    </>
  );
}
