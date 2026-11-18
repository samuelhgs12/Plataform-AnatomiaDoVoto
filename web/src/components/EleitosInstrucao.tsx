import Link from "next/link";
import { nomeProprio } from "@/lib/abstencao";
import { urlFoto } from "@/lib/foto-candidato";
import { grauDoEleito, type EleitoInstrucao } from "@/lib/instrucao";
import { Avatar } from "./Avatar";
import { PartyChip } from "./PartyChip";

/** Um eleito: foto (ou as iniciais, como no catálogo de candidatos), nome, grau de instrução e partido; abre o perfil. */
function Cartao({ e, naMedida }: { e: EleitoInstrucao; naMedida: boolean }) {
  const classe = `eleito-inst${naMedida ? " na-medida" : ""}`;
  const corpo = (
    <>
      <Avatar nome={e.nome_urna} partido={e.partido} foto={urlFoto(e)} />
      <div>
        <p className="ei-nome">{nomeProprio(e.nome_urna ?? "") || "(sem nome de urna)"}</p>
        <p className="ei-grau"><i className={e.nivel ? `ni-${e.nivel}` : "ni-sem"} aria-hidden="true" />{grauDoEleito(e)}</p>
        <PartyChip sigla={e.partido} />
      </div>
    </>
  );
  // sem id_candidato (título não divulgado) não há perfil para abrir
  return e.id_candidato ? <Link href={`/candidato/${e.id_candidato}`} className={classe}>{corpo}</Link> : <div className={classe}>{corpo}</div>;
}

/**
 * Os eleitos do município nos detalhes de Comparar › Instrução: o prefeito e cada vereador, com a foto e o grau de
 * instrução declarado ao TSE. Quem está nos graus da medida que pinta o mapa (`niveis`) ganha contorno; o grau também vai
 * por escrito. Componente de servidor (a foto é o FotoCandidato, que volta às iniciais se a imagem falhar).
 */
export function EleitosInstrucao({ prefeito, vereadores, niveis }: { prefeito: EleitoInstrucao | null; vereadores: EleitoInstrucao[]; niveis: readonly number[] }) {
  const na = (e: EleitoInstrucao) => e.nivel != null && niveis.includes(e.nivel);
  return (
    <div className="eleitos-inst">
      <section aria-label="Prefeito eleito">
        <h4>Prefeito</h4>
        {prefeito ? <Cartao e={prefeito} naMedida={na(prefeito)} /> : <p className="muted pequeno">Nenhum prefeito eleito na eleição ordinária.</p>}
      </section>
      <section aria-label="Vereadores eleitos">
        <h4>Vereadores ({vereadores.length})</h4>
        <ul className="ei-grade">
          {vereadores.map((v) => <li key={v.id_candidatura}><Cartao e={v} naMedida={na(v)} /></li>)}
        </ul>
      </section>
    </div>
  );
}
