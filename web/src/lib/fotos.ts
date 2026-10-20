// Fotos de acervos abertos (Wikimedia Commons), baixadas em public/fotos. A origem e a licença de cada uma estão em
// public/fotos/credits.json; o rodapé lista os créditos. Nenhuma mostra candidato: são a urna, o Congresso e a votação.

export interface Foto { src: string; largura: number; altura: number; alt: string; titulo: string; autor: string; licenca: string; urlLicenca: string; pagina: string }

const commons = (arquivo: string) => `https://commons.wikimedia.org/wiki/File:${arquivo}`;
const DP = { licenca: "domínio público", urlLicenca: "https://creativecommons.org/publicdomain/mark/1.0/" };

export const FOTOS = {
  interior: {
    src: "/fotos/interior-da-urna-eletronica-01-12-2023.jpg", largura: 1920, altura: 1280,
    alt: "Urna eletrônica aberta numa bancada, com a placa e os cabos à mostra ao lado de uma urna fechada",
    titulo: "Interior da Urna Eletrônica", autor: "TSE", ...DP, pagina: commons("Interior_da_Urna_Eletr%C3%B4nica_(01-12-2023).jpg"),
  },
  confirma: {
    src: "/fotos/brazilian-dre-voting-machine-for-2022-elections.jpg", largura: 1280, altura: 853,
    alt: "Dedo apertando a tecla Confirma no teclado de uma urna eletrônica",
    titulo: "Brazilian DRE voting machine for 2022 elections", autor: "TSE", ...DP, pagina: commons("Brazilian_DRE_voting_machine_for_2022_elections.jpg"),
  },
  urna: {
    src: "/fotos/urna-eletronica-brasileira-ue2020.jpg", largura: 1920, altura: 1280,
    alt: "Urna eletrônica modelo 2020 e o terminal do mesário sobre uma mesa",
    titulo: "Urna eletrônica brasileira UE2020", autor: "TSE", ...DP, pagina: commons("Urna_eletr%C3%B4nica_brasileira_UE2020.jpg"),
  },
  congresso: {
    src: "/fotos/brazilian-national-congress.jpg", largura: 1920, altura: 1211,
    alt: "Congresso Nacional em Brasília, com chuva ao fundo",
    titulo: "Brazilian National Congress", autor: "Eurico Zimbres", licenca: "CC BY-SA 2.5", urlLicenca: "https://creativecommons.org/licenses/by-sa/2.5", pagina: commons("Brazilian_National_Congress.jpg"),
  },
  itajuba: {
    src: "/fotos/eleicao-municipal-2016-em-itajuba-1.jpg", largura: 1920, altura: 1080,
    alt: "Mesária libera a urna numa seção eleitoral em Itajubá, Minas Gerais, na eleição municipal de 2016",
    titulo: "Eleição municipal 2016 em Itajubá", autor: "Mateus S. Figueiredo", licenca: "CC BY-SA 4.0", urlLicenca: "https://creativecommons.org/licenses/by-sa/4.0", pagina: commons("Elei%C3%A7%C3%A3o_municipal_2016_em_Itajub%C3%A1_1.jpg"),
  },
} satisfies Record<string, Foto>;
