import type { CSSProperties } from "react";
import type { CarreiraItem, Receitas } from "@/lib/types";
import { resumoCampanhas, type LinhaMediana } from "@/lib/financiamento";
import { alinhamentoEsta, blocoDinheiro, LARGURA_REF_ESTREITA, pctUmaCasa, reguaComparacao, rotulosTipicos, type BlocoDinheiro, type CandidatoDisputa, type Regua } from "@/lib/dinheiro-perfil";
import { reais } from "@/lib/format";
import { reaisCentavos } from "@/lib/propaganda";
import { BarrasH } from "./BarrasH";

/**
 * Bloco do perfil "Dinheiro da campanha e resultado" (pergunta 8: recursos públicos × sucesso eleitoral). Só há receitas de 2018 em diante.
 * `campanhas` são as candidaturas com dados possíveis, da mais recente para a mais antiga, com as receitas de cada uma.
 * Com mais de uma, a lista compara todas; clicar numa linha (`hrefDe`) mostra o detalhe dela embaixo. A comparação da
 * campanha escolhida usa `medianas` (análise q8, cargos proporcionais) ou `disputa` (os adversários, cargos de uma vaga).
 *
 * Ordem: topo (parte pública, total recebido e o resultado); os cartões público e privado à esquerda e a régua de
 * comparação à direita; dois detalhes recolhidos.
 */
export function DinheiroCampanha({ campanhas, escolhida, hrefDe, medianas = null, disputa = null }: {
  campanhas: { c: CarreiraItem; r: Receitas | null }[]; escolhida: number | undefined; hrefDe: (id: number) => string;
  medianas?: LinhaMediana[] | null; disputa?: CandidatoDisputa[] | null;
}) {
  const atual = campanhas.find((x) => x.c.id_candidatura === escolhida) ?? campanhas[0];
  const resumo = resumoCampanhas(campanhas);
  return (
    <section className="card" aria-labelledby="h-din" id="dinheiro">
      <h2 id="h-din">Dinheiro da campanha e resultado</h2>
      {!atual ? (
        <p className="muted">Os dados de quanto cada campanha recebeu só existem a partir de 2018, e esta pessoa não disputou eleições desde então.</p>
      ) : (
        <>
          {resumo.length > 1 && (
            <>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {resumo.length} campanhas desde 2018. Clique numa delas para ver de onde veio o dinheiro.
              </p>
              <BarrasH compacto titulo="Quanto cada campanha recebeu" linhas={resumo.map((x) => ({
                chave: String(x.id), rotulo: `${x.ano} · ${x.cargo}`, detalhe: x.eleito ? "eleito" : "não eleito",
                valor: x.total ?? 0, classe: "pub",
                pedacos: [{ rotulo: "Dinheiro público", valor: x.publica, classe: "pub" }, { rotulo: "Dinheiro privado", valor: x.privada, classe: "priv" }],
                texto: x.total === null ? "sem dados" : reais(x.total),
                subtexto: x.total ? `público: R$ ${x.publicoDe100} de cada R$ 100` : undefined,
                href: hrefDe(x.id), atual: x.id === atual.c.id_candidatura,
              }))} />
              <div className="legend" aria-hidden="true">
                <span><i className="pub" />Dinheiro público</span><span><i className="priv" />Dinheiro privado</span>
              </div>
            </>
          )}
          <Conteudo c={atual.c} r={atual.r} medianas={medianas} disputa={disputa} />
        </>
      )}
    </section>
  );
}

function Conteudo({ c, r, medianas, disputa }: { c: CarreiraItem; r: Receitas | null; medianas: LinhaMediana[] | null; disputa: CandidatoDisputa[] | null }) {
  if (!r) return <p className="muted">Não foi possível carregar as receitas agora.</p>;
  const b = blocoDinheiro(c, r);
  if (!b) {
    return (
      <p className="manchete pequena">
        Na campanha de {c.ano} a {c.cargo.toLowerCase()}, nenhuma receita foi declarada na prestação de contas. Isso <b>não</b> quer
        dizer que o gasto foi zero.
      </p>
    );
  }
  const regua = reguaComparacao(c, b.parte, medianas, disputa);
  return (
    <>
      <div className="dc-topo">
        <p className="dc-numero dc-pct"><b>{b.topo.pct}</b><span>de dinheiro público</span></p>
        <p className="dc-numero"><b>{b.topo.total}</b><span>{b.topo.rotulo}</span></p>
        <p className={`dc-selo${b.topo.eleito ? " eleito" : ""}`}>{b.topo.eleito ? "Eleito" : "Não eleito"}</p>
      </div>
      <div className="dc-corpo">
        <Cartoes b={b} />
        <Regua regua={regua} />
      </div>
      <details>
        <summary>Ver as fontes</summary>
        <div className="tablewrap">
          <table className="dc-tabela">
            <caption className="sr-only">Dinheiro recebido pela campanha, por fonte</caption>
            <thead><tr><th>Fonte</th><th className="num">Valor recebido</th><th className="num">Parte do total</th></tr></thead>
            {b.tabela.map((g) => (
              <tbody key={g.grupo}>
                <tr className="dc-grupo"><th scope="rowgroup">{g.grupo}</th><td className="num">{reaisCentavos(Math.round(g.total * 100))}</td><td className="num">{pctUmaCasa(g.parte)}</td></tr>
                {g.fontes.map((f) => (
                  <tr key={f.rotulo}><td>{f.rotulo}</td><td className="num">{reaisCentavos(Math.round(f.valor * 100))}</td><td className="num">{pctUmaCasa(f.parte)}</td></tr>
                ))}
              </tbody>
            ))}
            <tfoot>
              <tr><th scope="row">Total</th><td className="num">{reaisCentavos(Math.round(b.tabela.reduce((s, g) => s + g.total, 0) * 100))}</td><td className="num">100,0%</td></tr>
            </tfoot>
          </table>
        </div>
      </details>
      <details>
        <summary>Como comparamos</summary>
        <div className="dc-sobre">
          <p>A campanha típica é a mediana: metade das campanhas teve uma parte pública maior e metade, menor. Entram só as campanhas
            do mesmo cargo, ano e estado que declararam alguma receita.</p>
          <p>Em presidente, governador, senador e prefeito há uma vaga por disputa: a comparação é com cada adversário da mesma
            disputa (o país, o estado ou o município).</p>
          <p>O dinheiro repassado por outras campanhas conta pela fonte de origem: o Fundo Eleitoral que um vereador recebe pela
            campanha do prefeito, por exemplo, conta como público.</p>
          <p>Os valores são os declarados ao TSE na prestação de contas final, sem correção pela inflação.</p>
        </div>
      </details>
    </>
  );
}

