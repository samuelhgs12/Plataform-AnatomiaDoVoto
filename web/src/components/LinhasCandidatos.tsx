import Link from "next/link";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { inteiro, pct, reais } from "@/lib/format";
import { Avatar } from "./Avatar";
import { FotoCandidato } from "./FotoCandidato";
import { PartyChip } from "./PartyChip";

export interface LinhaCandidato {
  id_candidato: number | null; id_candidatura: number; nome_urna: string | null; partido: string | null;
  votos: number; gasto: number; receita: number; receita_publica: number;
  eleito?: boolean; prestou?: boolean | null; parteVotos?: number | null; maisGastou?: boolean;
}

/**
 * Candidatos em linhas regulares (como nas listas de apuração): foto | nome e partido | resultado | gasto declarado |
 * dinheiro público (valor e parte do que recebeu), os dois alinhados à direita: as três perguntas na mesma linha.
 * Sem prestação de contas final, o valor é "Não informado", e não R$ 0. Componente de servidor (a foto é cliente).
 */
export function LinhasCandidatos({ linhas, ano, vazio }: { linhas: LinhaCandidato[]; ano: number; vazio: string }) {
  if (!linhas.length) return <p className="muted pequeno">{vazio}</p>;
  return (
    <ul className="linhas-cand">
      <li className="linhas-cab" aria-hidden="true"><span /><span>Candidato</span><span>Resultado</span><span>Gasto declarado</span><span>Dinheiro público</span></li>
      {linhas.map((c) => {
        const semDado = c.prestou === false;
        const nome = c.nome_urna ?? "Sem nome";
        return (
          <li key={c.id_candidatura}>
            <span className="linhas-foto">
              <FotoCandidato url={fotoDaPessoa({ id_candidato: c.id_candidato, ultimo_ano: ano })} alt="">
                <Avatar nome={c.nome_urna} partido={c.partido} />
              </FotoCandidato>
            </span>
            <span className="linhas-nome">
              {c.id_candidato ? <Link href={`/candidato/${c.id_candidato}?campanha=${c.id_candidatura}#dinheiro`}>{nome}</Link> : nome}
              <small><PartyChip sigla={c.partido} />{c.maisGastou && <span className="selo">gastou mais</span>}</small>
            </span>
            <span className="linhas-resultado">
              {c.eleito === undefined ? null : <b className={c.eleito ? "eleito" : undefined}>{c.eleito ? "Eleito" : "Não eleito"}</b>}
              <small>{c.votos > 0 ? `${inteiro(c.votos)} votos${c.parteVotos != null ? ` (${pct(c.parteVotos, 0)})` : ""}` : "votos não informados"}</small>
            </span>
            <span className="linhas-valor">
              {semDado ? <><b>Não informado</b><small>sem prestação final</small></> : <><b>{reais(c.gasto)}</b><small>gasto declarado</small></>}
            </span>
            <span className="linhas-valor">
              {semDado ? <b>Não informado</b>
                : <><b>{reais(c.receita_publica)}</b><small>{c.receita > 0 ? `${pct(c.receita_publica / c.receita, 0)} do que recebeu` : "nada recebido"}</small></>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
