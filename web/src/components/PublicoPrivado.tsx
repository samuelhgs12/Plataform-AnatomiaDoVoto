import type { Fatia } from "@/lib/dinheiro";
import type { ContagemP8, TipicoP8 } from "@/lib/financiamento";
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
  /** Os nomes dos dois cartões do típico; sem eles, "Eleito" e "Não eleito" (prefeito na cidade: "Não eleitos (mediana de N)"). */
  rotulosTipicos?: { eleito: string; naoEleito: string };
  maioria: { eleitos: number | null; naoEleitos: number | null };
  /** Grupo pequeno (menos de MINIMO_CADA_100 pessoas, na cidade): a contagem no lugar da grade ("2 de 3 eleitos"). */
  contagens?: { eleitos: ContagemP8 | null; naoEleitos: ContagemP8 | null };
  /** A parte pública na eleição anterior do mesmo tipo e na atual; null sem os dois anos. */
  anos: { antes: number; depois: number; grupos: { rotulo: string; antes: string; depois: string; seta: { texto: string; classe: string } }[] } | null;
  colunas: Coluna[];
  max: number;
  /** Na cidade sem as tabelas dela: sem o recolhido "quem recebeu mais dinheiro público se elegeu mais?". */
  semSucesso?: boolean;
  /** Vereador numa cidade pequena: uma linha por faixa ("Recebeu muito: 3 eleitos de 9"), no lugar das colunas. */
  sucessoContagens?: string[];
  /** Prefeito numa cidade: a frase de sim ou não ("O candidato que mais recebeu dinheiro público venceu."). */
  sucessoFrase?: string;
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
    <div className={destaque ? "on" : undefined} role="group" aria-label={`${rotulo}: ${valorOuTraco(t?.total ?? null)}`}>
      <small>{rotulo}</small>
      <b title={valorOuTraco(t?.total ?? null)}>{valorCurto(t?.total ?? null)}</b>
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
                {tipico(d.rotulosTipicos?.eleito ?? "Eleito", d.tipicos.eleito, true)}
                {tipico(d.rotulosTipicos?.naoEleito ?? "Não eleito", d.tipicos.naoEleito, false)}
              </div>
            </section>
          )}
          {temMaioria && (
            <section className="bloco noite">
              <h3>Maioria do dinheiro foi pública</h3>
              <div className="p8-grades">
                {/* um valor por grupo, o mesmo na grade e na legenda */}
                {([["eleitos", "Eleitos", d.maioria.eleitos!, d.contagens?.eleitos], ["não eleitos", "Não eleitos", d.maioria.naoEleitos!, d.contagens?.naoEleitos]] as const).map(([quem, Quem, parte, conta], i) => conta ? (
                  <p key={quem} className="p8-contagem"><b>{conta.n} de {conta.de}</b> {quem}</p>
                ) : (
                  <figure key={quem}>
                    <GradeCem destaque={i === 0} parte={parte} titulo={`${Quem} com a maioria do dinheiro pública, ${d.recorte}`} />
                    <figcaption>{Math.round(parte * 100)} de cada 100 {quem}</figcaption>
                  </figure>
                ))}
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

      {!d.semSucesso && <details id="p8-sucesso" className="bloco noite s12 p8-recolhido">
        <summary>E quem recebeu mais dinheiro público se elegeu mais?</summary>
        {d.sucessoFrase ? <p>{d.sucessoFrase}</p>
          : d.sucessoContagens ? <ul className="p8-contagens">{d.sucessoContagens.map((l) => <li key={l}>{l}</li>)}</ul>
          : <Colunas titulo={`Parte dos candidatos que se elegeu, por quanto dinheiro público receberam, ${d.recorte}`} max={d.max} casas={(p) => (p > 0 && p < 0.01 ? 1 : 0)} colunas={d.colunas} />}
      </details>}
    </>
  );
}
