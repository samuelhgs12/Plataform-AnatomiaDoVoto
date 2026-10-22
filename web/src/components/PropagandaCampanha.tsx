import type { CarreiraItem } from "@/lib/types";
import { textoDe100 } from "@/lib/financiamento";
import { inteiro, reais } from "@/lib/format";
import {
  analisar, composicaoPorTipo, grupo, GRUPOS, nomearPredominantes, parteTexto, reaisCentavos, resumoPropaganda,
  type Analise, type Propaganda,
} from "@/lib/propaganda";
import { BarrasH } from "./BarrasH";

const r$ = (centavos: number) => reais(centavos / 100);
/** Só a primeira letra: "Programas de rádio, TV ou vídeo" → "programas de rádio, TV ou vídeo". */
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Bloco do perfil "Propaganda da campanha" (pergunta 9: onde o candidato investe em propaganda). Só há prestação de contas
 * de 2018 em diante. `campanhas` são as mesmas do bloco de dinheiro (da mais recente para a mais antiga), com a propaganda
 * de cada uma vinda da API; a campanha escolhida (`?campanha=`) é a mesma nos dois blocos.
 */
export function PropagandaCampanha({ campanhas, escolhida, hrefDe }: {
  campanhas: { c: CarreiraItem; p: Propaganda | null }[]; escolhida: number | undefined; hrefDe: (id: number) => string;
}) {
  const atual = campanhas.find((x) => x.c.id_candidatura === escolhida) ?? campanhas[0];
  const resumo = resumoPropaganda(campanhas);
  return (
    <section className="card" aria-labelledby="h-prop" id="propaganda">
      <h2 id="h-prop">Onde a campanha investiu em propaganda</h2>
      {!atual ? (
        <p className="muted">As despesas de campanha só existem a partir de 2018, e esta pessoa não disputou eleições desde então.</p>
      ) : (
        <>
          {resumo.length > 1 && (
            <>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {resumo.length} campanhas desde 2018. Clique numa delas para ver em que a propaganda foi gasta.
              </p>
              <BarrasH compacto titulo="Quanto cada campanha contratou em propaganda" linhas={resumo.map((x) => ({
                chave: String(x.id), rotulo: `${x.ano} · ${x.cargo}`, detalhe: x.eleito ? "eleito" : "não eleito",
                valor: x.propagandaCentavos ?? 0, classe: "pp-fis",
                texto: x.propagandaCentavos === null ? "sem dados" : r$(x.propagandaCentavos),
                subtexto: x.parteDoTotal !== null && x.propagandaCentavos ? `${parteTexto(x.parteDoTotal)} das despesas` : undefined,
                href: hrefDe(x.id), atual: x.id === atual.c.id_candidatura,
              }))} />
            </>
          )}
          <Conteudo c={atual.c} p={atual.p} />
        </>
      )}
    </section>
  );
}

function Conteudo({ c, p }: { c: CarreiraItem; p: Propaganda | null }) {
  if (!p) return <p className="muted">Não foi possível carregar as despesas agora.</p>;
  const a = analisar(p, p.categorias);
  const campanha = `Na campanha de ${c.ano} a ${c.cargo.toLowerCase()}`;
  if (a.estado === "sem_dados") {
    return (
      <>
        <p className="manchete pequena">{campanha}, não há despesas registradas na prestação de contas final.</p>
        <p className="aviso-causa">Isso <b>não</b> quer dizer que o gasto foi zero: a prestação pode não ter sido entregue, ter sido
          entregue só como parcial ou ter sido declarada sem movimentação financeira.</p>
      </>
    );
  }
  if (a.estado === "sem_propaganda") {
    return (
      <p className="manchete pequena">
        {campanha}, {a.totalCentavos > 0
          ? <>foram registrados <b>{r$(a.totalCentavos)}</b> em despesas, nenhuma delas de propaganda.</>
          : <>foram registradas {inteiro(a.lancamentos)} {a.lancamentos === 1 ? "despesa" : "despesas"}, sem valor contratado e nenhuma de propaganda.</>}
      </p>
    );
  }
  return <ComPropaganda campanha={campanha} a={a} />;
}

