import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/Cabecalho";
import { CaminhoDados } from "@/components/CaminhoDados";
import { MatrizEscopo } from "@/components/MatrizEscopo";
import { Formula, IdeiaCarreira, IdeiaMapa, IdeiaPropaganda } from "@/components/IlustraMetodo";
import { Icone } from "@/components/Icone";
import { FOTOS } from "@/lib/fotos";
import { CREDITO_FOTOS } from "@/lib/foto-candidato";
import { METODOLOGIA, PERGUNTAS, REGRAS_GERAIS, TAMBEM, linkFonte, type IdMetodologia } from "@/lib/metodologia";

export const metadata: Metadata = {
  title: "Sobre os dados",
  description: "As dez perguntas de pesquisa do projeto e como cada resposta foi calculada: fontes, recortes, fórmulas, testes e limites.",
};

const IDEIA: Partial<Record<IdMetodologia, React.ReactNode>> = { mapa: <IdeiaMapa />, p9: <IdeiaPropaganda />, p10: <IdeiaCarreira /> };

const NAVEGACAO = [
  { href: "#perguntas", rotulo: "As perguntas" },
  { href: "#caminho", rotulo: "Do dado à tela" },
  { href: "#escopo", rotulo: "O que existe em cada ano" },
  { href: "#regras", rotulo: "Regras para tudo" },
  { href: "#qualidade", rotulo: "Qualidade dos dados" },
  { href: "#privacidade", rotulo: "Privacidade e fotos" },
];

const respondidas = PERGUNTAS.filter((p) => p.id).length;

