import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, apiGetOpcional } from "@/lib/api";
import type { Perfil, Receitas } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PartyChip } from "@/components/PartyChip";
import { Timeline } from "@/components/Timeline";
import { DinheiroCampanha } from "@/components/DinheiroCampanha";
import { naLinhaDoTempo } from "@/lib/carreira";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
const ANO_RECEITAS = 2018;   // a base só tem prestação de contas (receitas) de 2018 em diante

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: "Candidato" };
  const p = await apiGet<Perfil>(`/candidatos/${id}`).catch(() => null);
  return { title: p?.candidato.nome_civil ?? "Candidato" };
}

export default async function PerfilCandidato({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  if (!/^\d+$/.test(id)) notFound();

  const perfil = await apiGet<Perfil>(`/candidatos/${id}`);
  const { candidato, resumo, carreira, trocas } = perfil;
  // titulares, eleição ordinária e quem de fato disputou: é o que aparece na linha do tempo
  const disputadas = carreira.filter((c) => c.eh_titular && c.tipo_eleicao === "ORDINARIA" && c.disputou);
  const naLinha = naLinhaDoTempo(carreira);   // disputadas + vice-prefeito
  const ultima = disputadas.at(-1);
  const nome = candidato.nome_civil ?? ultima?.nome_urna ?? "Candidato";
  // pergunta 8: campanhas com dados de receita, da mais recente para a mais antiga; ?campanha=<id_candidatura> escolhe outra
  const comReceitas = disputadas.filter((c) => c.ano >= ANO_RECEITAS).reverse();
  const pedida = Number(Array.isArray(sp.campanha) ? sp.campanha[0] : sp.campanha);
  const campanhas = await Promise.all(comReceitas.map(async (c) => ({ c, r: await apiGetOpcional<Receitas>(`/candidaturas/${c.id_candidatura}/receitas`) })));

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
        {naLinha.length ? <Timeline carreira={naLinha} nome={nome} /> : <p className="muted">Nenhuma candidatura titular ou a vice-prefeito em eleição ordinária.</p>}
        {trocas.length > 0 && (
          <p style={{ marginBottom: 0 }}>
            <b>Trocas de partido:</b> {trocas.map((t) => `${t.ano}: ${t.de} → ${t.para}`).join(" · ")}
            <span className="muted"> (comparação simples de siglas; fusões e mudanças de nome podem aparecer como troca)</span>
          </p>
        )}
      </section>

      <DinheiroCampanha campanhas={campanhas} escolhida={pedida} hrefDe={(c) => `/candidato/${id}?campanha=${c}#dinheiro`} />
    </>
  );
}
