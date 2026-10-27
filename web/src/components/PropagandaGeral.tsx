import { lerAnalise, lerPecas } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { reais, inteiro } from "@/lib/format";
import { montarNuvem, type TermoNuvem } from "@/lib/nuvem";
import { grupo, manchetePecas, mostrarNuvem, parteTabela, reaisCentavos, tabelaPecas, tipoComum, tipoDominante } from "@/lib/propaganda";
import {
  ABA_PROPAGANDA, alcance, anoAnterior, cargosNoEixo, composicao, composicaoPorCargo, descricaoLinhas, fraseMudanca, hrefAba, linhasPorTipo,
  MIN_CAMPANHAS, numerosResposta, setasMudanca, TIPOS, tiposDaManchete, tituloCargos, type LinhaGeral,
} from "@/lib/propaganda-geral";
import { GraficoCargos } from "./GraficoCargos";
import { NuvemPalavras } from "./NuvemPalavras";
import { SetasMudanca } from "./SetasMudanca";

const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * A aba Propaganda da área "Dinheiro nas eleições" (pergunta 9: onde os candidatos investem em propaganda), no recorte
 * eleição + cargo + estado (ou todos os estados; presidente sempre nacional). Componente de servidor: lê a tabela "geral"
 * da q9 e as peças do recorte; a lógica fica em src/lib/propaganda-geral.ts.
 *
 * Seções: a resposta para o cargo (manchete pelas peças, dois números, nuvem e uma linha por tipo com a campanha média);
 * como cada cargo dividiu a propaganda (linhas pelos cargos); como mudou desde a eleição anterior do mesmo tipo (setas);
 * três detalhes recolhidos.
 */
