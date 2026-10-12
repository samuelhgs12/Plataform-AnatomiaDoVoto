import type { Metadata } from "next";
import { apiGet } from "@/lib/api";
import type { Listagem, Meta } from "@/lib/types";
import { inteiro } from "@/lib/format";
import { CandidateCard } from "@/components/CandidateCard";
import { Filters } from "@/components/Filters";
import { Pagination } from "@/components/Pagination";

export const metadata: Metadata = { title: "Candidatos" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Candidatos({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const f = { cargo: um(sp.cargo), ano: um(sp.ano), uf: um(sp.uf), eleito: um(sp.eleito), ordem: um(sp.ordem), pagina: um(sp.pagina) };

  const consulta = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) consulta.set(k, v);
  const [meta, lista] = await Promise.all([apiGet<Meta>("/meta", 86400), apiGet<Listagem>(`/candidaturas?${consulta.toString()}`)]);

  return (
    <>
      <h1>Candidatos</h1>
      <p className="muted">Titulares de eleições ordinárias. Escolha cargo, ano e UF.</p>
      <Filters meta={meta} atual={f} />
      <p className="muted" aria-live="polite">{inteiro(lista.total)} candidatura(s)</p>
      {lista.itens.length === 0 ? (
        <div className="card"><p className="muted">Nenhum resultado para esses filtros.</p></div>
      ) : (
        <div className="grid">{lista.itens.map((c) => <CandidateCard key={c.id_candidatura} c={c} />)}</div>
      )}
      <Pagination pagina={lista.pagina} total={lista.total} tamanho={lista.tamanho} params={f} />
    </>
  );
}
