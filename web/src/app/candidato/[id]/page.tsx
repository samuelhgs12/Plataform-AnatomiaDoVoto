import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet, apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import type { Perfil, Receitas } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { PartyChip } from "@/components/PartyChip";
import { Timeline } from "@/components/Timeline";
import { DinheiroCampanha } from "@/components/DinheiroCampanha";
import { PropagandaCampanha } from "@/components/PropagandaCampanha";
import { grupoPequeno, type LinhaParcelas, type LinhaReferencia, type Propaganda } from "@/lib/propaganda";
import { naLinhaDoTempo } from "@/lib/carreira";
import { fotoDoPerfil } from "@/lib/foto-candidato";
import { Rolar } from "@/components/Rolar";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };
const ANO_RECEITAS = 2018;   // a base só tem prestação de contas (receitas e despesas) de 2018 em diante

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
  // perguntas 8 e 9: campanhas com prestação de contas, da mais recente para a mais antiga; ?campanha=<id_candidatura>
  // escolhe outra (a mesma nos dois blocos)
  const comContas = disputadas.filter((c) => c.ano >= ANO_RECEITAS).reverse();
  const pedida = Number(Array.isArray(sp.campanha) ? sp.campanha[0] : sp.campanha);
  const foto = fotoDoPerfil(carreira, pedida);
  const [contas, q9] = await Promise.all([
    Promise.all(comContas.map(async (c) => ({
      c,
      r: await apiGetOpcional<Receitas>(`/candidaturas/${c.id_candidatura}/receitas`),
      p: await apiGetOpcional<Propaganda>(`/candidaturas/${c.id_candidatura}/propaganda`),
    }))),
    // pergunta 9: parcela típica de cada tipo de propaganda por cargo, ano e UF (análise q9; sem ela, sem comparação)
    comContas.length ? lerAnalise("q9", ["referencia"]) : Promise.resolve(null),
  ]);
  const referencias = q9?.referencia ? comoObjetos<LinhaReferencia>(q9.referencia) : null;
  // tirar a própria campanha da típica só importa nos grupos pequenos: só então busca a tabela "parcelas" da q9
  const escolhida = comContas.find((c) => c.id_candidatura === pedida) ?? comContas[0];
  const q9Parcelas = escolhida && grupoPequeno(referencias, escolhida) ? await lerAnalise("q9", ["parcelas"]) : null;
  const parcelas = q9Parcelas?.parcelas ? comoObjetos<LinhaParcelas>(q9Parcelas.parcelas) : null;

  return (
    <>
      <section className="quadro perfil-cab" aria-labelledby="h-cab">
        <div className="bloco s8 titulo">
          <Link href="/candidatos" className="voltar">← Voltar à listagem</Link>
          <div className="cand">
            <Avatar nome={nome} partido={ultima?.partido ?? null} foto={foto?.url} lazy={false} />
            <div>
              <h1 id="h-cab">{ultima?.nome_urna ?? nome}</h1>
              <p className="lead" style={{ margin: 0 }}>{nome}{candidato.ocupacao ? ` · ${candidato.ocupacao.toLowerCase()}` : ""}</p>
              <div style={{ marginTop: 8 }}>{ultima && <><PartyChip sigla={ultima.partido} /> <span className="muted">{ultima.cargo} · {ultima.uf} · {ultima.ano}</span></>}</div>
            </div>
          </div>
          {resumo.primeiro_ano && (
            <p className="muted" style={{ margin: "20px 0 0" }}>
              Disputou {resumo.eleicoes_disputadas} eleiç{resumo.eleicoes_disputadas === 1 ? "ão" : "ões"} entre {resumo.primeiro_ano} e {resumo.ultimo_ano}
              {resumo.vitorias ? `, venceu ${resumo.vitorias}` : ", sem vitórias"}; partidos: {resumo.partidos.join(", ") || "—"}.
            </p>
          )}
        </div>
        <div className="s4 numeros-lado">
          <div className="bloco tinta"><p className="figura"><Rolar valor={String(resumo.eleicoes_disputadas)} /></p><p>{resumo.eleicoes_disputadas === 1 ? "eleição disputada" : "eleições disputadas"}</p></div>
          <div className="numeros-par">
            <div className="bloco cinza"><p className="figura"><Rolar valor={String(resumo.vitorias)} /></p><p>{resumo.vitorias === 1 ? "vitória" : "vitórias"}</p></div>
            <div className="bloco cinza"><p className="figura"><Rolar valor={String(resumo.partidos.length)} /></p><p>{resumo.partidos.length === 1 ? "partido" : "partidos"}</p></div>
          </div>
        </div>
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

      <DinheiroCampanha campanhas={contas} escolhida={pedida} hrefDe={(c) => `/candidato/${id}?campanha=${c}#dinheiro`} />
      <PropagandaCampanha campanhas={contas} escolhida={pedida} hrefDe={(c) => `/candidato/${id}?campanha=${c}#propaganda`}
        referencias={referencias} parcelas={parcelas} />
    </>
  );
}
