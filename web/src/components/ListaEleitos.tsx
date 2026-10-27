import Link from "next/link";
import { agruparEleitos, parteDoEleito, type Eleito } from "@/lib/territorio";
import { inteiro, pct, reais } from "@/lib/format";
import { PartyChip } from "./PartyChip";
import { Retrato } from "./Retrato";

/** Grupos com até este número de pessoas já vêm abertos; os maiores (vereadores, deputados) abrem num clique. */
const ABERTO_ATE = 6;

/**
 * Eleitos de um lugar, por cargo: rosto (iniciais), nome com link para o perfil (na mesma campanha), partido, votos do
 * 1º turno, gasto e a parte do dinheiro que foi pública. Componente de servidor, sem JS: os grupos usam <details>.
 */
export function ListaEleitos({ eleitos, vazio }: { eleitos: Eleito[]; vazio: string }) {
  const grupos = agruparEleitos(eleitos);
  if (!grupos.length) return <p className="muted pequeno">{vazio}</p>;
  return (
    <div className="eleitos">
      {grupos.map((g) => (
        <details key={g.cargo} open={g.pessoas.length <= ABERTO_ATE}>
          <summary>{g.titulo} <span className="muted">({inteiro(g.pessoas.length)})</span></summary>
          <ul>
            {g.pessoas.map((p) => {
              const parte = parteDoEleito(p);
              return (
                <li key={p.id_candidatura} className="eleito-linha">
                  <Retrato nome={p.nome_urna} partido={p.partido} />
                  <div className="eleito-nome">
                    {p.id_candidato ? (
                      <Link href={`/candidato/${p.id_candidato}?campanha=${p.id_candidatura}#dinheiro`}>{p.nome_urna ?? "Sem nome"}</Link>
                    ) : (p.nome_urna ?? "Sem nome")}
                    <small><PartyChip sigla={p.partido} /> {p.votos > 0 ? `${inteiro(p.votos)} votos` : p.cargo.startsWith("Vice") ? "eleito na chapa do titular" : "votos não informados"}</small>
                  </div>
                  <div className="eleito-dinheiro">
                    <b>{p.gasto > 0 ? reais(p.gasto) : "—"}</b>
                    <small>{p.gasto > 0 ? "de gasto" : "sem gasto declarado"}{parte !== null && ` · ${pct(parte, 0)} do dinheiro recebido era público`}</small>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
