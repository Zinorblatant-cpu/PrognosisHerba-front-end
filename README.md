<h1 align="center">Horoprognosis — PrognosisHerba</h1>

<p align="center">
  <strong>Manejo de poda em rodovias: da previsão de crescimento ao cronograma das equipes em campo.</strong><br>
  A IA prevê a altura da vegetação por região, um solver de programação linear inteira
  aloca as equipes respeitando prazos e capacidade, e as equipes recebem a agenda no celular.
</p>

<p align="center">
  <img alt="python" src="https://img.shields.io/badge/python-3.11+-3776AB?logo=python&logoColor=white">
  <img alt="fastapi" src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white">
  <img alt="pulp" src="https://img.shields.io/badge/PuLP%2FCBC-solver-EE4C2C">
  <img alt="react" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="tests" src="https://img.shields.io/badge/testes-313-2EA44F?logo=pytest&logoColor=white">
</p>

<p align="center">
  <a href="#-visão-geral">Visão geral</a> ·
  <a href="#-arquitetura">Arquitetura</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-configuração">Configuração</a> ·
  <a href="#-referência-da-api">API</a> ·
  <a href="#-testes">Testes</a> ·
  <a href="#-decisões-de-design">Decisões</a>
</p>

---

## Sumário

- [Visão geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [De onde vêm as previsões](#-de-onde-vêm-as-previsões)
- [Quick start](#-quick-start)
- [Configuração](#-configuração)
- [Referência da API](#-referência-da-api)
- [Estrutura do repositório](#-estrutura-do-repositório)
- [Testes](#-testes)
- [Decisões de design](#-decisões-de-design)
- [Roadmap](#-roadmap)

---

## 🌱 Visão geral

Faixas de vegetação em canteiros e taludes de rodovia precisam ser podadas **antes** de virarem
risco. Decidir *onde* e *quando* mandar cada equipe é um problema de alocação com prazos rígidos
(a semana em que a previsão cruza o limiar de poda), capacidade finita e terrenos de dificuldade
diferente — exatamente o tipo de coisa que vira planilha e intuição na falta de ferramenta.

Este sistema fecha o ciclo: **previsão → otimização → campo → acompanhamento.**

| Etapa | O que faz |
|---|---|
| **Previsões IA** | Altura prevista por região, semana a semana, com o limiar de poda marcado |
| **Otimização** | Deriva os locais que cruzam o limiar e roda o solver PuLP/CBC sobre todo o horizonte |
| **Cronograma** | Grade equipe × dia útil, com data-limite e folga de cada local |
| **Agrupamento** | Junta regiões por perfil de crescimento (k-means) — camada de análise |
| **Monitoramento** | Progresso ao vivo do que as equipes já marcaram como concluído |

Três aplicações, cada uma no seu servidor:

| | Stack | Porta | Papel |
|---|---|---|---|
| [`backend/`](backend/) | FastAPI · PuLP/CBC · scikit-learn | `8002` | Previsões, solver, persistência |
| [`frontend/`](frontend/) | React 19 · Vite · Tailwind 4 · Recharts | `5173` | Painel de planejamento (desktop e mobile) |
| [`podadores/`](podadores/) | React 19 · Vite · Tailwind 4 | `5174` | Agenda das equipes em campo (mobile-first) |

> Os dois frontends só mostram dados reais com o backend no ar — **suba o backend primeiro.**

A formulação completa do modelo de otimização está em
[`MODELO_MATEMATICO.md`](MODELO_MATEMATICO.md).

---

## 🏗️ Arquitetura

```
   ┌──────────────────────────────┐
   │  IA de crescimento           │   planilha .xlsx, 52 semanas
   │  (API externa Grama Webcam)  │   GET /previsoes  ·  X-API-Key
   └───────────────┬──────────────┘
                   │  ingestão com TTL de 15min
                   ▼
   ┌──────────────────────────────────────────────────────────────────────┐
   │                    BACKEND  ·  FastAPI  ·  :8002                     │
   │                                                                      │
   │   fonte_previsoes.py ──reescreve──▶ previsoes_52_semanas.csv         │
   │     (API fora do ar → mantém o CSV anterior)      │                  │
   │                                                  ▼                   │
   │                      previsoes.py  ·  clusterizacao.py               │
   │                                        │                             │
   │        ┌───────────────────────────────┼──────────────────────┐      │
   │        ▼                               ▼                      ▼      │
   │  GET /previsoes          POST /previsoes/gerar-alocacao   GET /clus- │
   │                            └─ horoprognosis.py (PuLP)      terizacao │
   │                                        │                             │
   │                            POST /alocacao/publicar                   │
   │                                        ▼                             │
   │                          data/podadores.db (SQLite)                  │
   └────────┬──────────────────────────────────────────────┬──────────────┘
            │                                              │
            ▼                                              ▼
   ┌──────────────────────┐                    ┌──────────────────────────┐
   │  frontend/  :5173    │                    │  podadores/  :5174       │
   │                      │                    │                          │
   │  Previsões IA        │                    │  agenda do dia           │
   │  Otimização          │─── publica ───────▶│  marcar concluído        │
   │  Cronograma          │                    │  equipe no localStorage  │
   │  Agrupamento         │◀── monitora ───────│  (sem login)             │
   │  Monitoramento       │                    │                          │
   └──────────────────────┘                    └──────────────────────────┘
```

**Fluxo de uso.** Abre o painel → *Previsões IA* mostra o crescimento previsto → *Otimização*
roda o solver e **publica automaticamente** a alocação → as equipes veem a agenda em
`:5174` e marcam locais como concluídos → *Monitoramento* acompanha o progresso ao vivo.

**Estado.** Só `/alocacao/*` persiste, em SQLite (`backend/data/podadores.db`). O resto do
backend é sem estado: cada chamada ao solver é autocontida. A alocação gerada no painel vive
no contexto do React — recarregar a página zera o *Cronograma* até rodar a Otimização de novo
(o que ficou publicado para os podadores, esse sim, sobrevive).

---

## 📥 De onde vêm as previsões

A IA de crescimento publica as previsões como planilha `.xlsx` numa API externa. O backend
ingere essa planilha e a converte no CSV que o resto do código já lia:

```
GET /previsoes (externa)  →  aba "previsao_52_semanas_podas"  →  data/previsoes_v3_52_semanas.csv
```

O CSV funciona como **cache em disco**, não como formato intermediário descartável:

- a API externa roda em plano gratuito que hiberna e leva ~50s para acordar — sem o arquivo
  local, toda visita à tela de Previsões dependeria dessa latência;
- se a ingestão falhar (rede, timeout, planilha corrompida, aba faltando), o backend **loga
  um aviso e segue com o último CSV bom** — as telas nunca caem junto;
- a escrita é atômica: um download interrompido não deixa o CSV pela metade.

Sem `GRAMA_API_KEY` configurada, a ingestão fica **desligada** e o backend usa apenas o CSV
versionado em `backend/data/` — que é o comportamento original do projeto.

> **Nota sobre topografia.** A aba de 52 semanas traz altura, nível de alerta e `houve_poda`,
> mas não traz `inclinacao_graus` nem `area_de_risco`. A aba `simulacao_todas_regioes` traz,
> porém hoje com valor constante para todas as regiões — o que achataria `faixa_dificuldade()`
> em "facil" para todo mundo e tiraria do solver a dimensão de dificuldade. Até a IA passar a
> mandar esses campos variados, eles vivem em `TOPOGRAFIA_POR_REGIAO`
> (`backend/fonte_previsoes.py`).

---

## 🚀 Quick start

Pré-requisitos: **Python 3.11+** e **Node.js 20+**.

Três terminais, a partir da raiz do repositório:

```bash
# terminal 1 — backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8002 --reload

# terminal 2 — painel de planejamento
cd frontend
npm install
npm run dev

# terminal 3 — site das equipes de poda
cd podadores
npm install
npm run dev
```

Confirmar que o backend subiu:

```bash
curl http://127.0.0.1:8002/health
# {"status":"ok"}
```

Abra **http://localhost:5173**. A tela inicial lista as etapas na ordem de uso.
Rodar a Otimização publica a alocação para **http://localhost:5174**.

---

## ⚙️ Configuração

### Backend — `backend/.env` (opcional, gitignored)

Copie de [`backend/.env.example`](backend/.env.example). Todas as variáveis têm default;
sem o arquivo, o backend roda com o CSV local.

| variável | default | o que faz |
|---|---|---|
| `GRAMA_API_URL` | API de produção | endpoint da planilha de previsões |
| `GRAMA_API_KEY` | *(vazio)* | chave de leitura. **Vazia = ingestão desligada** |
| `GRAMA_SYNC_TTL_S` | `900` | intervalo mínimo entre buscas (15min) |
| `GRAMA_SYNC_TIMEOUT_S` | `30` | timeout HTTP; ao estourar, cai no CSV local |

> Nunca versione `backend/.env` — ele está no `.gitignore` justamente por conter a chave.

### Frontends — `frontend/.env` e `podadores/.env`

```
VITE_API_BASE_URL=http://127.0.0.1:8002
```

Ajuste se o backend estiver em outra porta ou host.

### Calibração do modelo

`LIMIAR_PODA_CM` (altura que coloca a região na fila) e `CAPACIDADE_DIARIA` vivem no backend
e são expostos por `GET /parametros` — as telas leem dali em vez de duplicar os números.

---

## 📡 Referência da API

Base: `http://127.0.0.1:8002` · Docs interativas: `/docs` (Swagger) e `/redoc` · Sem autenticação.

### Previsões

| método | rota | descrição |
|---|---|---|
| `GET` | `/previsoes` | Previsões por região, semana a semana. Sincroniza da API externa antes de responder (respeitando o TTL) |
| `POST` | `/previsoes/gerar-alocacao` | Deriva os locais que cruzam o limiar e roda o solver sobre **todo** o horizonte, cada local com seu prazo |
| `GET` | `/clusterizacao` | Agrupa regiões por rota, altura e tendência (k-means). Aceita `?k=N` |

O **horizonte** (número de semanas) é lido do arquivo, nunca cravado no código nem nas telas —
trocar o CSV basta.

> ⚠️ Em `/clusterizacao`, os **dados de rota são simulados** (`ROTAS_SIMULADAS`): o CSV de
> previsão não tem campo geográfico. Altura e tendência são reais. A resposta carrega
> `avisoRota` e as telas exibem esse aviso.

### Alocação

| método | rota | descrição |
|---|---|---|
| `POST` | `/gerar-alocacao` | Roda o solver direto sobre um lote informado no payload, sem passar pelas previsões |
| `POST` | `/alocacao/publicar` | Publica a alocação para o site dos podadores. O painel chama automaticamente após o solver |
| `GET` | `/alocacao/atual` | Última alocação publicada + status de conclusão (`404` se nada foi publicado) |
| `POST` | `/alocacao/locais/concluir` | Marca/desmarca um local como concluído |

### Serviço

| método | rota | descrição |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/parametros` | `limiarPodaCm` e `capacidadeDiaria` — fonte única de calibração |

---

## 📂 Estrutura do repositório

```
.
├── backend/                      # FastAPI + solver
│   ├── server.py                # rotas e schemas Pydantic
│   ├── horoprognosis.py         # modelo PuLP/CBC (ver MODELO_MATEMATICO.md)
│   ├── previsoes.py             # CSV → locais de poda (prioridade, dificuldade, prazo)
│   ├── fonte_previsoes.py       # ingestão da planilha .xlsx da IA externa
│   ├── clusterizacao.py         # k-means por rota / altura / tendência
│   ├── persistencia.py          # SQLite da alocação publicada
│   ├── data/                    # CSVs de previsão + podadores.db
│   └── tests/                   # 173 testes
│
├── frontend/                     # painel de planejamento
│   └── src/
│       ├── pages/               # Home, PrevisoesIA, Otimizacao, Cronograma,
│       │                        # Agrupamento, Monitoramento
│       ├── components/layout/   # AppShell (gaveta mobile) + Sidebar
│       ├── components/ui/       # Card, Button, Tag, KpiCard, Estado
│       └── state/               # AlocacaoContext
│
├── podadores/                    # agenda das equipes (mobile-first)
│   └── src/
│       ├── components/          # Agenda, SeletorEquipe, PriorityTag
│       └── lib/                 # api, equipe (localStorage), formato
│
└── MODELO_MATEMATICO.md          # formulação do modelo de otimização
```

---

## 🧪 Testes

**313 testes** no total, sem mock de solver nem de banco: o PuLP resolve de verdade e o SQLite
grava de verdade.

```bash
cd backend    && pytest              # 173
cd frontend   && npm test            #  96
cd podadores  && npm test            #  44
```

Cobertura nos frontends (`npm run test:coverage`) exige **100%** em statements, branches,
functions e lines — o limite está em `vitest.config.ts` e reprova o build abaixo disso.

A suíte do backend é **hermética**: `tests/conftest.py` zera `GRAMA_API_KEY`, então nenhum teste
toca a API externa. A ingestão é exercitada em `tests/test_fonte_previsoes.py`, que monta uma
planilha `.xlsx` sintética célula a célula em vez de bater na rede.

Lint: `npm run lint` (oxlint) nos dois frontends.

---

## 🧭 Decisões de design

Decisões que não são óbvias lendo o código — o *porquê* de cada uma:

- **Solver sobre todo o horizonte, não mês a mês.** Cada local carrega seu próprio prazo
  (`dataAlvo`, a semana em que a previsão cruza o limiar). Otimizar mês a mês criava fronteiras
  artificiais e distribuía as equipes de forma desigual.
- **CSV como cache em disco, não como formato intermediário.** É o que mantém o sistema de pé
  quando a API externa da IA está hibernando. Ver [De onde vêm as previsões](#-de-onde-vêm-as-previsões).
- **Formato numérico preservado na ingestão** (`8.6`, não `8.60`). O CSV é versionado; escrever
  no mesmo formato que a IA usa faz um sync sem novidade produzir diff zero — dá para ver de
  relance quando a previsão realmente mudou.
- **`.xlsx` lido com `zipfile` + `ElementTree`.** Uma planilha é um zip de XML; ler assim evita
  somar `openpyxl`/`pandas` só para extrair uma aba.
- **Clusterização separada do solver.** É camada de análise: agrupar regiões parecidas ajuda a
  entender o terreno, mas não alimenta a Otimização — misturar as duas tornaria o cronograma
  refém de um `k` arbitrário.
- **Topografia por região no backend.** Enquanto a IA mandar `inclinacao_graus` constante, tirar
  esse dado da planilha colapsaria a dificuldade de todos os locais em "facil".
- **SQLite para a alocação publicada.** Único estado do sistema, volume baixo, sem concorrência
  pesada — um servidor de banco à parte seria peso morto no deploy.
- **Podadores sem login.** A equipe fica no `localStorage` do aparelho. Autenticação para marcar
  "podei este local" adicionaria atrito em campo sem proteger nada sensível.
- **Uma sidebar só, que vira gaveta.** Abaixo de `lg` o mesmo `<aside>` vira off-canvas em vez de
  existirem dois menus duplicados no DOM — um só conjunto de links, um só lugar para mexer.

---

## 🗺️ Roadmap

- [ ] **Rotas geográficas reais** — substituir `ROTAS_SIMULADAS` pela base real; a planilha da IA
      já traz `regiao` e `km_rodoanel` nas abas de simulação
- [ ] **Topografia vinda da IA** — quando `inclinacao_graus` variar por região, aposentar
      `TOPOGRAFIA_POR_REGIAO`
- [ ] **Endpoint de sync manual** — `garantir_previsoes_atuais(forcar=True)` já ignora o TTL;
      falta expor para um botão na tela ou um cron
- [ ] **Persistir a alocação do painel** — hoje o Cronograma se perde ao recarregar a página
- [ ] **Autenticação por equipe** no site dos podadores, se o uso em campo pedir rastreabilidade

---

<p align="center">
  <sub>Previsão · Otimização · Campo — o ciclo fechado do manejo de poda.</sub>
</p>
