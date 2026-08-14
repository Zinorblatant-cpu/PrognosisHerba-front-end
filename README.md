# Horoprognosis — PrognosisHerba

Sistema de manejo de poda: prevê o crescimento da vegetação por região
(`Previsões IA`), gera a alocação ótima de equipes de poda a partir dessas
previsões via solver PuLP/CBC (`Otimização`) e mostra o resultado numa grade
equipe × dia (`Cronograma`). Ver [`MODELO_MATEMATICO.md`](MODELO_MATEMATICO.md)
para a formulação do modelo de otimização.

Duas partes, cada uma no seu próprio servidor:

| | Stack | Porta |
|---|---|---|
| `backend/` | FastAPI + PuLP | `8002` |
| `frontend/` | React + Vite + Tailwind | `5173` |

O frontend só mostra dados reais se o backend estiver no ar — **suba o
backend primeiro**.

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
npm run build     # build de produção (tsc -b && vite build)
npm run preview   # serve o build de produção localmente
npm run lint       # oxlint
```

---

## Rodando os dois juntos

Em dois terminais separados, a partir de `horoprognosis/`:

```bash
# terminal 1
cd backend && uvicorn server:app --host 127.0.0.1 --port 8002 --reload

# terminal 2
cd frontend && npm run dev
```

Depois abre `http://localhost:5173` — a tela inicial lista as três funções
(Previsões IA → Otimização → Cronograma), nessa ordem de uso.
