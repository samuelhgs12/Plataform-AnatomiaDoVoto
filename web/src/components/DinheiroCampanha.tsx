import Link from "next/link";
import type { CarreiraItem, Receitas } from "@/lib/types";
import { deCada100, FONTES, textoDe100 } from "@/lib/financiamento";
import { pct, reais } from "@/lib/format";
import { Donut } from "./Donut";

/**
 * Bloco do perfil "Dinheiro da campanha e resultado" (pergunta 8: recursos públicos × sucesso eleitoral). Só há receitas de 2018 em diante.
 * `opcoes` são as candidaturas com dados possíveis; `hrefDe` monta o link que troca a candidatura escolhida.
 */
export function DinheiroCampanha({ opcoes, escolhida, receitas, hrefDe }: {
  opcoes: CarreiraItem[]; escolhida: CarreiraItem | undefined; receitas: Receitas | null; hrefDe: (id: number) => string;
}) {
  return (
    <section className="card" aria-labelledby="h-din" id="dinheiro">
      <div className="kicker">Pergunta 8</div>
      <h2 id="h-din">Dinheiro da campanha e resultado</h2>
      {!escolhida ? (
        <p className="muted">Os dados de quanto cada campanha recebeu só existem a partir de 2018, e esta pessoa não disputou eleições desde então.</p>
      ) : (
        <>
          {opcoes.length > 1 && (
            <div className="chips" style={{ margin: "6px 0 12px" }} aria-label="Escolha a campanha">
              {opcoes.map((o) => (
                <Link key={o.id_candidatura} className={`chip${o.id_candidatura === escolhida.id_candidatura ? " on" : ""}`} href={hrefDe(o.id_candidatura)} scroll={false}>
                  {o.ano} · {o.cargo}
                </Link>
              ))}
            </div>
          )}
          <Conteudo c={escolhida} r={receitas} />
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
      <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
        <Link href={panorama}>Ver o panorama de todos os candidatos a {c.cargo.toLowerCase()} em {c.ano} →</Link>
      </p>
    </>
  );
}
