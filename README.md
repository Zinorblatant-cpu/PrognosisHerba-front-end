# Horoprognosis — PrognosisHerba

Sistema de manejo de poda: prevê o crescimento da vegetação por região
(`Previsões IA`), gera a alocação ótima de equipes de poda a partir dessas
previsões via solver PuLP/CBC (`Otimização`) e mostra o resultado numa grade
equipe × dia (`Cronograma`). Ver [`MODELO_MATEMATICO.md`](MODELO_MATEMATICO.md)
para a formulação do modelo de otimização.

Três partes, cada uma no seu próprio servidor:

| | Stack | Porta |
|---|---|---|
| `backend/` | FastAPI + PuLP | `8002` |
| `frontend/` | React + Vite + Tailwind (painel de otimização) | `5173` |
| `podadores/` | React + Vite + Tailwind (agenda das equipes de poda) | `5174` |

Os dois frontends só mostram dados reais se o backend estiver no ar — **suba
o backend primeiro**.

---

## Backend

Pré-requisito: Python 3.11+.

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8002 --reload
```

Confirmar que subiu:

```bash
curl http://127.0.0.1:8002/health
# {"status":"ok"}
```

Endpoints principais:

- `GET  /health` — liveness check.
- `GET  /previsoes` — previsões de crescimento por região (dados de
  `backend/data/previsoes_v3_12_semanas.csv`).
- `POST /previsoes/gerar-alocacao` — deriva os locais que atingiram o
  limiar de poda a partir das previsões e roda o solver.
- `POST /gerar-alocacao` — roda o solver direto sobre um lote de locais
  informado no payload (sem passar pelas previsões).
- `POST /alocacao/publicar` — publica uma alocação gerada para que o site
  dos podadores (`podadores/`) possa exibi-la. Chamado automaticamente pelo
  `frontend/` depois de rodar o solver.
- `GET  /alocacao/atual` — última alocação publicada, com o status de
  conclusão de cada local (404 se nada foi publicado ainda).
- `POST /alocacao/locais/concluir` — marca/desmarca um local como concluído.

`/alocacao/*` persistem em `backend/data/podadores.db` (SQLite) — é o único
estado com persistência no backend; o resto é sem estado.

Rodar os testes:

```bash
cd backend
pytest
```

---

## Frontend

Pré-requisito: Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. A URL do backend vem de `frontend/.env`:

```
VITE_API_BASE_URL=http://127.0.0.1:8002
```

Ajuste esse valor se o backend estiver rodando em outra porta/host.

Outros comandos:

```bash
npm run build          # build de produção (tsc -b && vite build)
npm run preview        # serve o build de produção localmente
npm run lint            # oxlint
npm run test            # vitest (100% de cobertura exigido em statements/branches/functions/lines)
npm run test:coverage   # vitest com relatório de cobertura
```

---

## Podadores

Site separado, mobile-first, para as equipes de poda verem sua agenda do dia
e marcarem locais como concluídos. Não tem os controles de Previsões IA /
Otimização — só consome `GET /alocacao/atual` e `POST
/alocacao/locais/concluir`. A equipe fica salva no `localStorage` do
aparelho (sem login).

Pré-requisito: Node.js 20+.

```bash
cd podadores
npm install
npm run dev
```

Abre em `http://localhost:5174`. Mesmos comandos de `npm run
build`/`preview`/`lint`/`test`/`test:coverage` do `frontend/`, e a mesma
variável `VITE_API_BASE_URL` em `podadores/.env`.

---

## Rodando tudo junto

Em três terminais separados, a partir de `horoprognosis/`:

```bash
# terminal 1
cd backend && uvicorn server:app --host 127.0.0.1 --port 8002 --reload

# terminal 2
cd frontend && npm run dev

# terminal 3
cd podadores && npm run dev
```

Depois abre `http://localhost:5173` — a tela inicial lista as três funções
(Previsões IA → Otimização → Cronograma), nessa ordem de uso. Rodar a
Otimização também publica a alocação para `http://localhost:5174`, onde as
equipes de poda acompanham a própria agenda.
