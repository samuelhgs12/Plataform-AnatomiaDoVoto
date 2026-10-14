# Esboço das telas

Inspirado no especial "Quem são os candidatos" do G1 (listagem por cargo e perfil por pessoa), adaptado aos nossos dados:
não temos foto, propostas nem bens declarados; temos a **carreira de 1998 a 2024** e os **gastos de campanha**, que são o diferencial.
**Antes de fechar o desenho, abram a página do G1 (desktop e celular) e anotem:** campos do card, filtros, ordenação e blocos do perfil.

Estado: ✅ implementado no esqueleto · 🔲 a fazer.

| Rota | Tela | Estado |
|---|---|---|
| `/` | Início: busca com sugestões, atalhos por UF, cartões das análises | ✅ |
| `/candidatos` | Candidatos de uma eleição: padrão = ano mais recente; presidente em ano de eleição geral, prefeito em ano municipal; cargo estadual/municipal sem UF pede a escolha do estado antes de listar. Cards com avatar de iniciais, partido, resultado, votos; paginação | ✅ |
| `/candidato/[id]` | Perfil: cabeçalho + KPIs, carreira (P10), gastos (P9), receitas (P8) | ✅ (💡 custo por voto e percentil: 🔲) |
| `/analises/pos-mandato` | Fluxo depois do mandato, por UF e ano (P10) | ✅ |
| `/analises/legenda` | Voto de legenda (P5): série histórica por partido e UF, comparação entre ciclos, mudanças nos partidos e tabela | ✅ · 🔲 mapa por município |
| `/analises/retencao` | Retenção por turma de estreia (P10) | 🔲 (dados já em `q10.json`: `permanencia`) |
| `/analises/trocas` | Trocas de partido por ano e matriz origem × destino (P10) | 🔲 (`q10.json`: `trocas`) |
| `/analises/propaganda` | Gasto em propaganda por cargo e ano (P9) | 🔲 |
| `/sobre` | Fonte, escopo, como lemos os dados, privacidade | ✅ |

## Perfil do candidato (a tela principal)

```
┌───────────────────────────────────────────────────────────────┐
│ ← Voltar à listagem                                           │
│ ┌──┐  NOME DE URNA                                            │
│ │MS│  nome civil · ocupação                                   │
│ └──┘  [PARTIDO] cargo · UF · ano                              │
│  [3 eleições]  [2 vitórias]  [2 partidos]                     │
│  "Disputou 3 eleições entre 2016 e 2022, venceu 2; ..."       │
├───────────────────────────────────────────────────────────────┤
│ PERGUNTA 10 · Carreira eleitoral                              │
│  Presidente      ·····································        │
│  Gov./Senador    ·····································        │
│  Dep. federal    ·····································        │
│  Dep. estadual   ·································○···        │
│  Prefeito        ·····································        │
│  Vereador        ·········●······●···················        │
│                  1998 ... 2016 ... 2020 ... 2024              │
│  ● eleito  ○ não eleito   ▸ Ver candidaturas em tabela        │
│  Trocas de partido: 2022: PSB → PSD                           │
├───────────────────────────────────────────────────────────────┤
│ PERGUNTA 9 · Gastos de campanha   [2016] [2020] [2022]        │
│  Propaganda física   ███████████████████|        R$ 3.000     │
│  Propaganda digital  ███████████|                R$ 1.500     │
│  Outros              ███████|                    R$ 1.000     │
│  (| = mediana do mesmo cargo, ano e UF)                       │
│  Nuvem de palavras das despesas de propaganda                 │
├───────────────────────────────────────────────────────────────┤
│ PERGUNTA 8 · De onde veio o dinheiro   [▓▓▓▓▓▓▓░░░] pública   │
└───────────────────────────────────────────────────────────────┘
```

## Acessibilidade (pontos de revisão em todo PR)

- Todo gráfico tem texto equivalente (`aria-label`/tabela). Cor nunca é o único código (eleito = ponto **cheio**).
- Contraste mínimo 4,5:1; navegação por teclado nos filtros; `lang="pt-BR"`.
- No celular, a linha do tempo rola na horizontal em vez de encolher.
