import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api";
import type { Perfil } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PartyChip } from "@/components/PartyChip";
import { Timeline } from "@/components/Timeline";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: "Candidato" };
  const p = await apiGet<Perfil>(`/candidatos/${id}`).catch(() => null);
  return { title: p?.candidato.nome_civil ?? "Candidato" };
}

export default async function PerfilCandidato({ params }: Props) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();

  const perfil = await apiGet<Perfil>(`/candidatos/${id}`);
  const { candidato, resumo, carreira, trocas } = perfil;
  // titulares, eleição ordinária e quem de fato disputou: é o que aparece na linha do tempo
  const disputadas = carreira.filter((c) => c.eh_titular && c.tipo_eleicao === "ORDINARIA" && c.disputou);
  const ultima = disputadas.at(-1);
  const nome = candidato.nome_civil ?? ultima?.nome_urna ?? "Candidato";

  return (
    <>
      <p><Link href="/candidatos" className="muted">← Voltar à listagem</Link></p>

      <section className="card" aria-labelledby="h-cab">
        <div className="cand">
          <Avatar nome={nome} partido={ultima?.partido ?? null} />
          <div>
            <h1 id="h-cab" style={{ marginBottom: 2 }}>{ultima?.nome_urna ?? nome}</h1>
            <small className="muted">{nome}{candidato.ocupacao ? ` · ${candidato.ocupacao.toLowerCase()}` : ""}</small>
            <div style={{ marginTop: 6 }}>{ultima && <><PartyChip sigla={ultima.partido} /> <span className="muted">{ultima.cargo} · {ultima.uf} · {ultima.ano}</span></>}</div>
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><b>{resumo.eleicoes_disputadas}</b><span>eleições disputadas</span></div>
          <div className="kpi"><b>{resumo.vitorias}</b><span>vitórias</span></div>
          <div className="kpi"><b>{resumo.partidos.length}</b><span>{resumo.partidos.length === 1 ? "partido" : "partidos"}</span></div>
        </div>
        {resumo.primeiro_ano && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Disputou {resumo.eleicoes_disputadas} eleiç{resumo.eleicoes_disputadas === 1 ? "ão" : "ões"} entre {resumo.primeiro_ano} e {resumo.ultimo_ano}
            {resumo.vitorias ? `, venceu ${resumo.vitorias}` : ", sem vitórias"}; partidos: {resumo.partidos.join(", ") || "—"}.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="h-car">
        <h2 id="h-car">Carreira eleitoral</h2>
        {disputadas.length ? <Timeline carreira={disputadas} nome={nome} /> : <p className="muted">Nenhuma candidatura titular em eleição ordinária.</p>}
        {trocas.length > 0 && (
          <p style={{ marginBottom: 0 }}>
            <b>Trocas de partido:</b> {trocas.map((t) => `${t.ano}: ${t.de} → ${t.para}`).join(" · ")}
            <span className="muted"> (comparação simples de siglas; fusões e mudanças de nome podem aparecer como troca)</span>
          </p>
        )}
      </section>

    </>
  );
}