function ComPropaganda({ campanha, a }: { campanha: string; a: Extract<Analise, { estado: "com_propaganda" }> }) {
  const [maior] = a.predominantes;
  return (
    <>
      <p className="resposta-curta longa">{nomearPredominantes(a.predominantes)}.</p>
      <p className="manchete pequena">
        {campanha}, a propaganda somou <b>{r$(a.propagandaCentavos)}</b>, {parteTexto(a.parteDoTotal)} das despesas da campanha ({r$(a.totalCentavos)}).{" "}
        {a.predominantes.length > 1
          ? <>Empate: {a.predominantes.length} categorias receberam <b>{r$(maior.centavos)}</b> cada, o maior valor.</>
          : <>De cada R$ 100 em propaganda, <b>{maior.de100 > 0 ? `R$ ${maior.de100}` : "menos de R$ 1"} foram para {minuscula(maior.rotulo)}</b>.</>}
      </p>
      <p className="escala">O tamanho da barra é o valor contratado em cada categoria; a cor é o tipo de propaganda.</p>
      <BarrasH titulo="Valor contratado em propaganda, por categoria" compacto
        linhas={a.categorias.map((k) => ({
          chave: k.origem, rotulo: k.rotulo, detalhe: grupo(k.grupo).rotulo, valor: k.centavos, classe: grupo(k.grupo).classe,
          texto: r$(k.centavos), subtexto: textoDe100(k.de100, k.centavos),
        }))} />
      <h3>Por tipo de propaganda</h3>
      <Composicao a={a} />
      <details>
        <summary>Ver o detalhamento por categoria, com os valores exatos</summary>
        <div className="tablewrap">
          <table>
            <caption className="sr-only">Despesas de propaganda contratadas por categoria do TSE</caption>
            <thead><tr><th>Categoria</th><th>Classificação original no TSE</th><th>Tipo</th><th className="num">Despesas</th><th className="num">Valor contratado</th><th className="num">% da propaganda</th><th className="num">% das despesas</th></tr></thead>
            <tbody>
              {a.categorias.map((k) => (
                <tr key={k.origem}><td>{k.rotulo}</td><td>{k.origem}</td><td>{grupo(k.grupo).rotulo}</td><td className="num">{inteiro(k.lancamentos)}</td><td className="num">{reaisCentavos(k.centavos)}</td><td className="num">{parteTexto(k.parteDaPropaganda)}</td><td className="num">{parteTexto(k.parteDoTotal)}</td></tr>
              ))}
              <tr><td><b>Propaganda</b></td><td /><td /><td className="num"><b>{inteiro(a.categorias.reduce((s, k) => s + k.lancamentos, 0))}</b></td><td className="num"><b>{reaisCentavos(a.propagandaCentavos)}</b></td><td className="num"><b>100,0%</b></td><td className="num"><b>{parteTexto(a.parteDoTotal)}</b></td></tr>
              <tr><td>Todas as despesas consideradas</td><td /><td /><td className="num">{inteiro(a.lancamentos)}</td><td className="num">{reaisCentavos(a.totalCentavos)}</td><td /><td className="num">100,0%</td></tr>
            </tbody>
          </table>
        </div>
      </details>
      <p className="muted" style={{ fontSize: 15, marginBottom: 0 }}>
        Valor <b>contratado</b> declarado ao TSE (prestação final), não necessariamente pago, sem correção pela inflação e sem as doações
        a outros candidatos. Propaganda física: {GRUPOS.propaganda_fisica.descricao}; audiovisual: {GRUPOS.propaganda_audiovisual.descricao};
        digital: {GRUPOS.propaganda_digital.descricao}. Gastar mais não diz quantas pessoas a propaganda alcançou nem se ajudou a eleger.
      </p>
    </>
  );
}

/** Composição da propaganda pelos três tipos: uma barra empilhada e os valores de cada tipo. */
function Composicao({ a }: { a: Extract<Analise, { estado: "com_propaganda" }> }) {
  const tipos = composicaoPorTipo(a);
  const descricao = tipos.map((t) => `${grupo(t.grupo).rotulo}: ${t.centavos > 0 ? textoDe100(t.de100, t.centavos) : "nada"}`).join("; ");
  return (
    <>
      <div className="stack composicao" role="img" aria-label={`De cada R$ 100 contratados em propaganda. ${descricao}.`}>
        {tipos.filter((t) => t.centavos > 0).map((t) => (
          <div key={t.grupo} className={`seg ${grupo(t.grupo).classe}`} style={{ width: `${t.parte * 100}%` }}
            title={`${grupo(t.grupo).rotulo}: ${r$(t.centavos)} (${parteTexto(t.parte)})`} />
        ))}
      </div>
      <ul className="fontes composicao-tipos">
        {tipos.map((t) => (
          <li key={t.grupo}>
            <i className={grupo(t.grupo).classe} aria-hidden="true" />
            <div>
              <b>{grupo(t.grupo).rotulo}</b>
              <span className="valor">
                {t.centavos > 0
                  ? <>{r$(t.centavos)} · {textoDe100(t.de100, t.centavos)} · {inteiro(t.lancamentos)} {t.lancamentos === 1 ? "despesa" : "despesas"}</>
                  : "Nenhuma despesa deste tipo"}
              </span>
              <small>{grupo(t.grupo).descricao}</small>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