/** Os dois cartões, público e privado, com as fontes; as barrinhas são a parte de cada fonte no total da campanha. */
function Cartoes({ b }: { b: BlocoDinheiro }) {
  return (
    <div className="dc-esquerda">
      <div className="dc-cartoes" role="img" aria-label={b.descricao}>
        {b.cartoes.map((k) => (
          <div key={k.chave} className={`dc-cartao dc-${k.classe}`} aria-hidden="true">
            <p className="dc-cartao-cab"><b>{k.titulo}</b><span>{k.texto}</span></p>
            {k.vazio ? <p className="dc-vazio">nenhum recurso desta origem</p> : (
              <ul>
                {k.fontes.map((f) => (
                  <li key={f.chave}>
                    <b>{f.rotulo}</b><span>{f.texto}</span>
                    <span className="dc-barrinha"><i style={{ width: `max(2px, ${f.parte * 100}%)` }} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <p className="dc-nota">As barras mostram a parte de cada fonte no total da campanha.</p>
    </div>
  );
}

/**
 * A régua de "todo privado" a "todo público". As posições horizontais são sempre o percentual exato; só a altura muda.
 * Adversários (cargos de uma vaga): círculos vazados acima da linha, em até 3 alturas (`nivel` na régua larga,
 * `nivelEstreito` no celular), e esta campanha com traço e círculo cheio por cima. Típicos (cargos proporcionais): os dois
 * círculos na linha, com os rótulos embaixo; esta campanha só com o traço.
 */
function Regua({ regua }: { regua: Regua }) {
  // os rótulos dos típicos: posição igual nas duas larguras; a linha (uma ou duas) pode mudar no celular
  const [rotulos, estreitos] = [rotulosTipicos(regua.marcas), rotulosTipicos(regua.marcas, LARGURA_REF_ESTREITA)];
  const duasLinhas = [...rotulos, ...estreitos].some((r) => r?.linha);
  return (
    <figure className="dc-regua">
      <p className="dc-regua-rotulo">{regua.rotulo}</p>
      <div role="img" aria-label={regua.descricao}>
        <div className={`dc-area ${regua.caso === "adversarios" ? "dc-b" : "dc-a"}${duasLinhas ? " dc-duas" : ""}`} aria-hidden="true">
          <div className="dc-pista">
            <i className="dc-linha" />
            <i className="dc-meio" />
            <p className="dc-esta-rotulo" style={alinhamentoEsta(regua.esta.pos)}><span>{regua.esta.rotulo}</span><b>{regua.esta.pct}</b></p>
            {regua.marcas.map((m, i) => (
              <i key={i} className={regua.caso === "adversarios" ? "dc-adv" : `dc-tipico${m.ambos ? " ambos" : m.cheio ? " cheio" : ""}`} title={m.titulo}
                style={{ left: `${m.pos * 100}%`, "--nivel": m.nivel, "--nivel-e": m.nivelEstreito } as CSSProperties} />
            ))}
            <i className="dc-esta" style={{ left: `${regua.esta.pos * 100}%` }} />
            {regua.caso === "adversarios" && <i className="dc-esta-circulo" style={{ left: `${regua.esta.pos * 100}%` }} />}
            {regua.marcas.map((m, i) => rotulos[i] && (
              <p key={i} className={`dc-tipico-rotulo${m.cheio ? " cheio" : ""}`}
                style={{ left: rotulos[i]!.left, transform: rotulos[i]!.transform, "--linha": rotulos[i]!.linha, "--linha-e": estreitos[i]?.linha ?? 0 } as CSSProperties}>{m.rotulo}</p>
            ))}
          </div>
        </div>
        <p className="dc-extremos" aria-hidden="true"><span>todo privado</span><span>50%</span><span>todo público</span></p>
      </div>
      {regua.frases.length > 0 && <figcaption className="dc-frases">{regua.frases.join(" ")}</figcaption>}
    </figure>
  );
}
