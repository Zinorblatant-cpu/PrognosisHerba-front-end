import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Monitoramento } from "./Monitoramento";
import { ApiError, getAlocacaoAtual } from "../lib/api";
import type { AlocacaoPublicada } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, getAlocacaoAtual: vi.fn() };
});

const DADOS: AlocacaoPublicada = {
  publicadoEm: "2026-09-01T10:00:00Z",
  periodo: { inicio: "2026-09-14", fim: "2026-09-15" },
  alocacoes: [
    {
      equipeId: "equipe_2",
      dia: "2026-09-14",
      locais: [
        { localId: "RA-01", prioridade: "alta", dificuldade: "media", concluido: true },
        { localId: "RA-02", prioridade: "media", dificuldade: "facil", concluido: false },
      ],
    },
    {
      equipeId: "equipe_1",
      dia: "2026-09-15",
      locais: [{ localId: "RA-03", prioridade: "baixa", dificuldade: "dificil", concluido: false }],
    },
    {
      equipeId: "equipe_1",
      dia: "2026-09-14",
      locais: [{ localId: "RA-04", prioridade: "alta", dificuldade: "facil", concluido: false }],
    },
  ],
  naoAlocados: [],
};

describe("Monitoramento", () => {
  beforeEach(() => {
    vi.mocked(getAlocacaoAtual).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra estado de carregamento inicialmente", () => {
    vi.mocked(getAlocacaoAtual).mockReturnValue(new Promise(() => {}));
    render(<Monitoramento />);
    expect(screen.getByRole("heading", { name: "Monitoramento" })).toBeInTheDocument();
  });

  it("mostra estado vazio quando nada foi publicado", async () => {
    vi.mocked(getAlocacaoAtual).mockResolvedValue(null);
    render(<Monitoramento />);
    expect(await screen.findByText(/Nenhuma alocação foi publicada ainda/)).toBeInTheDocument();
  });

  it("mostra mensagem de erro vinda de ApiError", async () => {
    vi.mocked(getAlocacaoAtual).mockRejectedValue(new ApiError("Backend fora do ar.", 0));
    render(<Monitoramento />);
    expect(await screen.findByText("Backend fora do ar.")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhuma alocação foi publicada ainda/)).not.toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica para erros não-ApiError", async () => {
    vi.mocked(getAlocacaoAtual).mockRejectedValue(new Error("boom"));
    render(<Monitoramento />);
    expect(await screen.findByText("Erro ao carregar o monitoramento.")).toBeInTheDocument();
  });

  it("mostra progresso, equipes agrupadas e status de cada local", async () => {
    vi.mocked(getAlocacaoAtual).mockResolvedValue(DADOS);
    render(<Monitoramento />);

    expect(await screen.findByText("1 de 4 locais concluídos")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText(/Período: 2026-09-14 a 2026-09-15/)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Equipe 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Equipe 2" })).toBeInTheDocument();

    expect(screen.getByText("RA-01")).toBeInTheDocument();
    expect(screen.getByText("RA-02")).toBeInTheDocument();
    expect(screen.getByText("RA-03")).toBeInTheDocument();
    expect(screen.getByText("RA-04")).toBeInTheDocument();
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(screen.getAllByText("Pendente").length).toBe(3);
  });

  it("mostra 0% quando não há nenhum local na alocação publicada", async () => {
    vi.mocked(getAlocacaoAtual).mockResolvedValue({ ...DADOS, alocacoes: [] });
    render(<Monitoramento />);
    expect(await screen.findByText("0 de 0 locais concluídos")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("busca novamente ao clicar em Atualizar agora", async () => {
    vi.mocked(getAlocacaoAtual).mockResolvedValue(DADOS);
    const user = userEvent.setup();
    render(<Monitoramento />);

    await screen.findByText("1 de 4 locais concluídos");
    expect(getAlocacaoAtual).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Atualizar agora/ }));

    await waitFor(() => expect(getAlocacaoAtual).toHaveBeenCalledTimes(2));
  });

  it("mantém os dados exibidos quando uma atualização automática falha", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(getAlocacaoAtual).mockResolvedValueOnce(DADOS).mockRejectedValueOnce(new ApiError("Falhou.", 500));

    render(<Monitoramento />);

    await vi.waitFor(() => expect(screen.getByText("1 de 4 locais concluídos")).toBeInTheDocument());

    await vi.advanceTimersByTimeAsync(8000);

    await vi.waitFor(() => expect(screen.getByText("Falhou.")).toBeInTheDocument());
    expect(screen.getByText("1 de 4 locais concluídos")).toBeInTheDocument();
  });
});
