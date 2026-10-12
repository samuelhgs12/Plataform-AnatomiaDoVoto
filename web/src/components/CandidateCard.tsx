import Link from "next/link";
import type { CandidaturaItem } from "@/lib/types";
import { compacto, ROTULO_RESULTADO } from "@/lib/format";
import { Avatar } from "./Avatar";
import { PartyChip } from "./PartyChip";

export function CandidateCard({ c }: { c: CandidaturaItem }) {
  const corpo = (
    <>
      <div className="cand">
        <Avatar nome={c.nome_urna} partido={c.partido} />
        <div>
          <div className="nome">{c.nome_urna ?? "(sem nome de urna)"}</div>
          <small>{c.numero_urna ? `Nº ${c.numero_urna} · ` : ""}{c.uf} · {c.ano}</small>
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <PartyChip sigla={c.partido} />
        <span className={`badge${c.eleito ? " eleito" : ""}`}>{ROTULO_RESULTADO[c.resultado] ?? c.resultado}</span>
        <span className="muted" style={{ fontSize: 12 }}>{compacto(c.votos)} votos</span>
      </div>
    </>
  );
  // sem id_candidato (título não divulgado) não há perfil para abrir
  return c.id_candidato ? (
    <Link href={`/candidato/${c.id_candidato}`} className="card card-link" style={{ marginBottom: 0 }}>{corpo}</Link>
  ) : (
    <div className="card" style={{ marginBottom: 0 }}>{corpo}</div>
  );
}
