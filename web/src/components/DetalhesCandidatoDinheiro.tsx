"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { custoPorVoto } from "@/lib/dinheiro";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { brlCentavos, inteiro, reais } from "@/lib/format";
import type { LinhaCandidato } from "./LinhasCandidatos";
import { Avatar } from "./Avatar";
import { FotoCandidato } from "./FotoCandidato";
import { PartyChip } from "./PartyChip";
import { DespesasDoCandidato } from "./DespesasDoCandidato";

/** A candidatura escolhida, identificada pelo id, mesmo quando há homônimos ou não há id da pessoa. */
export function DetalhesCandidatoDinheiro({ candidato: c, ano, cargo, onFechar }: {
  candidato: LinhaCandidato; ano: number; cargo?: string; onFechar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const titulo = useId();
  const nome = c.nome_urna ?? "Nome não informado";
  const porVoto = c.prestou === false ? null : custoPorVoto(c.gasto, c.votos);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (dialogo.current && !dialogo.current.open) dialogo.current.showModal();
    return () => { document.body.style.overflow = overflow; };
  }, []);

  return (
    <dialog ref={dialogo} className="din-candidato-dialogo" aria-labelledby={titulo} onClose={onFechar}
      onClick={(e) => { if (e.target === e.currentTarget) dialogo.current?.close(); }}>
      <div className="din-candidato-topo">
        <span>Dinheiro da campanha</span>
        <button type="button" className="din-candidato-fechar" aria-label="Fechar detalhes do candidato" onClick={() => dialogo.current?.close()}>Fechar <span aria-hidden="true">×</span></button>
      </div>
      <div className="din-candidato-conteudo">
        <header className="din-candidato-cab">
          <div className="din-candidato-retrato">
            <FotoCandidato url={`/fotos-candidatos/${c.id_candidatura}.jpg`} alt={`Foto de ${nome}`} lazy={false}>
              <Avatar nome={c.nome_urna} partido={c.partido} foto={fotoDaPessoa(c)} lazy={false} />
            </FotoCandidato>
          </div>
          <div>
            <p className="din-candidato-eleicao">{cargo ?? c.cargo ?? "Campanha eleitoral"} · {ano}{c.municipio ? ` · ${c.municipio}` : ""}</p>
            <h2 id={titulo}>{nome}</h2>
            <p className="din-candidato-identidade"><PartyChip sigla={c.partido} />{c.eleito !== undefined && <span className="din-candidato-resultado" data-eleito={c.eleito}>{c.eleito ? "Eleito" : "Não eleito"}</span>}</p>
          </div>
        </header>
        <dl className="din-candidato-numeros">
          <div><dt>Gasto declarado</dt><dd>{c.prestou === false ? "Não informado" : reais(c.gasto)}</dd></div>
          <div><dt>Votos no 1º turno</dt><dd>{inteiro(c.votos)}</dd></div>
          <div><dt>Gasto por voto</dt><dd>{porVoto === null ? "Não disponível" : brlCentavos(porVoto)}</dd></div>
        </dl>
        {porVoto === null && <p className="din-candidato-nota">{c.prestou === false
          ? "Sem prestação de contas final identificada na base: o gasto é desconhecido."
          : "Sem votos registrados no 1º turno, não é possível calcular o gasto por voto."}</p>}
        <DespesasDoCandidato id={c.id_candidatura} nome={nome} />
        {c.prestou !== false && <details className="din-candidato-calculo">
          <summary>De onde veio o dinheiro</summary>
          <dl className="din-candidato-origem">
            <div><dt>Total recebido</dt><dd>{reais(c.receita)}</dd></div>
            <div><dt>Público</dt><dd>{reais(Math.max(0, Math.min(c.receita, c.receita_publica)))}</dd></div>
            <div><dt>Privado</dt><dd>{reais(Math.max(0, c.receita - c.receita_publica))}</dd></div>
          </dl>
        </details>}
        <details className="din-candidato-calculo">
          <summary>Como calculamos</summary>
          <p className="din-candidato-nota">Gasto por voto = gasto declarado da campanha ÷ votos no 1º turno. Valores declarados ao TSE.</p>
        </details>
        <footer className="din-candidato-rodape">
          {c.id_candidato != null && <Link className="din-candidato-perfil" href={`/candidato/${c.id_candidato}?campanha=${c.id_candidatura}#dinheiro`}>Ver perfil completo →</Link>}
        </footer>
      </div>
    </dialog>
  );
}

/** Controle usado nos resultados da busca e nas listas da seção Dinheiro. */
export function AbrirCandidatoDinheiro({ candidato, ano }: { candidato: LinhaCandidato; ano: number }) {
  const [aberto, setAberto] = useState(false);
  return <>
    <button type="button" className="din-abrir-candidato" aria-haspopup="dialog" onClick={() => setAberto(true)}>{candidato.nome_urna ?? "Sem nome"}</button>
    {aberto && <DetalhesCandidatoDinheiro candidato={candidato} ano={ano} onFechar={() => setAberto(false)} />}
  </>;
}
