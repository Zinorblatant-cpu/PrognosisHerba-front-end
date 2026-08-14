import type {
  GerarAlocacaoDePrevisoesRequest,
  GerarAlocacaoDePrevisoesResponse,
  PrevisaoRegiao,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8002";

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

export { ApiError };
