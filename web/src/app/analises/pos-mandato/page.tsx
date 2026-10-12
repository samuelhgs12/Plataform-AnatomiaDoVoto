import type { Metadata } from "next";
import Link from "next/link";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { agruparFluxo, type LinhaFluxo } from "@/lib/fluxo";
import { FlowBars } from "@/components/FlowBars";

export const metadata: Metadata = { title: "Depois de um mandato" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PosMandato({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerEstatico("q10");
  if (!dados?.fluxo) {
    return (
      <div className="card aviso">
        <h1>Depois de um mandato</h1>
        <p>Os dados desta página ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py</code>.</p>
      </div>
    );
  }
  const linhas = comoObjetos<LinhaFluxo>(dados.fluxo);
  const ufs = [...new Set(linhas.map((l) => l.uf))].sort();
  const anos = [...new Set(linhas.map((l) => l.ano_mandato))].sort();
  const uf = um(sp.uf) && ufs.includes(um(sp.uf)!) ? um(sp.uf) : undefined;
  const ano = um(sp.ano) ? Number(um(sp.ano)) : undefined;
  const grupos = agruparFluxo(linhas, { uf, anoMandato: ano && anos.includes(ano) ? ano : undefined });
  const href = (nova: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const atual = { uf, ano: ano ? String(ano) : undefined, ...nova };
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const s = p.toString();
    return `/analises/pos-mandato${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="kicker">Pergunta 10</div>
      <h1>O que acontece depois de um mandato</h1>
      <p className="muted">Para cada eleito, o que ele fez até a eleição seguinte do mesmo tipo (4 anos depois; 8 para senador). Só titulares e eleições ordinárias.</p>
      <div className="card">
        <div className="chips" style={{ marginBottom: 8 }} aria-label="Filtrar por UF">
          <Link className={`chip${!uf ? " on" : ""}`} href={href({ uf: undefined })}>Todas as UFs</Link>
          {ufs.map((u) => <Link key={u} className={`chip${uf === u ? " on" : ""}`} href={href({ uf: u })}>{u}</Link>)}
        </div>
        <div className="chips" style={{ marginBottom: 12 }} aria-label="Filtrar por ano do mandato">
          <Link className={`chip${!ano ? " on" : ""}`} href={href({ ano: undefined })}>Todos os anos</Link>
          {anos.map((a) => <Link key={a} className={`chip${ano === a ? " on" : ""}`} href={href({ ano: String(a) })}>{a}</Link>)}
        </div>
        <FlowBars grupos={grupos} />
        <p className="muted" style={{ fontSize: 12 }}>Cargos com menos de 20 mandatos ficam de fora. “Reeleito” exige o mesmo cargo no mesmo município ou estado.</p>
      </div>
    </>
  );
}
