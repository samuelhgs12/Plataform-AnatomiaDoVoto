import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";

const UFS = ["AP", "ES", "MG", "PE", "RJ", "RR"];

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Anatomia do Voto</h1>
        <p>Seis estados, 1998–2024, mais de meio milhão de políticos. Veja a carreira de cada candidato, para onde foi o dinheiro da propaganda e como os partidos dependem do voto de legenda.</p>
        <SearchBox />
      </section>

      <section aria-labelledby="h-uf" className="card">
        <h2 id="h-uf">Candidatos por estado</h2>
        <div className="chips">
          {UFS.map((uf) => <Link key={uf} className="chip" href={`/candidatos?uf=${uf}&ano=2024&cargo=13`}>{uf}</Link>)}
        </div>
      </section>

      <section aria-labelledby="h-an">
        <h2 id="h-an" style={{ margin: "18px 0 10px" }}>Análises</h2>
        <div className="cards3">
          <Link href="/analises/pos-mandato" className="card card-link">
            <h3>O que acontece depois de um mandato</h3>
            <p className="muted">Reeleição, mudança de cargo, derrota ou saída, por cargo e ano.</p>
          </Link>
          <Link href="/analises/legenda" className="card card-link">
            <h3>Voto de legenda</h3>
            <p className="muted">Quantos votos e que proporção cada partido recebeu só na sigla, de 2018 a 2024, com fusões e renomeações marcadas.</p>
          </Link>
          <Link href="/analises/financiamento" className="card card-link">
            <h3>Dinheiro público e sucesso eleitoral</h3>
            <p className="muted">Quem recebe mais dinheiro público para a campanha se elege mais?</p>
          </Link>
          <Link href="/candidatos" className="card card-link">
            <h3>Perfil do candidato</h3>
            <p className="muted">Linha do tempo da carreira e gastos de campanha por categoria.</p>
          </Link>
        </div>
      </section>
    </>
  );
}
