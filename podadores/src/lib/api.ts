import type { AlocacaoPublicada, ConcluirLocalRequest } from "./types";

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

/** null quando ainda não há nenhuma alocação publicada pela Otimização. */
export async function obterAlocacaoAtual(): Promise<AlocacaoPublicada | null> {
  try {
    return await request<AlocacaoPublicada>("/alocacao/atual");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function concluirLocal(payload: ConcluirLocalRequest): Promise<AlocacaoPublicada> {
  return request<AlocacaoPublicada>("/alocacao/locais/concluir", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export { ApiError };
