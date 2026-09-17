import type {
  AlocacaoPublicada,
  AnaliseGramaResponse,
  CalibracaoFita,
  Clusterizacao,
  Parametros,
  GerarAlocacaoDePrevisoesRequest,
  GerarAlocacaoDePrevisoesResponse,
  PrevisaoRegiao,
  PublicarAlocacaoRequest,
} from "./types";

export function resolveBaseUrl(apiBaseUrl: string | undefined): string {
  return apiBaseUrl ?? "http://127.0.0.1:8002";
}

const BASE_URL = resolveBaseUrl(import.meta.env.VITE_API_BASE_URL);

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(
      `Não foi possível conectar ao backend em ${BASE_URL}. Confirme que o servidor está rodando (uvicorn server:app --port 8002).`,
      0,
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? `Erro ${res.status} ao chamar ${path}`, res.status);
  }

  return res.json() as Promise<T>;
}

/** Agrupamento das regiões por rota, altura atual e tendência de crescimento. */
export function getClusterizacao(): Promise<Clusterizacao> {
  return request<Clusterizacao>("/clusterizacao");
}

/** Constantes de calibração do backend (limiar de poda, capacidade diária). */
export function getParametros(): Promise<Parametros> {
  return request<Parametros>("/parametros");
}

export function getPrevisoes(): Promise<PrevisaoRegiao[]> {
  return request<PrevisaoRegiao[]>("/previsoes");
}

export function gerarAlocacaoDePrevisoes(
  payload: GerarAlocacaoDePrevisoesRequest,
): Promise<GerarAlocacaoDePrevisoesResponse> {
  return request<GerarAlocacaoDePrevisoesResponse>("/previsoes/gerar-alocacao", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function publicarAlocacao(payload: PublicarAlocacaoRequest): Promise<void> {
  await request<unknown>("/alocacao/publicar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** null quando ainda não há nenhuma alocação publicada pela Otimização. */
export async function getAlocacaoAtual(): Promise<AlocacaoPublicada | null> {
  try {
    return await request<AlocacaoPublicada>("/alocacao/atual");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/**
 * Envia uma foto avulsa de grama para análise por segmentação de cor.
 * Upload multipart — não passa pelo helper `request` porque este força
 * `Content-Type: application/json`, incompatível com FormData.
 *
 * `calibracao` é opcional: quando informada (2 pontos clicados na fita
 * métrica + a distância real entre eles), a resposta também traz
 * `analisePick` — altura média em cm via Teorema de Pick.
 */
export async function analisarImagemGrama(
  arquivo: File,
  calibracao?: CalibracaoFita,
): Promise<AnaliseGramaResponse> {
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  if (calibracao) {
    formData.append("calibP1X", String(calibracao.p1.x));
    formData.append("calibP1Y", String(calibracao.p1.y));
    formData.append("calibP2X", String(calibracao.p2.x));
    formData.append("calibP2Y", String(calibracao.p2.y));
    formData.append("calibDistanciaCm", String(calibracao.distanciaCm));
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/grama/analisar`, { method: "POST", body: formData });
  } catch {
    throw new ApiError(
      `Não foi possível conectar ao backend em ${BASE_URL}. Confirme que o servidor está rodando (uvicorn server:app --port 8002).`,
      0,
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? `Erro ${res.status} ao analisar a imagem`, res.status);
  }

  return res.json() as Promise<AnaliseGramaResponse>;
}

export { ApiError };
