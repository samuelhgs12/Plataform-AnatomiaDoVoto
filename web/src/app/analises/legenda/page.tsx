import type { Metadata } from "next";
import Link from "next/link";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { agregarPorPartido, proporcao, type LinhaLegenda } from "@/lib/legenda";
import { compacto, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Votos de legenda" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Legenda({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerEstatico("q5");
  if (!dados?.legenda_partido) {
    return (
      <div className="card aviso">
        <h1>Votos de legenda</h1>
        <p>Os dados desta página ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py</code>.</p>
      </div>
    );
  }
  const linhas = comoObjetos<LinhaLegenda>(dados.legenda_partido);
  const ufs = [...new Set(linhas.map((l) => l.uf))].sort();
  const uf = um(sp.uf) && ufs.includes(um(sp.uf)!) ? um(sp.uf) : undefined;
  const { partidos, anos } = agregarPorPartido(linhas, uf);
  const totais = anos.map((a) => {
    let leg = 0, nom = 0;
    for (const p of partidos) { leg += p.porAno[a]?.legenda ?? 0; nom += p.porAno[a]?.nominais ?? 0; }
    return { ano: a, leg, nom };
  });

  return (
    <>
      <div className="kicker">Pergunta 5</div>
      <h1>Votos de legenda por partido</h1>
      <p className="muted">Proporção do voto do partido que foi só para a sigla: legenda ÷ (legenda + votos em candidatos). Cargos proporcionais, 1º turno, eleição ordinária.</p>
      <div className="card">
        <div className="chips" style={{ marginBottom: 12 }} aria-label="Filtrar por UF">
          <Link className={`chip${!uf ? " on" : ""}`} href="/analises/legenda">Todas as UFs</Link>
          {ufs.map((u) => <Link key={u} className={`chip${uf === u ? " on" : ""}`} href={`/analises/legenda?uf=${u}`}>{u}</Link>)}
        </div>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Partido</th>{anos.map((a) => <th key={a} className="num">{a}</th>)}</tr></thead>
            <tbody>
              <tr style={{ fontWeight: 600 }}><td>Todos os partidos</td>{totais.map((t) => <td key={t.ano} className="num">{pct(proporcao(t.leg, t.nom))}<br /><span className="muted" style={{ fontWeight: 400 }}>{compacto(t.leg)}</span></td>)}</tr>
              {partidos.slice(0, 25).map((p) => (
                <tr key={p.partido}>
                  <td>{p.partido}</td>
                  {anos.map((a) => {
                    const c = p.porAno[a];
                    return <td key={a} className="num">{c ? <>{pct(proporcao(c.legenda, c.nominais))}<br /><span className="muted">{compacto(c.legenda)}</span></> : <span className="muted">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Em cada célula: proporção e votos de legenda. Mostrando os 25 partidos com mais votos de legenda. Siglas renomeadas foram unificadas; partidos fundidos (DEM e PSL → UNIÃO) aparecem separados. TODO: gráfico de barras e mapa por município.</p>
      </div>
    </>
  );
}
