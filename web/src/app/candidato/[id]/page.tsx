import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, apiGetOpcional } from "@/lib/api";
import type { Despesas, Palavra, Perfil, Receitas } from "@/lib/types";
import { pct, brl } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PartyChip } from "@/components/PartyChip";
import { Timeline } from "@/components/Timeline";
import { SpendBars } from "@/components/SpendBars";
import { WordList } from "@/components/WordList";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ candidatura?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return { title: "Candidato" };
  const p = await apiGet<Perfil>(`/candidatos/${id}`).catch(() => null);
  return { title: p?.candidato.nome_civil ?? "Candidato" };
}

export default async function PerfilCandidato({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const perfil = await apiGet<Perfil>(`/candidatos/${id}`);
  const { candidato, resumo, carreira, trocas } = perfil;
  // titulares, eleição ordinária e quem de fato disputou: é o que aparece na linha do tempo
  const disputadas = carreira.filter((c) => c.eh_titular && c.tipo_eleicao === "ORDINARIA" && c.disputou);
  const ultima = disputadas.at(-1);
  const escolhida = disputadas.find((c) => String(c.id_candidatura) === sp.candidatura) ?? ultima;

  const [despesas, palavras, receitas] = escolhida
    ? await Promise.all([
        apiGetOpcional<Despesas>(`/candidaturas/${escolhida.id_candidatura}/despesas`),
        apiGetOpcional<Palavra[]>(`/candidaturas/${escolhida.id_candidatura}/palavras`),
        apiGetOpcional<Receitas>(`/candidaturas/${escolhida.id_candidatura}/receitas`),
      ])
    : [null, null, null];
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
        <div className="kicker">Pergunta 10</div>
        <h2 id="h-car">Carreira eleitoral</h2>
        {disputadas.length ? <Timeline carreira={disputadas} nome={nome} /> : <p className="muted">Nenhuma candidatura titular em eleição ordinária.</p>}
        {trocas.length > 0 && (
          <p style={{ marginBottom: 0 }}>
            <b>Trocas de partido:</b> {trocas.map((t) => `${t.ano}: ${t.de} → ${t.para}`).join(" · ")}
            <span className="muted"> (comparação simples de siglas; fusões e mudanças de nome podem aparecer como troca)</span>
          </p>
        )}
      </section>

      {escolhida && (
        <section className="card" aria-labelledby="h-gas">
          <div className="kicker">Pergunta 9</div>
          <h2 id="h-gas">Gastos de campanha</h2>
          {disputadas.length > 1 && (
            <div className="chips" style={{ margin: "6px 0 12px" }} aria-label="Escolher candidatura">
              {disputadas.map((c) => (
                <Link key={c.id_candidatura} className={`chip${c.id_candidatura === escolhida.id_candidatura ? " on" : ""}`}
                  href={`/candidato/${id}?candidatura=${c.id_candidatura}`}>{c.ano} · {c.cargo}</Link>
              ))}
            </div>
          )}
          {despesas ? <SpendBars d={despesas} /> : <p className="muted">Não foi possível carregar os gastos agora.</p>}
          <h3 style={{ marginTop: 18 }}>O que aparece nas despesas de propaganda</h3>
          <WordList palavras={palavras ?? []} />
        </section>
      )}

      {escolhida && receitas && receitas.total > 0 && (
        <section className="card" aria-labelledby="h-rec">
          <div className="kicker">Pergunta 8</div>
          <h2 id="h-rec">De onde veio o dinheiro</h2>
          <p style={{ marginTop: 0 }}>
            {brl(receitas.total)} arrecadados em {escolhida.ano}: <b>{pct(receitas.pct_publica ?? 0, 0)}</b> de origem pública (fundos eleitoral e partidário)
            e {pct(1 - (receitas.pct_publica ?? 0), 0)} privada.
            {receitas.mediana_pct_publica_cargo != null && <> A mediana do mesmo cargo, ano e UF é {pct(receitas.mediana_pct_publica_cargo, 0)} pública.</>}
          </p>
          <div className="stack" role="img" aria-label={`Receita pública ${pct(receitas.pct_publica ?? 0, 0)}, privada ${pct(1 - (receitas.pct_publica ?? 0), 0)}`}>
            <div className="seg w2" style={{ width: `${(receitas.pct_publica ?? 0) * 100}%` }}>{(receitas.pct_publica ?? 0) > 0.08 ? "pública" : ""}</div>
            <div className="seg o" style={{ width: `${(1 - (receitas.pct_publica ?? 0)) * 100}%` }}>{(receitas.pct_publica ?? 0) < 0.92 ? "privada" : ""}</div>
          </div>
        </section>
      )}
    </>
  );
}
