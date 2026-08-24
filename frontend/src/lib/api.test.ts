import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, gerarAlocacaoDePrevisoes, getPrevisoes, resolveBaseUrl } from "./api";

const BASE_URL = "http://127.0.0.1:8002";

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  } as Response;
}

describe("resolveBaseUrl", () => {
  it("usa a URL informada quando definida", () => {
    expect(resolveBaseUrl("http://exemplo:9000")).toBe("http://exemplo:9000");
  });

  it("usa o fallback local quando a URL não está definida", () => {
    expect(resolveBaseUrl(undefined)).toBe("http://127.0.0.1:8002");
  });
});

describe("api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPrevisoes faz GET em /previsoes e devolve o corpo", async () => {
    const dados = [{ idRegiao: "A" }];
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(dados));

    const resultado = await getPrevisoes();

    expect(resultado).toEqual(dados);
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/previsoes`,
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("gerarAlocacaoDePrevisoes faz POST com o payload serializado", async () => {
    const resposta = { mesReferencia: { ano: 2026, mes: 9 } };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(resposta));

    const payload = { quantidadeEquipes: 4 };
    const resultado = await gerarAlocacaoDePrevisoes(payload);

    expect(resultado).toEqual(resposta);
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/previsoes/gerar-alocacao`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(payload) }),
    );
  });

  it("lança ApiError com status 0 quando o fetch falha (backend fora do ar)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("network error"));

    await expect(getPrevisoes()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining(BASE_URL),
    });
  });

  it("o erro de rede é uma instância de ApiError", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("network error"));

    await expect(getPrevisoes()).rejects.toBeInstanceOf(ApiError);
  });

  it("lança ApiError com a mensagem do corpo quando a resposta não é ok", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ detail: "Sem solução viável." }, { ok: false, status: 422 }),
    );

    await expect(getPrevisoes()).rejects.toMatchObject({
      status: 422,
      message: "Sem solução viável.",
    });
  });

  it("lança ApiError com mensagem padrão quando o corpo do erro não é JSON válido", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("corpo inválido");
      },
    } as unknown as Response);

    await expect(getPrevisoes()).rejects.toMatchObject({
      status: 500,
      message: "Erro 500 ao chamar /previsoes",
    });
  });
});
