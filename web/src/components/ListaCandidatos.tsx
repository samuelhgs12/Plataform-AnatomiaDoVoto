import Link from "next/link";
import { parteDoEleito, type CandidatoLocal } from "@/lib/territorio";
import { inteiro, pct, reais } from "@/lib/format";
import { PartyChip } from "./PartyChip";
import { Retrato } from "./Retrato";

type Linha = CandidatoLocal & { parteVotos?: number | null; maisGastou?: boolean };

/**
 * Candidatos de uma disputa na página /municipios (eleitos ou não): rosto (iniciais), nome com link para o perfil,
 * partido, votos (e a parte dos votos, quando dada), gasto e a parte pública do dinheiro. Componente de servidor, sem JS.
 * Quem não entregou a prestação final aparece como "sem prestação de contas", e não como "sem gasto".
 */
export function ListaCandidatos({ candidatos, vazio }: { candidatos: Linha[]; vazio: string }) {
  if (!candidatos.length) return <p className="muted pequeno">{vazio}</p>;
  return (
    <ul className="eleitos">
      {candidatos.map((p) => {
        const parte = parteDoEleito(p);
        return (
          <li key={p.id_candidatura} className="eleito-linha">
            <Retrato nome={p.nome_urna} partido={p.partido} />
            <div className="eleito-nome">
              {p.id_candidato ? (
                <Link href={`/candidato/${p.id_candidato}?campanha=${p.id_candidatura}#dinheiro`}>{p.nome_urna ?? "Sem nome"}</Link>
              ) : (p.nome_urna ?? "Sem nome")}
              <small>
                <PartyChip sigla={p.partido} /> {inteiro(p.votos)} votos{p.parteVotos != null && ` (${pct(p.parteVotos, 0)})`}
                {" · "}{p.eleito ? <b>eleito</b> : "não eleito"}{p.maisGastou && " · gastou mais"}
              </small>
            </div>
            <div className="eleito-dinheiro">
              <b>{!p.prestou ? "—" : p.gasto > 0 ? reais(p.gasto) : "R$ 0"}</b>
              <small>{!p.prestou ? "sem prestação de contas final" : p.gasto > 0 ? "de gasto" : "declarou gasto zero"}{p.prestou && parte !== null && ` · ${pct(parte, 0)} do dinheiro recebido era público`}</small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
