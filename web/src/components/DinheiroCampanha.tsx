import Link from "next/link";
import type { CarreiraItem, Receitas } from "@/lib/types";
import { deCada100, FONTES, resumoCampanhas, textoDe100 } from "@/lib/financiamento";
import { pct, reais } from "@/lib/format";
import { BarrasH } from "./BarrasH";
import { Donut } from "./Donut";

/**
 * Bloco do perfil "Dinheiro da campanha e resultado" (pergunta 8: recursos públicos × sucesso eleitoral). Só há receitas de 2018 em diante.
 * `campanhas` são as candidaturas com dados possíveis, da mais recente para a mais antiga, com as receitas de cada uma.
 * Com mais de uma, a lista compara todas; clicar numa linha (`hrefDe`) mostra o detalhe dela embaixo.
 */
export function DinheiroCampanha({ campanhas, escolhida, hrefDe }: {
  campanhas: { c: CarreiraItem; r: Receitas | null }[]; escolhida: number | undefined; hrefDe: (id: number) => string;
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
          <Conteudo c={atual.c} r={atual.r} />
        </>
      )}
    </section>
  );
}

function Conteudo({ c, r }: { c: CarreiraItem; r: Receitas | null }) {
  if (!r) return <p className="muted">Não foi possível carregar as receitas agora.</p>;
  if (r.total <= 0) return <p>Na campanha de {c.ano} a {c.cargo.toLowerCase()}, não há registro de dinheiro recebido na prestação de contas. Resultado: <b>{c.eleito ? "foi eleito" : "não foi eleito"}</b>.</p>;
  const valores = FONTES.map((f) => r[f.chave] ?? 0);
  const centavos = deCada100(valores);
  const publicoDe100 = centavos[0] + centavos[1];
  const panorama = `/analises/financiamento?${new URLSearchParams({ ano: String(c.ano), cargo: c.cargo, ...(c.uf && c.uf !== "BR" ? { uf: c.uf } : {}) })}`;
  return (
    <>
      <div className="resposta perfil">
        <Donut fatias={FONTES.map((f, i) => ({ rotulo: f.rotulo, valor: valores[i], cor: `var(--${f.classe})` }))} tamanho={200}
          centro={`${publicoDe100}%`} legendaCentro="dinheiro público"
          descricao={`De cada 100 reais: ${FONTES.map((f, i) => `${centavos[i]} de ${f.rotulo}`).join(", ")}.`} />
        <div>
          <p className="manchete pequena">
            Em {c.ano}, a campanha a {c.cargo.toLowerCase()} recebeu <b>{reais(r.total)}</b>. De cada R$ 100,{" "}
            <b>R$ {publicoDe100} vieram de dinheiro público</b>.
            {" "}Resultado: <b>{c.eleito ? "foi eleito" : "não foi eleito"}</b>.
          </p>
          {[true, false].map((publico) => FONTES.some((f, i) => f.publico === publico && valores[i] > 0) && (
            <div key={String(publico)} className="grupo-fonte">
              <h3>{publico ? "Dinheiro público" : "Dinheiro privado"} <span>R$ {publico ? publicoDe100 : 100 - publicoDe100} de cada R$ 100</span></h3>
              <ul className="fontes">
                {FONTES.map((f, i) => f.publico === publico && valores[i] > 0 && (
                  <li key={f.chave}>
                    <i className={f.classe} aria-hidden="true" />
                    <div><b>{f.rotulo}</b><span className="valor">{reais(valores[i])} · {textoDe100(centavos[i], valores[i])}</span></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      {r.mediana_pct_publica_cargo !== null && r.pct_publica !== null && (
        <p style={{ marginBottom: 0 }}>
          Para comparar: entre os candidatos a {c.cargo.toLowerCase()}{c.uf && c.uf !== "BR" ? ` em ${c.uf}` : ""} em {c.ano}, o típico teve{" "}
          <b>{pct(r.mediana_pct_publica_cargo, 0)}</b> do dinheiro vindo de fonte pública; esta campanha teve <b>{pct(r.pct_publica, 0)}</b>.
        </p>
      )}
      <p className="muted" style={{ fontSize: 15, marginBottom: 0 }}>
        <Link href={panorama}>Ver o panorama de todos os candidatos a {c.cargo.toLowerCase()} em {c.ano} →</Link>
      </p>
    </>
  );
}
