import Link from "next/link";
import { seloValor, type ResumoCargo } from "@/lib/dinheiro";
import { inteiro, reais } from "@/lib/format";

/**
 * Quanto custou cada cadeira, cargo a cargo, na mesma eleição e no mesmo lugar: um cartão por cargo com o custo da
 * cadeira (gasto de todas as campanhas ÷ cadeiras) em destaque, as cadeiras, o gasto total e quanto o eleito típico
 * gastou (mediana). O custo vem curto ("R$ 1,9 mi", como no mapa), com o valor por extenso na dica. O cargo escolhido fica em destaque e cada cartão leva ao cargo. Os valores são texto: a leitura não
 * depende de cor nem de tamanho. Componente de servidor sem JS.
 */
export function CadeirasCargos({ cargos, atual, hrefCargo, titulo }: { cargos: ResumoCargo[]; atual: string; hrefCargo: (c: string) => string; titulo: string }) {
  return (
    <ul className="cadeiras" aria-label={titulo}>
      {cargos.map((c) => {
        const on = c.cargo === atual;
        return (
          <li key={c.cargo} className={on ? "on" : undefined}>
            <Link href={hrefCargo(c.cargo)} scroll={false} aria-current={on ? "true" : undefined}>
              <span className="cd-cargo">{c.cargo}</span>
              <b className="cd-valor" title={c.porCadeira === null ? undefined : reais(c.porCadeira)}>{c.porCadeira === null ? "sem cadeiras" : `R$ ${seloValor(c.porCadeira, "gasto")}`}</b>
              <span className="cd-un">{c.porCadeira === null ? "" : "por cadeira"}</span>
              <span className="cd-linha">{inteiro(c.vagas)} {c.vagas === 1 ? "cadeira" : "cadeiras"} · {reais(c.gasto)} no total</span>
              <span className="cd-linha">Eleito típico: {c.medianaEleito === null ? "sem prestação de contas" : reais(c.medianaEleito)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