export async function PropagandaGeral({ ano, cargo, uf, nomeUf, ufNaUrl = uf }: {
  ano: number; cargo: string; uf: string | null; nomeUf: string | null;
  /** A UF escolhida na URL: com presidente ela não entra na conta, mas os links para os outros cargos a mantêm. */ ufNaUrl?: string | null;
}) {
  const [q9, recebidas] = await Promise.all([lerAnalise("q9", ["geral"]), lerPecas(ano, cargo, uf)]);
  if (!q9?.geral) {
    return <div className="p9g"><section className="card aviso"><p style={{ margin: 0 }}>Não foi possível carregar os dados de propaganda agora. Recarregue a página para tentar de novo.</p></section></div>;
  }
  const linhas = comoObjetos<LinhaGeral>(q9.geral);
  const c = composicao(linhas, ano, cargo, uf);
  const filtros = { ano, cargo, uf: ufNaUrl };
  const cargos = composicaoPorCargo(linhas, ano, uf);
  const anterior = anoAnterior(linhas, ano);
  const antes = anterior === null ? null : composicao(linhas, anterior, cargo, uf);
  const onde = alcance(cargo, nomeUf);
  const lugar = cargo === "Presidente" ? "campanha nacional" : nomeUf ?? "seis estados";

  if (!c || c.campanhas < MIN_CAMPANHAS) {
    return (
      <div className="p9g">
        <section className="card area-comparacao" aria-labelledby="h-p9g">
          <h2 id="h-p9g">Onde as campanhas investiram em propaganda</h2>
          <p className="comparacao-sub">{cargo} · {ano} · {lugar}</p>
          <p className="muted">Há menos de {MIN_CAMPANHAS} campanhas com propaganda declarada neste recorte: escolha outro estado ou cargo.</p>
        </section>
      </div>
    );
  }

  const pecas = Array.isArray(recebidas) ? montarNuvem(recebidas as Partial<TermoNuvem>[]) : null;
  const tipos = tiposDaManchete(c);
  const dominante = tipoDominante(tipos);
  const manchete = (pecas && manchetePecas(pecas.todos, tipos, c.somaCentavos)) ?? (dominante ? `${maiuscula(tipoComum(dominante).frase)}.` : null);
  const comNuvem = !!pecas && mostrarNuvem(pecas.todos);
  const porTipo = linhasPorTipo(c);
  const tabela = pecas ? tabelaPecas(tipos, pecas.todos, c.somaCentavos) : [];
  const numeros = numerosResposta(c);
  const eixo = cargosNoEixo(linhas, ano, uf);
  const mudanca = antes && antes.campanhas >= MIN_CAMPANHAS ? fraseMudanca(antes, c) : null;

  return (
    // um elemento próprio em volta dos cartões: sem ele, ao trocar de aba o React reaproveita os <section class="card"> da
    // aba padrão, que o Movimento (revelação ao entrar na tela) não vê como novos, e eles ficam invisíveis
    <div className="p9g">
      {/* 1. A resposta para o cargo escolhido */}
      <section className="card area-comparacao" aria-labelledby="h-p9g">
        <h2 id="h-p9g">Onde as campanhas investiram em propaganda</h2>
        <p className="comparacao-sub">{cargo} · {ano} · {lugar}</p>
        <div className={`pp-resposta${comNuvem ? " com-nuvem" : ""}`}>
          <div>
            {manchete && <p className="resposta-curta longa">{manchete}</p>}
            <div className={`pp-numeros ${numeros.grupo ? grupo(numeros.grupo).classe : ""}`}>
              <p><b>{numeros.total}</b><span>{numeros.rotuloTotal}</span></p>
              {numeros.parte && <p><b>{numeros.parte}</b><span>de tudo que essas campanhas gastaram</span></p>}
            </div>
            {recebidas === "preparando" && <p className="pp-linha">As peças deste recorte ainda estão sendo calculadas. Recarregue a página em um ou dois minutos.</p>}
            {recebidas === null && <p className="pp-linha">Não foi possível carregar as peças agora.</p>}
          </div>
          {comNuvem && pecas && (
            <div className="pp-nuvem">
              <NuvemPalavras nuvem={pecas} />
              <p className="escala">O tamanho da palavra é o valor contratado.</p>
            </div>
          )}
        </div>
        <hr className="pp-separador" />
        <figure className="barra-pp">
          <div role="img" aria-label={descricaoLinhas(c, nomeUf)}>
            {porTipo.map((l) => (
              <div key={l.grupo} className="pp-tipo" aria-hidden="true">
                <p className="pp-tipo-nome"><i className={grupo(l.grupo).classe} />{l.rotulo}</p>
                <div className="pp-tipo-barra">
                  <div className="pp-trilha">
                    <div className="pp-faixa pp-barra" style={{ gridTemplateColumns: l.media < 1 ? `minmax(0, ${l.media}fr) minmax(0, ${1 - l.media}fr)` : "1fr" }}>
                      <div className={`pp-seg ${grupo(l.grupo).classe}`} />
                      {l.media < 1 && <div className="pp-resto" />}
                    </div>
                  </div>
                </div>
                <p className={`pp-tipo-num ${grupo(l.grupo).classe}`}><b>{l.pct}</b><span>{l.usaram} usaram</span></p>
              </div>
            ))}
          </div>
        </figure>
        <p className="escala">Campanha média: cada campanha conta igual. Usaram: parte das campanhas que gastou algo no tipo.</p>
      </section>

      {/* 2. Comparação entre os cargos da mesma eleição: uma linha por tipo, pelos cargos em ordem de alcance */}
      {eixo.length > 1 && (
        <section className="card area-comparacao p9g-lado" aria-labelledby="h-p9g-cargos">
          <div>
            <h2 id="h-p9g-cargos">{tituloCargos(eixo)}</h2>
            <p className="comparacao-sub">{ano} · {nomeUf ?? "seis estados"}{uf && eixo.some((k) => k.cargo === "Presidente") ? " (presidente: campanha nacional)" : ""} · campanha média. Clique num cargo para vê-lo em destaque.</p>
          </div>
          <GraficoCargos cargos={eixo} cargoAtual={cargo} ano={ano} onde={nomeUf ? ` em ${nomeUf}` : " nos seis estados"}
            hrefDe={(k) => hrefAba({ ...filtros, cargo: k }, ABA_PROPAGANDA, "h-p9g")} />
        </section>
      )}

      {/* 3. Como mudou desde a eleição anterior do mesmo tipo */}
      {antes && antes.campanhas >= MIN_CAMPANHAS && (
        <section className="card area-comparacao" aria-labelledby="h-p9g-mudou">
          <h2 id="h-p9g-mudou">{mudanca ?? "Como mudou"}</h2>
          <p className="comparacao-sub">{cargo} · de {antes.ano} para {ano} · {lugar}</p>
          <SetasMudanca setas={setasMudanca(antes, c)} anoAntes={antes.ano} ano={ano} />
          <p className="escala">○ {antes.ano} → ▸ {ano}. Valores sem correção pela inflação; as partes não dependem dela.</p>
        </section>
      )}

      {/* 4. Recolhidos */}
      <details className="card">
        <summary>Ver o valor de cada peça</summary>
        {!pecas ? <p className="muted">{recebidas === "preparando" ? "As peças ainda estão sendo calculadas." : "As peças não puderam ser carregadas agora."}</p> : (
          <div className="tablewrap">
            <table className="pp-tabela">
              <caption className="sr-only">Valor contratado de cada peça de propaganda, por tipo: {cargo.toLowerCase()}{onde}, {ano}</caption>
              <thead><tr><th>Peça</th><th className="num">Valor contratado</th><th className="num">Parte da propaganda</th></tr></thead>
              {tabela.map((g) => (
                <tbody key={g.grupo}>
                  <tr className="pp-grupo"><th scope="rowgroup"><i className={grupo(g.grupo).classe} aria-hidden="true" />{g.rotulo}</th>
                    <td className="num">{reaisCentavos(g.centavos)}</td><td className="num">{parteTabela(g.parte)}</td></tr>
                  {g.linhas.map((l) => (
                    <tr key={l.chave}>
                      <td>{l.nome}{l.generico && <span className="muted"> (não diz a peça)</span>}{l.detalhe && <small className="muted">{l.detalhe}</small>}</td>
                      <td className="num">{reaisCentavos(l.centavos)}</td><td className="num">{parteTabela(l.parte)}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
              <tfoot><tr><th scope="row">Propaganda</th><td className="num">{reaisCentavos(c.somaCentavos)}</td><td className="num">100,0%</td></tr></tfoot>
            </table>
          </div>
        )}
      </details>
      <details className="card">
        <summary>Ver os números</summary>
        <div className="tablewrap">
          <table className="p9g-numeros">
            <caption className="sr-only">Campanha média, parte das campanhas que usou cada tipo e soma contratada, por cargo, em {ano}</caption>
            <thead>
              <tr><th rowSpan={2}>Cargo</th><th rowSpan={2} className="num">Campanhas</th><th colSpan={3} className="num">Campanha média</th>
                <th colSpan={3} className="num">Usaram o tipo</th><th rowSpan={2} className="num">Soma contratada</th></tr>
              <tr>{[0, 1].flatMap((k) => TIPOS.map((g) => <th key={`${k}${g}`} className="num">{tipoComum(g).legenda}</th>))}</tr>
            </thead>
            <tbody>
              {cargos.map((k) => (
                <tr key={k.cargo} aria-current={k.cargo === cargo ? "true" : undefined}>
                  <th scope="row">{k.cargo}{k.cargo === "Presidente" && uf ? " (nacional)" : ""}</th><td className="num">{inteiro(k.campanhas)}</td>
                  {k.partes.map((p) => <td key={`m${p.grupo}`} className="num">{p.de100}%</td>)}
                  {k.partes.map((p) => <td key={`u${p.grupo}`} className="num">{Math.round(p.usaram * 100)}%</td>)}
                  <td className="num">{reais(k.somaCentavos / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="card analise-metodo">
        <summary>Como calculamos</summary>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Campanha média: em cada campanha, a parte de cada tipo no total de propaganda; depois, a média dessas partes, em que
            cada campanha conta igual. O perfil do candidato compara a campanha com a mediana do grupo; esta página mostra a média,
            porque as médias dos três tipos somam 100%.</li>
          <li>Usaram o tipo: a parte das campanhas que contratou algum valor naquele tipo. A soma em reais, nos números, pesa mais as
            campanhas grandes.</li>
          <li>Valor contratado declarado ao TSE na prestação de contas final (ou na regularização), sem transferências e sem correção
            pela inflação. Só titulares, eleições ordinárias, quem disputou e campanhas com alguma propaganda.</li>
          <li>As peças saem da descrição de cada despesa. Algumas não dizem a peça (“impressos”, “marketing”): aparecem em cinza.</li>
          <li>Material de propaganda recebido pronto do partido ou de outra campanha não entra, porque não é despesa de quem recebe.
            Isso pesa nos vereadores: cerca de 32% deles receberam santinhos e adesivos prontos.</li>
          <li>Recorte por estado; presidente é sempre a campanha nacional. Não há recorte por município.</li>
        </ul>
      </details>
    </div>
  );
}
