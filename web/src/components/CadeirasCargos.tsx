import Link from "next/link";
import type { ResumoCargo } from "@/lib/dinheiro";
import { inteiro, reais } from "@/lib/format";

/**
 * Quanto custou cada cadeira, cargo a cargo, na mesma eleição e no mesmo lugar: as cadeiras, o gasto de todas as
 * campanhas, o custo da cadeira (gasto ÷ cadeiras, com a barra na escala do maior) e quanto o eleito típico gastou
 * (mediana). O cargo escolhido fica em destaque e o nome de cada cargo leva a ele. É uma tabela: a leitura não depende
 * da barra. Componente de servidor sem JS.
 */
export function CadeirasCargos({ cargos, atual, hrefCargo, titulo }: { cargos: ResumoCargo[]; atual: string; hrefCargo: (c: string) => string; titulo: string }) {
  const teto = Math.max(0, ...cargos.map((c) => c.porCadeira ?? 0));
  return (
    <div className="tabela-rolar">
      <table className="cadeiras-tabela" aria-label={titulo}>
        <thead>
          <tr><th>Cargo</th><th className="num">Cadeiras</th><th>Cada cadeira custou</th><th className="num">O eleito típico gastou</th><th className="num cd-total">Gasto total</th></tr>
        </thead>
        <tbody>
          {cargos.map((c) => (
            <tr key={c.cargo} className={c.cargo === atual ? "on" : undefined}>
              <th scope="row"><Link href={hrefCargo(c.cargo)} scroll={false} aria-current={c.cargo === atual ? "true" : undefined}>{c.cargo}</Link></th>
              <td className="num">{inteiro(c.vagas)}</td>
              <td className="pt-gasto">
                <div>
                  <span className="pt-trilho" aria-hidden="true"><i style={{ width: `${teto > 0 && c.porCadeira ? (c.porCadeira / teto) * 100 : 0}%` }} /></span>
                  <b>{c.porCadeira === null ? "—" : reais(c.porCadeira)}</b>
                </div>
              </td>
              <td className="num">{c.medianaEleito === null ? "—" : reais(c.medianaEleito)}</td>
              <td className="num cd-total">{reais(c.gasto)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
