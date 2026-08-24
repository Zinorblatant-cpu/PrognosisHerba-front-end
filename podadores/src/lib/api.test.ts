import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, concluirLocal, obterAlocacaoAtual, resolveBaseUrl } from "./api";

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

  it("obterAlocacaoAtual faz GET em /alocacao/atual e devolve o corpo", async () => {
    const dados = { publicadoEm: "x", mesReferencia: { ano: 2026, mes: 9 }, alocacoes: [], naoAlocados: [] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(dados));

    const resultado = await obterAlocacaoAtual();

    expect(resultado).toEqual(dados);
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/alocacao/atual`,
      expect.objectContaining({ headers: { "Content-Type": "application/json" } }),
    );
  });

  it("obterAlocacaoAtual devolve null quando o backend responde 404", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ detail: "Nenhuma alocação foi publicada ainda." }, { ok: false, status: 404 }),
    );

    await expect(obterAlocacaoAtual()).resolves.toBeNull();
  });

  it("obterAlocacaoAtual relança erros que não são 404", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      jsonResponse({ detail: "Erro interno." }, { ok: false, status: 500 }),
    );

    await expect(obterAlocacaoAtual()).rejects.toMatchObject({ status: 500, message: "Erro interno." });
  });

  it("obterAlocacaoAtual relança erro de rede como ApiError de status 0", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("network error"));

    await expect(obterAlocacaoAtual()).rejects.toBeInstanceOf(ApiError);
  });

  it("concluirLocal faz POST em /alocacao/locais/concluir com o payload serializado", async () => {
    const resposta = { publicadoEm: "x", mesReferencia: { ano: 2026, mes: 9 }, alocacoes: [], naoAlocados: [] };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(jsonResponse(resposta));

    const payload = { equipeId: "equipe_1", dia: "2026-09-14", localId: "local_1", concluido: true };
    const resultado = await concluirLocal(payload);

    expect(resultado).toEqual(resposta);
    expect(fetch).toHaveBeenCalledWith(
      `${BASE_URL}/alocacao/locais/concluir`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(payload) }),
    );
  });

  it("lança ApiError com status 0 quando o fetch falha (backend fora do ar)", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError("network error"));

    await expect(concluirLocal({ equipeId: "e", dia: "d", localId: "l", concluido: true })).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining(BASE_URL),
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

    await expect(concluirLocal({ equipeId: "e", dia: "d", localId: "l", concluido: true })).rejects.toMatchObject({
      status: 500,
      message: "Erro 500 ao chamar /alocacao/locais/concluir",
    });
  });
});
