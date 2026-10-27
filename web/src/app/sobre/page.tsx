import type { Metadata } from "next";
import Link from "next/link";
import { Cabecalho } from "@/components/Cabecalho";
import { CaminhoDados } from "@/components/CaminhoDados";
import { MatrizEscopo } from "@/components/MatrizEscopo";
import { Formula, IdeiaCarreira, IdeiaMapa, IdeiaPropaganda } from "@/components/IlustraMetodo";
import { Icone } from "@/components/Icone";
import { FOTOS } from "@/lib/fotos";
import { CREDITO_FOTOS } from "@/lib/foto-candidato";
import {
  METODOLOGIA, ORDEM_SOBRE, REGRAS_GERAIS, formulasDa, linkFonte, marca, type IdMetodologia, type Metodologia,
} from "@/lib/metodologia";

export const metadata: Metadata = {
  title: "Sobre os dados",
  description: "As perguntas que a plataforma responde e como cada uma foi calculada: fontes, recortes, fórmulas, testes e limites.",
};

const IDEIA: Partial<Record<IdMetodologia, React.ReactNode>> = { mapa: <IdeiaMapa />, p9: <IdeiaPropaganda />, p10: <IdeiaCarreira /> };

const INDICE: { href: string; rotulo: string }[] = [
  { href: "#caminho", rotulo: "Do dado à tela" },
  { href: "#escopo", rotulo: "O que existe em cada ano" },
  ...ORDEM_SOBRE.map((id) => ({ href: `#${id}`, rotulo: METODOLOGIA[id].titulo })),
  { href: "#regras", rotulo: "Regras para tudo" },
  { href: "#fora", rotulo: "O que ficou fora" },
  { href: "#qualidade", rotulo: "Qualidade dos dados" },
  { href: "#privacidade", rotulo: "Privacidade e fotos" },
];

