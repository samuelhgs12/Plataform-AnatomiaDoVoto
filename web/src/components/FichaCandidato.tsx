import type { CSSProperties } from "react";
import Link from "next/link";
import { PartyChip } from "./PartyChip";
import { VirarFicha } from "./VirarFicha";
import { FotoCandidato } from "./FotoCandidato";
import { nomeProprio } from "@/lib/abstencao";
import { partesDoNome, resumoCandidatura, type CandidaturaMapa } from "@/lib/candidato-mapa";
import { brlCentavos, iniciais, inteiro, pct, reais, ROTULO_RESULTADO } from "@/lib/format";
import { urlFoto } from "@/lib/foto-candidato";

/** As ondas do santinho, em duas camadas de tom (a de trás aparece como uma faixa fina acima da da frente). */
const Onda = ({ className }: { className: string }) => (
  <svg className={className} viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
    <path className="onda-tras" d="M0 26C90 58 190 2 290 18S380 36 400 22V60H0Z" />
    <path className="onda-frente" d="M0 38C100 64 200 14 300 30S380 46 400 34V60H0Z" />
  </svg>
);

interface Props {
  c: CandidaturaMapa;
  /** votos e válidos do 1º turno somados nos municípios do mapa (para presidente, só os seis estados) */
  noMapa: { votos: number; validos: number };
  /** "em MG" ou "nos seis estados" */
  onde: string;
}

/**
 * Ficha de consulta da candidatura, no molde de um santinho e sem nada de campanha: o mesmo cartão para todos, em
 * papel e marinho, sem cor de partido fora do chip, sem chamada de voto, e o número pequeno, preso ao ano. Do santinho
 * fica a estrutura: o nome grande no alto, o retrato embaixo à direita sobre um campo que sobe em curva e, no verso,
 * uma grade de casas, aqui com os números da candidatura. O retrato é a foto do TSE da candidatura (decisão 7), em
 * 3 × 4; sem ela, ficam as iniciais. O cartão inteiro vira ao clique (VirarFicha).
 */
export function FichaCandidato({ c, noMapa, onde }: Props) {
  const nome = nomeProprio(c.nome_urna);
  const r = resumoCandidatura(c);
  const presidente = c.cargo === "Presidente";
  const lugar = presidente ? "Brasil" : c.uf;
  const foto = urlFoto({ ano: c.ano, ue: c.ue, sequencial: c.sequencial }, "ficha");
  const fonte = <p className="ficha-fonte">Dados{foto ? " e foto" : ""} do TSE{foto ? " (CC BY)" : ""} · projeto acadêmico UFPI · não é fonte oficial</p>;
  const parte = (v: number, t: number) => (t > 0 ? `${pct(v / t, 1)} dos votos válidos` : null);

  // o sobrenome ocupa a largura do cartão: o tamanho sai do número de letras (CSS, com unidades do contêiner)
  const { antes, destaque } = partesDoNome(nome);
  const frente = (
    <>
      <div className="ficha-faixa">
        <h2 className="ficha-nome">
          {antes && <span className="ficha-nome-antes">{antes} </span>}
          <span className="ficha-nome-destaque" style={{ "--letras": destaque.length } as CSSProperties}>{destaque}</span>
        </h2>
        <p className="ficha-cargo">{c.cargo} · {lugar} · {c.ano}</p>
        <p className="ficha-partido"><PartyChip sigla={c.partido} /></p>
        <Onda className="ficha-onda-topo" />
      </div>
      <div className="ficha-meio">
        <div className="ficha-retrato">
          <FotoCandidato url={foto} alt={`Foto de ${nome}`} lazy={false}><span aria-hidden="true">{iniciais(c.nome_urna)}</span></FotoCandidato>
        </div>
      </div>
      <div className="ficha-base">
        <Onda className="ficha-onda-base" />
        {c.numero && <p className="ficha-numero">nº {c.numero} em {c.ano}</p>}
        {fonte}
      </div>
    </>
  );

  const verso = (
    <>
      <div className="ficha-verso-topo">
        <p className="ficha-verso-nome">{nome}</p>
        <p className="ficha-cargo">{c.cargo} · {lugar} · {c.ano}</p>
      </div>
      <div className="ficha-destaque">
        <p className="ficha-votos">{inteiro(c.votos_total)}</p>
        <p className="ficha-votos-legenda">
          {presidente ? "votos no país, 1º turno" : "votos no 1º turno"}
          {!presidente && parte(noMapa.votos, noMapa.validos) && <> · {parte(noMapa.votos, noMapa.validos)}</>}
        </p>
      </div>
      <dl className="ficha-casas">
        {presidente && (
          <div className="ficha-largo">
            <dt>Só nos seis estados do projeto</dt>
            <dd>{inteiro(noMapa.votos)}{parte(noMapa.votos, noMapa.validos) && <small>{parte(noMapa.votos, noMapa.validos)}</small>}</dd>
          </div>
        )}
        <div><dt>{presidente ? "Resultado da eleição" : "Resultado"}</dt><dd>{ROTULO_RESULTADO[c.resultado] ?? c.resultado}</dd></div>
        <div><dt>Disputas · mandatos</dt><dd>{c.disputas} · {c.mandatos}</dd></div>
        <div><dt>Gasto total</dt><dd>{c.gasto_total == null ? "—" : reais(c.gasto_total)}</dd></div>
        <div><dt>Gasto por voto</dt><dd>{r.gastoPorVoto == null ? "—" : brlCentavos(r.gastoPorVoto)}</dd></div>
        {r.textoMediana && <div className="ficha-largo"><dt>Comparado com o cargo</dt><dd>{r.textoMediana}<small>mediana: {reais(c.mediana_gasto_cargo!)}</small></dd></div>}
        {r.publico != null && (
          <div className="ficha-largo">
            <dt>De onde veio o dinheiro</dt>
            <dd>
              <span className="ficha-barra" role="img" aria-label={`${pct(r.publico, 0)} público (fundos eleitoral e partidário), ${pct(r.privado!, 0)} privado`}>
                <i style={{ "--v": r.publico } as CSSProperties} />
              </span>
              <span className="ficha-barra-rotulos" aria-hidden="true"><span><i className="pub" />Público {pct(r.publico, 0)}</span><span><i className="priv" />Privado {pct(r.privado!, 0)}</span></span>
            </dd>
          </div>
        )}
      </dl>
      <p className="ficha-nota">{presidente ? "O mapa mostra só os votos dos seis estados; o resultado é o da eleição nacional." : `Votos de todos os municípios ${onde}.`} Disputas e mandatos contam até {c.ano}.{c.gasto_total == null && " O TSE só tem a prestação de contas de 2018 em diante."}</p>
      <Link className="ficha-mais" href={`/candidato/${c.id_candidato}?campanha=${c.id_candidatura}`}>
        Ver mais detalhes
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
      </Link>
      {fonte}
    </>
  );

  return <VirarFicha frente={frente} verso={verso} nome={nome} />;
}
