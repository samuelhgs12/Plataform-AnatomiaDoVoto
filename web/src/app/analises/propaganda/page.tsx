import type { Metadata } from "next";
import Link from "next/link";
import { lerEstatico } from "@/lib/data";
import { carregarRecorte } from "@/lib/propaganda-dados";
import { NOME_UF, TIPO_ELEICAO, textoDe100 } from "@/lib/financiamento";
import {
  analisar, anosDoIndice, candidaturasDe, cargosDoRecorte, composicaoPorTipo, grupo, lerIndice, MINIMO_BUSCA, municipiosDoCargo,
  nomearPredominantes, parteTexto, reaisCentavos, recortesDoAno, rotuloCandidatura, GRUPOS,
  type Analise, type Candidatura,
} from "@/lib/propaganda";
import { inteiro, reais } from "@/lib/format";
import { BarrasH } from "@/components/BarrasH";
import { BuscaCandidatura } from "@/components/BuscaCandidatura";
import { Cabecalho } from "@/components/Cabecalho";
import { EscolhaNaUrl } from "@/components/EscolhaNaUrl";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Gastos com propaganda" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const CAMINHO = "/analises/propaganda";
const TITULO = "Gastos com propaganda";
const PERGUNTA = "Onde o candidato investe em propaganda?";
const r$ = (centavos: number) => reais(centavos / 100);
const nomeRecorte = (uf: string) => (uf === "BR" ? "Brasil" : NOME_UF[uf] ?? uf);
/** Só a primeira letra: "Programas de rádio, TV ou vídeo" → "programas de rádio, TV ou vídeo". */
const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default async function Propaganda({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const indice = lerIndice(await lerEstatico("q9/indice"));
  if (!indice) {
    return (
      <>
        <Cabecalho titulo={TITULO} pergunta={PERGUNTA} foto={FOTOS.confirma} />
        <div className="card aviso">
          <h2>Dados ainda não gerados</h2>
          <p>Na pasta <code>pipeline/</code>, rode <code>python export_static.py q9</code>.</p>
        </div>
      </>
    );
  }

  // seleção: eleição → estado (ou presidente) → cargo → município (eleição municipal) → candidatura; tudo validado contra os dados
  const anos = anosDoIndice(indice);
  const anoPedido = Number(um(sp.ano));
  const ano = anos.includes(anoPedido) ? anoPedido : anos[anos.length - 1];
  const recortes = recortesDoAno(indice, ano);
  const recorteIdx = recortes.find((r) => r.uf === um(sp.uf));
  const uf = recorteIdx?.uf;
  // lido e conferido uma vez por arquivo (cache no servidor, lib/propaganda-dados.ts)
  const { recorte, problemas } = recorteIdx ? await carregarRecorte(recorteIdx.arquivo) : { recorte: null, problemas: [] };
  const valido = recorte && problemas.length === 0 ? recorte : null;

  const pedida = um(sp.c);
  const escolhida = valido && pedida ? valido.candidaturas.find((c) => c.sequencial === pedida) : undefined;
  const cargos = valido ? cargosDoRecorte(valido) : [];
  // a candidatura escolhida define cargo e município (um link só com ano, UF e candidatura funciona)
  const cargo = escolhida?.cargo ?? (cargos.includes(um(sp.cargo) ?? "") ? um(sp.cargo) : cargos.length === 1 ? cargos[0] : undefined);
  const municipios = valido && cargo ? municipiosDoCargo(valido, cargo) : [];
  const mun = escolhida?.cod_municipio ?? (municipios.some(([m]) => m === um(sp.mun)) ? um(sp.mun) : undefined);
  const lista = valido && cargo && (municipios.length === 0 || mun) ? candidaturasDe(valido, cargo, mun) : [];

  const atual = { ano: String(ano), uf, cargo, mun, c: escolhida?.sequencial };
  const href = (novo: Partial<typeof atual>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v) p.set(k, v);
    return `${CAMINHO}?${p.toString()}`;
  };
  const params = Object.fromEntries(Object.entries(atual).filter(([, v]) => v)) as Record<string, string>;
  const analise = escolhida && valido ? analisar(escolhida, valido.categorias.get(escolhida.sequencial) ?? []) : null;

  return (
    <>
      <Cabecalho titulo={TITULO} pergunta={PERGUNTA} foto={FOTOS.confirma}>
        <p className="lead">
          Escolha uma candidatura e veja quanto ela contratou de propaganda eleitoral e em quê: material impresso, adesivos,
          carros de som, rádio e TV, internet. Dados da prestação de contas entregue ao TSE, de 2018 a 2024.
        </p>
      </Cabecalho>

      {indice.origem === "sintetico" && (
        <div className="card aviso" role="note">
          <h2>Dados de exemplo</h2>
          <p>Esta página está usando <b>dados fictícios</b>, gerados só para desenvolver a tela: nomes, municípios e valores não
            são resultados oficiais. Para os dados reais, rode <code>python export_static.py q9</code> com o banco do projeto.</p>
        </div>
      )}

      <nav className="bloco filtros-fin" aria-label="Escolha a candidatura">
        <span className="rotulo">Eleição</span>
        <div className="chips">
          {anos.map((a) => (
            <Link key={a} className={`chip${a === ano ? " on" : ""}`} href={href({ ano: String(a), cargo: undefined, mun: undefined, c: undefined })} scroll={false} aria-current={a === ano ? "true" : undefined}>
              {a} <small>· {TIPO_ELEICAO(a).replace("eleição ", "")}</small>
            </Link>
          ))}
        </div>
        <span className="rotulo">Estado</span>
        <div className="chips">
          {recortes.map((r) => (
            <Link key={r.uf} className={`chip${r.uf === uf ? " on" : ""}`} href={href({ uf: r.uf, cargo: undefined, mun: undefined, c: undefined })} scroll={false} aria-current={r.uf === uf ? "true" : undefined}>
              {r.uf === "BR" ? "Presidente" : r.uf}
            </Link>
          ))}
        </div>
        {valido && uf && (
          <>
            <span className="rotulo">Buscar</span>
            <BuscaCandidatura caminho={CAMINHO} ano={ano} uf={uf} cargo={cargos.length > 1 ? cargo : undefined} minimo={MINIMO_BUSCA}
              escopo={[uf === "BR" ? "todas as candidaturas a presidente" : nomeRecorte(uf), cargos.length > 1 && cargo ? cargo.toLowerCase() : null, String(ano)].filter(Boolean).join(", ")} />
          </>
        )}
        {valido && cargos.length > 1 && (
          <>
            <span className="rotulo">Cargo</span>
            <div className="chips">
              {cargos.map((c) => (
                <Link key={c} className={`chip${c === cargo ? " on" : ""}`} href={href({ cargo: c, c: undefined })} scroll={false} aria-current={c === cargo ? "true" : undefined}>{c}</Link>
              ))}
            </div>
          </>
        )}
        {municipios.length > 0 && (
          <>
            <span className="rotulo">Município</span>
            <EscolhaNaUrl caminho={CAMINHO} nome="mun" rotulo="Município" vazio="Escolha o município…" opcoes={municipios} atual={mun} params={params} limpar={["c"]} />
          </>
        )}
        {lista.length > 0 && (
          <>
            <span className="rotulo">Candidatura</span>
            <EscolhaNaUrl caminho={CAMINHO} nome="c" rotulo="Candidatura" vazio={`Escolha entre ${inteiro(lista.length)} candidaturas…`}
              opcoes={lista.map((c) => [c.sequencial, rotuloCandidatura(c)])} atual={escolhida?.sequencial} params={params} ancora="resposta" />
          </>
        )}
      </nav>

      {recorteIdx && !recorte ? (
        <div className="card aviso">
          <h2>Dados desta eleição indisponíveis</h2>
          <p>O arquivo <code>q9/{recorteIdx.arquivo}.json</code> não foi encontrado. Na pasta <code>pipeline/</code>, rode <code>python export_static.py q9</code>.</p>
        </div>
      ) : problemas.length > 0 ? (
        <div className="card aviso">
          <h2>Dados desta eleição inconsistentes</h2>
          <p>Os valores de {nomeRecorte(uf ?? "")} em {ano} não fecham ({problemas.length} problema{problemas.length > 1 ? "s" : ""}); por isso não são mostrados. Gere os dados de novo com <code>python export_static.py q9</code>.</p>
        </div>
      ) : pedida && !escolhida && valido ? (
        <div className="card aviso">
          <h2>Candidatura não encontrada</h2>
          <p>Não há candidatura com esse código em {nomeRecorte(uf ?? "")} em {ano}. Escolha outra na lista acima.</p>
        </div>
      ) : escolhida && analise ? (
        <Resposta c={escolhida} a={analise} ano={ano} uf={uf ?? ""} />
      ) : (
        <Instrucao ano={ano} uf={uf} recorte={recorteIdx} faltaCargo={!!valido && !cargo} faltaMun={municipios.length > 0 && !mun} />
      )}

      <section className="card" aria-labelledby="h-met">
        <h2 id="h-met">Como calculamos</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Fonte: despesas contratadas declaradas na prestação de contas ao TSE (versão final ou regularização de omissão). Prestações parciais não entram: somá-las contaria o mesmo gasto mais de uma vez.</li>
          <li>Valor <b>contratado</b>, não necessariamente pago. Os valores são os declarados pela campanha, em reais da época, sem correção pela inflação.</li>
          <li>Propaganda: as categorias do TSE classificadas pelo projeto como propaganda física ({GRUPOS.propaganda_fisica.descricao}), audiovisual ({GRUPOS.propaganda_audiovisual.descricao}) e digital ({GRUPOS.propaganda_digital.descricao}). Comícios e mobilização de rua não entram.</li>
          <li>Despesas consideradas da campanha: todas as categorias, menos as doações a outros candidatos e partidos (repassar dinheiro não é gasto da campanha). É o denominador da “parte das despesas”.</li>
          <li>Só candidaturas titulares de eleições ordinárias, de 2018 a 2024. As campanhas a presidente são nacionais e aparecem separadas dos estados.</li>
          <li>Os números dizem onde a campanha contratou propaganda, não quantas pessoas ela alcançou nem se ajudou a eleger alguém.</li>
          <li>Os valores vêm da versão atual da base do projeto e ainda não incorporam uma revisão de integridade das despesas em andamento: podem mudar quando ela for adotada.</li>
        </ul>
      </section>
    </>
  );
}

