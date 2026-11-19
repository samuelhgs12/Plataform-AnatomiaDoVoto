import type { Fatia } from "@/lib/dinheiro";
import type { TipicoP8 } from "@/lib/financiamento";
import { curto, reais } from "@/lib/format";
import { BarraEmpilhada } from "./BarraEmpilhada";
import { Colunas, type Coluna } from "./Colunas";
import { GradeCem } from "./GradeCem";

/** Os dados da P8, já prontos (src/lib/financiamento.ts): o componente só desenha. */
export interface DadosP8 {
  /** "4× mais dinheiro" + a frase; null sem as medianas dos dois grupos. */
  resposta: { numero: string; frase: string } | null;
  barras: { titulo: string; total: string; fatias: Fatia[] }[];
  legenda: { chave: string; rotulo: string; cor: string }[];
  tipicos: { eleito: TipicoP8 | null; naoEleito: TipicoP8 | null };
  maioria: { eleitos: number | null; naoEleitos: number | null };
  /** A parte pública na eleição anterior do mesmo tipo e na atual; null sem os dois anos. */
  anos: { antes: number; depois: number; grupos: { rotulo: string; antes: string; depois: string; seta: { texto: string; classe: string } }[] } | null;
  colunas: Coluna[];
  max: number;
  /** Cargo, lugar e ano, para os títulos dos gráficos (leitores de tela). */
  recorte: string;
}

const valorOuTraco = (v: number | null) => (v === null ? "—" : reais(v));
/** O número grande do cartão, curto para caber numa linha ("R$ 2,3 mi"); o valor por extenso fica na dica e no leitor de tela. */
const valorCurto = (v: number | null) => (v === null ? "—" : `R$ ${curto(v)}`);

/**
 * Pergunta 8 na camada Dinheiro do mapa: eleitos × não eleitos, sempre no público e no privado. À esquerda (8 colunas),
 * a resposta e as duas barras com uma legenda só; à direita (4), o candidato típico e quantos de cada 100 tiveram a
 * maioria do dinheiro pública; embaixo, a parte pública na eleição anterior e na atual e, recolhido, quem recebeu
 * mais dinheiro público se elegeu mais. Componente de servidor, sem JS.
 */
export function PublicoPrivado({ d }: { d: DadosP8 }) {
  const temMaioria = d.maioria.eleitos !== null && d.maioria.naoEleitos !== null;
  const temTipicos = !!d.tipicos.eleito || !!d.tipicos.naoEleito;
  const tipico = (rotulo: string, t: TipicoP8 | null, destaque: boolean) => (
    <div className={destaque ? "on" : undefined} role="group" aria-label={`${rotulo}: ${valorOuTraco(t?.total ?? null)}; público ${valorOuTraco(t?.publico ?? null)}; privado ${valorOuTraco(t?.privado ?? null)}`}>
      <small>{rotulo}</small>
      <b title={valorOuTraco(t?.total ?? null)}>{valorCurto(t?.total ?? null)}</b>
      <span>público {valorOuTraco(t?.publico ?? null)}</span>
      <span>privado {valorOuTraco(t?.privado ?? null)}</span>
    </div>
  );
  return (
    <>
      <section id="p8-resposta" className={`bloco noite s12 p8-resposta${temTipicos || temMaioria ? " din-oito" : ""}`}>
        <p className="din-kicker">Eleitos × não eleitos</p>
        {d.resposta ? (
          <>
            <p className="p8-grande"><b>{d.resposta.numero}</b></p>
            <p className="p8-frase">{d.resposta.frase}</p>
          </>
        ) : <p className="muted">Sem o candidato típico dos dois grupos neste recorte.</p>}
        <div className="p8-barras">
          {d.barras.map((b) => <BarraEmpilhada key={b.titulo} semLegenda titulo={b.titulo} total={b.total} fatias={b.fatias} valor={reais} />)}
        </div>
        <ul className="din-legenda-linha" aria-hidden="true">
          {d.legenda.map((l) => <li key={l.chave}><i className={l.cor} />{l.rotulo}</li>)}
        </ul>
      </section>

      {(temTipicos || temMaioria) && (
        <aside className="numeros-lado s12 din-quatro" aria-label={`Eleitos e não eleitos em números, ${d.recorte}`}>
          {temTipicos && (
            <section className="bloco noite">
              <h3>Candidato típico recebeu</h3>
              <div className="din-tipicos">
                {tipico("Eleito", d.tipicos.eleito, true)}
                {tipico("Não eleito", d.tipicos.naoEleito, false)}
              </div>
            </section>
          )}
          {temMaioria && (
            <section className="bloco noite">
              <h3>Maioria do dinheiro foi pública</h3>
              <div className="p8-grades">
                <figure>
                  <GradeCem destaque parte={d.maioria.eleitos!} titulo={`Eleitos com a maioria do dinheiro pública, ${d.recorte}`} />
                  <figcaption>{Math.round(d.maioria.eleitos! * 100)} de cada 100 eleitos</figcaption>
                </figure>
                <figure>
                  <GradeCem parte={d.maioria.naoEleitos!} titulo={`Não eleitos com a maioria do dinheiro pública, ${d.recorte}`} />
                  <figcaption>{Math.round(d.maioria.naoEleitos! * 100)} de cada 100 não eleitos</figcaption>
                </figure>
              </div>
            </section>
          )}
        </aside>
      )}

      {d.anos && (
        <section id="p8-anos" className="bloco noite s12 p8-anos">
          <h3>Parte pública: {d.anos.antes} → {d.anos.depois}</h3>
          <div className="din-anos-p8">
            {d.anos.grupos.map((g) => (
              <div key={g.rotulo}>
                <small>{g.rotulo}</small>
                <p className="p8-ano-linha"><span>{g.antes}</span> → <b>{g.depois}</b></p>
                <p className={`delta${g.seta.classe ? ` ${g.seta.classe}` : ""}`}>{g.seta.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <details id="p8-sucesso" className="bloco noite s12 p8-recolhido">
        <summary>E quem recebeu mais dinheiro público se elegeu mais?</summary>
        <Colunas titulo={`Parte dos candidatos que se elegeu, por quanto dinheiro público receberam, ${d.recorte}`} max={d.max} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)} colunas={d.colunas} />
      </details>
    </>
  );
}
