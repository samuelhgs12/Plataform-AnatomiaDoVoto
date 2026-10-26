import type { CSSProperties } from "react";
import { textoPontos, type SomaTurno } from "@/lib/candidato-mapa";
import { inteiro, pct } from "@/lib/format";

interface Props {
  /** de variacaoTurnos (src/lib/candidato-mapa.ts) */
  v: { t1: SomaTurno; t2: SomaTurno; pontos: number | null };
  nome: string;
  /** "em Pernambuco" ou "nos seis estados" */
  onde: string;
  /** "governador" */
  cargo: string;
}

/**
 * Do 1º ao 2º turno, ao lado da ficha: duas barras na mesma régua de 0 a 100% dos válidos, com a linha da metade
 * (quem passa dela vence o 2º turno). Na barra do 2º turno, o trecho entre os dois turnos é o que mudou: cheio quando
 * a parte cresceu, tracejado (o que ficou para trás) quando caiu. Os números estão escritos; a cor não carrega sozinha.
 */
export function VariacaoTurnos({ v, nome, onde, cargo }: Props) {
  const { t1, t2, pontos } = v;
  if (t1.p == null || t2.p == null || pontos == null) return null;
  const ganho = pontos >= 0;
  const linha = (t: SomaTurno, p: number) => (
    <div className="turnos-linha">
      <span className="turnos-rot">{t.turno}º turno</span>
      <span className="turnos-trilho">
        <i className="turnos-base" style={{ "--v": t.turno === 2 ? Math.min(t1.p!, p) : p } as CSSProperties} />
        {t.turno === 2 && (
          <>
            <i className={`turnos-dif ${ganho ? "ganho" : "perda"}`} style={{ "--de": Math.min(t1.p!, p), "--ate": Math.max(t1.p!, p) } as CSSProperties} />
            <i className="turnos-antes" style={{ "--v": t1.p! } as CSSProperties} />
          </>
        )}
      </span>
      <span className="turnos-val"><b>{pct(p, 1)}</b><small>{inteiro(t.votos)} votos</small></span>
    </div>
  );

  return (
    <div className="bloco noite turnos-bloco">
      <h3>Do 1º ao 2º turno</h3>
      <p className="turnos-num">{textoPontos(pontos)}</p>
      <p className="r-texto">
        Parte dos votos válidos para {cargo} que foi para {nome} {onde}: {pct(t1.p, 1)} no 1º turno e {pct(t2.p, 1)} no 2º.
      </p>
      <div
        className="turnos-barras" role="img"
        aria-label={`${nome} ${onde}: ${pct(t1.p, 1)} dos válidos no 1º turno (${inteiro(t1.votos)} votos) e ${pct(t2.p, 1)} no 2º (${inteiro(t2.votos)} votos), ${textoPontos(pontos)}.`}
      >
        {linha(t1, t1.p)}
        {linha(t2, t2.p)}
        <span className="turnos-metade" aria-hidden="true"><span>metade dos válidos</span></span>
      </div>
    </div>
  );
}