export default function Sobre() {
  return (
    <>
      <Cabecalho titulo="Sobre os dados" foto={FOTOS.interior}>
        <p className="lead">Cada pergunta que a plataforma responde e como chegamos a cada número. Dados abertos do Tribunal Superior Eleitoral, de 1998 a 2024, em seis estados. Projeto acadêmico da disciplina de Banco de Dados da UFPI; não é uma fonte oficial.</p>
      </Cabecalho>

      <div className="sobre">
        <nav className="sobre-indice" aria-label="Nesta página">
          <p className="sobre-indice-titulo" id="h-indice">Nesta página</p>
          <ol aria-labelledby="h-indice">
            {INDICE.map((i) => <li key={i.href}><a href={i.href}>{i.rotulo}</a></li>)}
          </ol>
        </nav>

        <div className="sobre-corpo">
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
              <p className="sobre-intro">Nem todo dado cobre os 26 anos. Dinheiro de campanha, voto de legenda e fotos só existem de 2018 em diante; o Censo de 2010 só é comparado com as eleições municipais em volta dele.</p>
              <MatrizEscopo />
            </div>
          </section>

          {ORDEM_SOBRE.map((id) => <SecaoPergunta key={id} m={METODOLOGIA[id]} />)}

          <section className="sobre-secao" id="regras" aria-labelledby="h-regras">
            <div className="bloco tinta">
              <h2 id="h-regras">Regras que valem para tudo</h2>
              <ul className="sobre-regras">{REGRAS_GERAIS.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          </section>

          <div className="quadro sobre-secao">
            <section className="bloco cinza s5" id="fora" aria-labelledby="h-fora">
              <h2 id="h-fora">O que ficou fora</h2>
              <p>O projeto parte de dez perguntas de pesquisa. Esta plataforma não responde às perguntas 4, 6 e 7, nem à parte da pergunta 3 sobre votação por partido; o mapa trata só da abstenção.</p>
              {/* TODO(equipe): dizer, numa frase, onde essas perguntas foram tratadas (fora da plataforma) ou se ficaram fora do recorte. */}
              <p className="muted">A retenção por turma de estreia e as trocas de partido no conjunto (pergunta 10) já têm consulta, mas ainda não têm página.</p>
            </section>
            <section className="bloco s7" id="qualidade" aria-labelledby="h-qualidade">
              <h2 id="h-qualidade">Qualidade dos dados</h2>
              <ul className="lista">
                <li>O banco é carregado e validado no repositório de carga (<code>load_BDR</code>); esta plataforma só lê o resultado e não altera nenhum dado.</li>
                <li>Todo número novo é conferido contra o projeto de carga antes de entrar numa página.</li>
                <li>As consultas ficam em arquivos <code>.sql</code> versionados e testados contra um banco de teste com o mesmo esquema; os cálculos das páginas têm testes próprios.</li>
                <li>Há um teste de privacidade: a API não pode devolver campo fora da lista de campos públicos.</li>
              </ul>
              {/* TODO(equipe): descrever as verificações da carga (ex.: votos nominais por partido × soma dos votos por candidato,
                  por ano × UF × cargo, e o que significa cada faixa da razão). Não estão documentadas neste repositório. */}
            </section>
          </div>

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
        </div>
      </div>
    </>
  );
}

function SecaoPergunta({ m }: { m: Metodologia }) {
  const mc = marca(m.numero);
  const [principal, ...outros] = m.ondeVer;
  const formulas = formulasDa(m);
  const ideia = IDEIA[m.id];
  const recorte = [m.anos, m.cargos, ...(m.turno ? [m.turno] : [])];
  return (
    <section className="sobre-secao met" id={m.id} aria-labelledby={`h-${m.id}`}>
      <div className="bloco met-cab">
        <p className="met-marca" aria-hidden="true">
          {mc.valor
            ? <><span>{mc.rotulo}</span><b className={mc.valor.length > 3 ? "longo" : undefined}>{mc.valor}</b></>
            : <><Icone nome={m.id === "candidato" ? "candidato" : "mapa"} /><span>{mc.rotulo}</span></>}
          {mc.nota && <small>{mc.nota}</small>}
        </p>
        <div className="met-texto">
          <h2 id={`h-${m.id}`}><span className="sr-only">{m.numero}: </span>{m.titulo}</h2>
          <p className="met-pergunta">{m.pergunta}</p>
          <p className="met-resposta">{m.resposta}</p>
          <ul className="chips met-recorte" aria-label="Recorte">{recorte.map((r) => <li key={r} className="chip">{r}</li>)}</ul>
          <p className="met-links">
            <Link className="met-ver" href={principal.href}>{principal.rotulo}<Icone nome="seta" /></Link>
            {outros.map((o) => <Link key={o.href} href={o.href}>{o.rotulo}</Link>)}
          </p>
        </div>
      </div>

      <div className="met-corpo">
        <div className="bloco met-como">
          <h3>Como calculamos</h3>
          <ul className="lista">{m.calculo.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="met-lado">
          {(formulas.length > 0 || ideia) && (
            <div className={`bloco met-ideia${m.id === "mapa" ? " noite paleta-mapa" : ""}`}>
              <h3>A medida</h3>
              {formulas.map((f) => <Formula key={f.resultado} f={f} />)}
              {ideia}
            </div>
          )}
          <div className="bloco cinza met-limites">
            <h3>O que isso não mostra</h3>
            <ul className="lista">{m.limites.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        </div>
      </div>

      <details className="bloco met-tecnico">
        <summary>Detalhe técnico: tabelas, recorte e SQL</summary>
        <div className="sobre-tecnico-corpo">
          <div>
            <h3>Dados</h3>
            <ul className="lista">{m.dados.map((t) => <li key={t}>{t}</li>)}</ul>
            <h3>Recorte</h3>
            <ul className="lista">{m.recorte.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
          <div>
            <h3>Consultas de origem</h3>
            <ul className="lista met-sql">
              {m.sql.map((s) => <li key={s}><a href={linkFonte(s)} rel="noopener"><code translate="no">{s}</code></a></li>)}
            </ul>
            {m.partes?.map((p) => {
              const parte = METODOLOGIA[p];
              return (
                <details key={p} className="met-parte">
                  <summary>{parte.numero}: {parte.titulo}</summary>
                  <p className="muted">{parte.pergunta}</p>
                  <ul className="lista">{parte.calculo.map((t) => <li key={t}>{t}</li>)}</ul>
                  <p><Link href={parte.ondeVer[0].href}>Ver a análise completa</Link> · <a href={linkFonte(parte.sql[0])} rel="noopener"><code translate="no">{parte.sql[0]}</code></a></p>
                </details>
              );
            })}
          </div>
        </div>
      </details>
    </section>
  );
}
