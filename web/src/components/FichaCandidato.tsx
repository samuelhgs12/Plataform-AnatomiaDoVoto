import type { CSSProperties } from "react";
import Link from "next/link";
import { PartyChip } from "./PartyChip";
import { VirarFicha } from "./VirarFicha";
import { nomeProprio } from "@/lib/abstencao";
import { resumoCandidatura, type CandidaturaMapa } from "@/lib/candidato-mapa";
import { brlCentavos, iniciais, inteiro, pct, reais, ROTULO_RESULTADO } from "@/lib/format";

interface Props {
  c: CandidaturaMapa;
  /** votos e válidos do 1º turno somados nos municípios do mapa (para presidente, só os seis estados) */
  noMapa: { votos: number; validos: number };
  /** "em MG" ou "nos seis estados" */
  onde: string;
}

/**
 * Ficha de consulta da candidatura, no molde de um santinho mas sem nada de campanha: o mesmo desenho para todos,
 * sem cor de partido fora do chip, sem chamada de voto. O número aparece pequeno e preso ao ano. A frente tem o
 * espaço de uma foto 3 × 4 (decisão 7: sem foto; ficam as iniciais); o verso, os números da candidatura.
 */
export function FichaCandidato({ c, noMapa, onde }: Props) {
  const nome = nomeProprio(c.nome_urna);
  const r = resumoCandidatura(c);
  const presidente = c.cargo === "Presidente";
  const fonte = <p className="ficha-fonte">Dados do TSE · projeto acadêmico UFPI · não é fonte oficial</p>;

  const frente = (
    <>
      <div className="ficha-retrato" aria-hidden="true"><span>{iniciais(c.nome_urna)}</span><small>3 × 4</small></div>
      <div className="ficha-id">
        <p className="ficha-cargo">{c.cargo} · {presidente ? "Brasil" : c.uf}</p>
        <h2 className="ficha-nome">{nome}</h2>
        <p className="ficha-partido"><PartyChip sigla={c.partido} /><span>eleição de {c.ano}</span></p>
      </div>
      <p className="ficha-numero">nº {c.numero} em {c.ano}</p>
      {fonte}
    </>
  );

  const verso = (
    <>
      <h3 className="ficha-titulo">{nome} em {c.ano}</h3>
      <dl className="ficha-dados">
        <div className="ficha-largo">
          <dt>{presidente ? "Votos no país, 1º turno" : "Votos no 1º turno"}</dt>
          <dd>{inteiro(c.votos_total)}{!presidente && noMapa.validos > 0 && <small> · {pct(noMapa.votos / noMapa.validos, 1)} dos válidos</small>}</dd>
        </div>
        {presidente && (
          <div className="ficha-largo">
            <dt>Só nos seis estados (AP, ES, MG, PE, RJ e RR)</dt>
            <dd>{inteiro(noMapa.votos)}{noMapa.validos > 0 && <small> · {pct(noMapa.votos / noMapa.validos, 1)} dos válidos</small>}</dd>
          </div>
        )}
        <div><dt>{presidente ? "Resultado da eleição" : "Resultado"}</dt><dd>{ROTULO_RESULTADO[c.resultado] ?? c.resultado}</dd></div>
        <div><dt>Disputas · mandatos</dt><dd>{c.disputas} · {c.mandatos}</dd></div>
        <div><dt>Gasto total</dt><dd>{reais(c.gasto_total)}</dd></div>
        <div><dt>Gasto por voto</dt><dd>{r.gastoPorVoto == null ? "—" : brlCentavos(r.gastoPorVoto)}</dd></div>
        {r.textoMediana && <div className="ficha-largo"><dt>Comparado com o cargo</dt><dd>{r.textoMediana}<small> ({reais(c.mediana_gasto_cargo)})</small></dd></div>}
        {r.publico != null && (
          <div className="ficha-largo">
            <dt>De onde veio o dinheiro</dt>
            <dd>
              <span className="ficha-barra" role="img" aria-label={`${pct(r.publico, 0)} público (fundos eleitoral e partidário), ${pct(r.privado!, 0)} privado`}>
                <i className="pub" style={{ "--v": r.publico } as CSSProperties} />
              </span>
              <span className="ficha-barra-rotulos" aria-hidden="true"><span><i className="pub" />Público {pct(r.publico, 0)}</span><span><i className="priv" />Privado {pct(r.privado!, 0)}</span></span>
            </dd>
          </div>
        )}
      </dl>
      <p className="ficha-nota">{presidente ? "O mapa mostra só os votos dos seis estados do projeto; o resultado é o da eleição nacional." : `Votos de todos os municípios ${onde}.`} Disputas e mandatos contam até {c.ano}.</p>
      <Link className="ficha-mais" href={`/candidato/${c.id_candidato}?campanha=${c.id_candidatura}`}>
        Ver mais detalhes
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </Link>
      {fonte}
    </>
  );

  return <VirarFicha frente={frente} verso={verso} rotulo={`Ficha de ${nome}, ${c.cargo.toLowerCase()} em ${c.ano}`} />;
}