export default function Sobre() {
  return (
    <>
      <Cabecalho titulo="Sobre os dados" foto={FOTOS.interior}>
        <p className="lead">As perguntas do projeto e como chegamos a cada resposta. Dados abertos do Tribunal Superior Eleitoral, de 1998 a 2024, em seis estados. Projeto acadêmico da disciplina de Banco de Dados da UFPI; não é uma fonte oficial.</p>
      </Cabecalho>

      <section className="quadro" aria-labelledby="h-fonte">
        <div className="bloco tinta s12 sobre-numeros">
          <h2 id="h-fonte" className="sr-only">Fonte e escopo</h2>
          <p><b>6</b><span>estados: AP, ES, MG, PE, RJ e RR</span></p>
          <p><b>14</b><span>eleições ordinárias, de 1998 a 2024</span></p>
          <p><b>7</b><span>cargos, com vices e suplentes</span></p>
        </div>
        <div className="bloco s12 sobre-escopo-texto">
          <p>Candidaturas, votação, prestação de contas e eleitorado, de 1998 a 2024, para AP, ES, MG, PE, RJ e RR.</p>
          <p className="muted">Cargos: presidente, governador, senador, deputados federal e estadual, prefeito e vereador (e seus vices e suplentes). O Conselheiro Distrital de Fernando de Noronha ficou fora do escopo.</p>
        </div>
      </section>

      <nav className="sobre-nav" aria-label="Nesta página">
        <ul>{NAVEGACAO.map((i) => <li key={i.href}><a href={i.href}>{i.rotulo}</a></li>)}</ul>
      </nav>

      <section className="sobre-secao" id="perguntas" aria-labelledby="h-perguntas">
        <h2 id="h-perguntas" className="sobre-titulo">As dez perguntas</h2>
        <p className="sobre-intro">O projeto parte de dez perguntas de pesquisa. {respondidas} já têm resposta aqui: abra uma para ver o que ela mostra, como foi calculada e o que não dá para afirmar.</p>
        <ol className="perguntas">
          {PERGUNTAS.map((p) => (
            <li key={p.n}>
              {p.id
                ? <Pergunta ancora={`p${p.n}`} marca={<span className="q-n">{p.n}</span>} rotuloSr={`Pergunta ${p.n}: `} texto={p.texto} id={p.id} />
                : (
                  <div className="q breve" id={`p${p.n}`}>
                    <span className="q-n" aria-hidden="true">{p.n}</span>
                    <h3 className="q-texto"><span className="sr-only">Pergunta {p.n}: </span>{p.texto}</h3>
                    <span className="q-selo">Em breve</span>
                  </div>
                )}
            </li>
          ))}
        </ol>
        <h3 className="perguntas-tambem">Também na plataforma</h3>
        <ul className="perguntas">
          {TAMBEM.map((t) => (
            <li key={t.id}>
              <Pergunta ancora={t.id} marca={<Icone nome="mapa" className="q-n" />} rotuloSr="" texto={t.texto} id={t.id} />
            </li>
          ))}
        </ul>
      </section>

      <section className="sobre-secao" id="caminho" aria-labelledby="h-caminho">
        <div className="bloco">
          <h2 id="h-caminho">Do dado à tela</h2>
          <p className="sobre-intro">Os dados abertos do TSE são carregados e validados num repositório à parte e guardados num banco só de leitura. A plataforma consulta esse banco por uma API e monta as páginas no servidor.</p>
          <CaminhoDados />
          <details className="sobre-tecnico">
            <summary>Modelo simplificado e regras de integração</summary>
            <div className="sobre-tecnico-corpo">
              <div>
                <h3>Entidades principais</h3>
                <dl className="sobre-def">
                  <dt>municipio</dt><dd>Código do TSE e código do IBGE, que liga o município ao Censo e à malha do mapa.</dd>
                  <dt>candidato</dt><dd>A pessoa ao longo das eleições, com um identificador interno (<code>id_candidato</code>).</dd>
                  <dt>eleicao · cargo</dt><dd>Uma eleição por código do TSE, cargo e turno; o tipo (ordinária, suplementar) vem normalizado da carga.</dd>
                  <dt>partido</dt><dd>Sigla e número; nas análises, o número dentro do ano identifica o partido.</dd>
                  <dt>candidatura</dt><dd>Pessoa × eleição × cargo, com partido, UF ou município e o resultado (<code>rotulo_resultado</code>).</dd>
                  <dt>votos</dt><dd><code>resultado_candidatura</code> (por turno), <code>votos_candidatura_municipio</code>, <code>votos_partido_municipio</code> (nominais e de legenda) e <code>participacao_eleitoral</code>.</dd>
                  <dt>receitas · despesas</dt><dd><code>receita_campanha</code> com <code>fonte_recurso</code>; <code>despesa_campanha</code> com <code>categoria_despesa</code>; <code>vagas</code> por cargo e unidade.</dd>
                </dl>
              </div>
              <div>
                <h3>Regras de integração</h3>
                <ul className="lista">
                  <li>O mesmo político é seguido de 1998 a 2024 pelo identificador interno; o documento que o identifica na carga nunca sai da API.</li>
                  <li>Cada candidatura tem a chave natural do TSE (ano, unidade eleitoral e sequencial), que não muda quando a carga é refeita; é ela que liga a candidatura à foto, num banco à parte (<code>bdr_fotos</code>).</li>
                  <li>“Eleito” e “disputou” vêm do rótulo de resultado do TSE (<code>rotulo_resultado</code>), não da situação do registro.</li>
                  <li>Cada análise é um arquivo <code>.sql</code> em <code>api/app/analises/</code> que vira uma rota da API sozinho; a API só devolve os campos públicos listados nos modelos dela.</li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </section>

      <section className="sobre-secao" id="escopo" aria-labelledby="h-escopo">
        <div className="bloco cinza">
          <h2 id="h-escopo">O que existe em cada ano</h2>
          <p className="sobre-intro">Nem todo dado cobre os 26 anos. Dinheiro de campanha, voto de legenda e fotos só existem de 2018 em diante; cada Censo só é comparado com a eleição do ano dele e as municipais em volta.</p>
          <MatrizEscopo />
        </div>
      </section>

      <section className="sobre-secao" id="regras" aria-labelledby="h-regras">
        <div className="bloco tinta">
          <h2 id="h-regras">Regras que valem para tudo</h2>
          <ul className="sobre-regras">{REGRAS_GERAIS.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      </section>

      <section className="sobre-secao" id="qualidade" aria-labelledby="h-qualidade">
        <div className="bloco">
          <h2 id="h-qualidade">Qualidade dos dados</h2>
          <ul className="lista sobre-qualidade">
            <li>O banco é carregado e validado no repositório de carga (<code>load_BDR</code>); esta plataforma só lê o resultado e não altera nenhum dado.</li>
            <li>Todo número novo é conferido contra o projeto de carga antes de entrar numa página.</li>
            <li>As consultas ficam em arquivos <code>.sql</code> versionados e testados contra um banco de teste com o mesmo esquema; os cálculos das páginas têm testes próprios.</li>
            <li>Há um teste de privacidade: a API não pode devolver campo fora da lista de campos públicos.</li>
          </ul>
          {/* TODO(equipe): descrever as verificações da carga (ex.: votos nominais por partido × soma dos votos por candidato,
              por ano × UF × cargo, e o que significa cada faixa da razão). Não estão documentadas neste repositório. */}
        </div>
      </section>

      <div className="quadro sobre-secao" id="privacidade">
        <section className="bloco tinta s4" aria-labelledby="h-priv">
          <h2 id="h-priv">Privacidade</h2>
          <p>Os dados são públicos, mas não exibimos título eleitoral, CPF, data de nascimento nem documentos de doadores.</p>
          <p>Para pedir uma correção, entre em contato com a equipe (TODO: e-mail do grupo).</p>
        </section>
        <section className="bloco s8" aria-labelledby="h-fotos" id="fotos">
          <h2 id="h-fotos">Fotos dos candidatos</h2>
          <p>As fotos são as que os próprios candidatos entregaram à Justiça Eleitoral no registro da candidatura, publicadas pelo TSE de 2018 em diante. Cada foto é da eleição indicada ao lado dela; candidaturas sem foto mostram as iniciais.</p>
          <p>{CREDITO_FOTOS} Usamos as fotos só para identificar a candidatura: não fazemos reconhecimento facial nem qualquer outro tratamento das imagens.</p>
          <p>Para pedir a remoção de uma foto, entre em contato com a equipe (TODO: e-mail do grupo) informando o nome e o ano da candidatura.</p>
        </section>
      </div>
    </>
  );
}

/** Uma pergunta respondida: o cartão abre (details nativo, sem JavaScript) e mostra a metodologia e o caminho da resposta. */
function Pergunta({ ancora, marca, rotuloSr, texto, id }: { ancora: string; marca: React.ReactNode; rotuloSr: string; texto: string; id: IdMetodologia }) {
  const m = METODOLOGIA[id];
  const [principal, ...outros] = m.ondeVer;
  const ideia = IDEIA[id];
  const recorte = [m.anos, m.cargos, ...(m.turno ? [m.turno] : [])];
  return (
    <details className="q" id={ancora}>
      <summary>
        <span aria-hidden="true" className="q-marca">{marca}</span>
        <h3 className="q-texto">{rotuloSr && <span className="sr-only">{rotuloSr}</span>}{texto}</h3>
        <Icone nome="seta" className="q-abre" />
      </summary>
      <div className="q-corpo">
        <p className="q-resposta">{m.resposta}</p>
        <ul className="chips q-recorte" aria-label="Recorte">{recorte.map((r) => <li key={r} className="chip">{r}</li>)}</ul>
        <div className="q-colunas">
          <div>
            <h4>Como calculamos</h4>
            <ul className="lista">{m.calculo.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div className="q-lado">
            {(m.formula || ideia) && (
              <div>
                <h4>A medida</h4>
                {m.formula && <Formula f={m.formula} />}
                {ideia}
              </div>
            )}
            <div>
              <h4>O que isso não mostra</h4>
              <ul className="lista">{m.limites.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
          </div>
        </div>
        <p className="q-acoes">
          <Link className="q-ver" href={principal.href}>{principal.rotulo}<Icone nome="seta" /></Link>
          {outros.map((o) => <Link key={o.href} href={o.href}>{o.rotulo}</Link>)}
        </p>
        <details className="q-tecnico">
          <summary>Detalhe técnico: tabelas, recorte e SQL</summary>
          <div className="sobre-tecnico-corpo">
            <div>
              <h5>Dados</h5>
              <ul className="lista">{m.dados.map((t) => <li key={t}>{t}</li>)}</ul>
              <h5>Recorte</h5>
              <ul className="lista">{m.recorte.map((t) => <li key={t}>{t}</li>)}</ul>
            </div>
            <div>
              <h5>Consultas de origem</h5>
              <ul className="lista q-sql">
                {m.sql.map((s) => <li key={s}><a href={linkFonte(s)} rel="noopener"><code translate="no">{s}</code></a></li>)}
              </ul>
            </div>
          </div>
        </details>
      </div>
    </details>
  );
}
