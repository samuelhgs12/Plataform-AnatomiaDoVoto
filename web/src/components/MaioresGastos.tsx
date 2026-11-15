import Link from "next/link";
import type { Maior } from "@/lib/dinheiro";
import { nomeProprio } from "@/lib/abstencao";
import { brlCentavos, compacto, pct, reais } from "@/lib/format";

/**
 * Quem mais gastou no recorte (lista de src/lib/dinheiro.ts, do maior gasto): o nome leva ao perfil, com a barra do
 * gasto na escala do maior, os votos, quanto custou cada voto, a parte pública do que recebeu e se se elegeu (escrito,
 * não só na cor; no celular, ficam o nome, o gasto e o resultado). `comLugar` mostra a cidade (eleições municipais fora de uma cidade). Componente de servidor sem JS.
 */
export function MaioresGastos({ maiores, titulo, comLugar }: { maiores: Maior[]; titulo: string; comLugar: boolean }) {
  const teto = maiores[0]?.gasto ?? 0;
  return (
    <div className="tabela-rolar">
      <table className="maiores-tabela" aria-label={titulo}>
        <thead>
          <tr>
            <th className="num mg-pos">#</th><th>Candidato</th><th>Gastou</th>
            <th className="num mg-pub">Votos</th><th className="num mg-pub">Cada voto</th><th className="num mg-pub">Público</th><th>Resultado</th>
          </tr>
        </thead>
        <tbody>
          {maiores.map((m, i) => (
            <tr key={m.id_candidatura}>
              <td className="num mg-pos">{i + 1}</td>
              <th scope="row">
                {m.id_candidato ? <Link href={`/candidato/${m.id_candidato}?campanha=${m.id_candidatura}#dinheiro`}>{nomeProprio(m.nome)}</Link> : nomeProprio(m.nome)}
                <small>{m.partido}{comLugar && m.municipio ? ` · ${nomeProprio(m.municipio)}${m.uf ? `/${m.uf}` : ""}` : ""}</small>
              </th>
              <td className="pt-gasto">
                <div>
                  <span className="pt-trilho" aria-hidden="true"><i style={{ width: `${teto > 0 ? (m.gasto / teto) * 100 : 0}%` }} /></span>
                  <b>{reais(m.gasto)}</b>
                </div>
              </td>
              <td className="num mg-pub">{compacto(m.votos)}</td>
              <td className="num mg-pub">{m.porVoto === null ? "—" : brlCentavos(m.porVoto)}</td>
              <td className="num mg-pub" title="Parte do que a campanha recebeu que veio do Fundo Eleitoral e do Fundo Partidário">{m.partePublica === null ? "—" : pct(m.partePublica, 0)}</td>
              <td><span className={`mg-res${m.eleito ? " eleito" : ""}`}>{m.eleito ? "Eleito" : "Não eleito"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