/** Antes de escolher a candidatura: o que falta escolher e um número do recorte. */
function Instrucao({ ano, uf, recorte, faltaCargo, faltaMun }: {
  ano: number; uf?: string; recorte?: { candidaturas: number; com_propaganda: number }; faltaCargo: boolean; faltaMun: boolean;
}) {
  const falta = !uf ? "o estado (ou as campanhas a presidente)" : faltaCargo ? "o cargo" : faltaMun ? "o município" : "a candidatura";
  return (
    <section id="resposta" className="bloco" aria-labelledby="h-esc" style={{ marginBottom: "var(--gap)" }}>
      <h2 id="h-esc">Escolha uma candidatura</h2>
      <p className="manchete pequena">Escolha {falta} nos filtros acima para ver onde a campanha investiu em propaganda.</p>
      {uf && recorte && (
        <p className="escala">
          {uf === "BR" ? "Campanhas a presidente" : `Em ${nomeRecorte(uf)}`} em {ano}: {inteiro(recorte.candidaturas)} candidaturas,{" "}
          {inteiro(recorte.com_propaganda)} com despesas de propaganda.
        </p>
      )}
    </section>
  );
}

function Resposta({ c, a, ano, uf }: { c: Candidatura; a: Analise; ano: number; uf: string }) {
  const onde = c.municipio ? `${c.municipio} (${uf})` : nomeRecorte(uf);
  const quem = (
    <p className="muted" style={{ marginBottom: 4 }}>
      <b style={{ color: "var(--fg)" }}>{c.nome_urna ?? "Nome não informado"}</b>
      {(c.partido || c.numero_urna) && ` · ${[c.partido, c.numero_urna].filter(Boolean).join(" ")}`} · {c.cargo} {c.cargo === "Presidente" ? "" : `em ${onde} `}· {ano}
    </p>
  );

  if (a.estado === "sem_dados") {
    return (
      <section id="resposta" className="bloco" aria-labelledby="h-resp" style={{ marginBottom: "var(--gap)" }}>
        <h2 id="h-resp">A resposta</h2>
        {quem}
        <p className="manchete">Não há despesas registradas na prestação de contas final desta candidatura.</p>
        <p className="aviso-causa">Isso <b>não</b> quer dizer que o gasto foi zero: a prestação pode não ter sido entregue, ter sido
          entregue só como parcial ou ter sido declarada sem movimentação financeira.</p>
      </section>
    );
  }

  const propaganda = a.estado === "com_propaganda" ? a.propagandaCentavos : 0;
  const parte = a.estado === "com_propaganda" ? a.parteDoTotal : 0;
  return (
    <>
      <div className="quadro">
        <section id="resposta" className="bloco s8" aria-labelledby="h-resp">
          <h2 id="h-resp">A resposta</h2>
          {quem}
          {a.estado === "sem_propaganda" ? (
            <>
              <p className="resposta-curta">Nenhuma.</p>
              <p className="manchete pequena">
                {a.totalCentavos > 0
                  ? <>A campanha registrou <b>{r$(a.totalCentavos)}</b> em despesas, nenhuma delas de propaganda.</>
                  : <>A campanha registrou {inteiro(a.lancamentos)} {a.lancamentos === 1 ? "despesa" : "despesas"}, sem valor contratado e nenhuma de propaganda.</>}
              </p>
            </>
          ) : (
            <>
              <p className="resposta-curta longa">{nomearPredominantes(a.predominantes)}.</p>
              <p className="manchete pequena">
                {a.predominantes.length > 1 ? (
                  <>Empate: as {a.predominantes.length} categorias receberam <b>{r$(a.predominantes[0].centavos)}</b> cada, o maior valor contratado em propaganda.</>
                ) : (
                  <>De cada R$ 100 contratados em propaganda, <b>{a.predominantes[0].de100 > 0 ? `R$ ${a.predominantes[0].de100}` : "menos de R$ 1"} foram para {minuscula(a.predominantes[0].rotulo)}</b>.</>
                )}
                {" "}No total, <b>{r$(a.propagandaCentavos)}</b> em {a.categorias.length === 1 ? "uma categoria" : `${a.categorias.length} categorias`} de propaganda.
              </p>
              <p className="escala">O tamanho da barra é o valor contratado em cada categoria; a cor é o tipo de propaganda.</p>
              <BarrasH titulo="Valor contratado em propaganda, por categoria" compacto
                linhas={a.categorias.map((k) => ({
                  chave: k.origem, rotulo: k.rotulo, detalhe: grupo(k.grupo).rotulo, valor: k.centavos, classe: grupo(k.grupo).classe,
                  texto: r$(k.centavos), subtexto: textoDe100(k.de100, k.centavos),
                }))} />
              <div className="legend">
                {a.grupos.map((g) => <span key={g.grupo}><i className={grupo(g.grupo).classe} />{grupo(g.grupo).rotulo}</span>)}
              </div>
            </>
          )}
        </section>
        <aside className="s4 numeros-lado" aria-label="Os números da candidatura">
          <div className="bloco tinta"><p className="figura"><Rolar valor={r$(propaganda)} /></p><p>contratados em propaganda.</p></div>
          <div className="bloco cinza">
            <p className="figura"><Rolar valor={parteTexto(parte).replace(",0%", "%")} /></p>
            <p>das despesas consideradas da campanha ({r$(a.totalCentavos)}) foram propaganda.</p>
          </div>
          <div className="bloco"><p className="aviso-causa"><b>Atenção:</b> valor contratado não é necessariamente valor pago, e gastar
            mais em uma categoria não diz quantas pessoas a propaganda alcançou nem se ajudou a eleger.</p></div>
        </aside>
      </div>

      {a.estado === "com_propaganda" && (
        <section className="card" aria-labelledby="h-tipos">
          <h2 id="h-tipos">Por tipo de propaganda</h2>
          <p className="muted">As categorias acima, somadas nos três tipos de propaganda da classificação do projeto.</p>
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
        </section>
      )}
    </>
  );
}

/** Composição da propaganda pelos três tipos: uma barra empilhada (como as da P10) e os valores de cada tipo. */
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
