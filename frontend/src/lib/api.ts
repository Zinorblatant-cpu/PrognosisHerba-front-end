import type {
  AlocacaoPublicada,
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

export { ApiError };
