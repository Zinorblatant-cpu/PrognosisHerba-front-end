import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { ApiError, concluirLocal, obterAlocacaoAtual } from "./lib/api";
import { salvarEquipe } from "./lib/equipe";
import type { AlocacaoPublicada } from "./lib/types";

vi.mock("./lib/api", async () => {
  const actual = await vi.importActual<typeof import("./lib/api")>("./lib/api");
  return { ...actual, obterAlocacaoAtual: vi.fn(), concluirLocal: vi.fn() };
});

const DADOS: AlocacaoPublicada = {
  publicadoEm: "2026-08-24T00:00:00Z",
  mesReferencia: { ano: 2026, mes: 9 },
  alocacoes: [
    {
      equipeId: "equipe_1",
      dia: "2026-09-14",
      locais: [{ localId: "RA-01", prioridade: "alta", dificuldade: "media", concluido: false }],
    },
  ],
  naoAlocados: [],
};

describe("App", () => {
  beforeEach(() => {
    vi.mocked(obterAlocacaoAtual).mockReset();
    vi.mocked(concluirLocal).mockReset();
  });

  it("mostra o estado de carregamento inicialmente", () => {
    vi.mocked(obterAlocacaoAtual).mockReturnValue(new Promise(() => {}));
    render(<App />);
    expect(screen.getByText("Carregando agenda...")).toBeInTheDocument();
  });

  it("mostra mensagem de erro quando o backend não responde", async () => {
    vi.mocked(obterAlocacaoAtual).mockRejectedValue(new ApiError("Backend fora do ar.", 0));
    render(<App />);
    expect(await screen.findByText("Backend fora do ar.")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica para erros não-ApiError", async () => {
    vi.mocked(obterAlocacaoAtual).mockRejectedValue(new Error("boom"));
    render(<App />);
    expect(await screen.findByText("Erro ao carregar a agenda.")).toBeInTheDocument();
  });

  it("mostra estado vazio quando nada foi publicado", async () => {
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText(/Nenhuma alocação foi publicada ainda/)).toBeInTheDocument();
  });

  it("mostra o seletor de equipe quando nenhuma equipe está salva", async () => {
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    render(<App />);
    expect(await screen.findByText("Qual é a sua equipe?")).toBeInTheDocument();
  });

  it("vai direto para a agenda quando a equipe salva existe na alocação atual", async () => {
    salvarEquipe("equipe_1");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Equipe 1" })).toBeInTheDocument();
  });

  it("volta para o seletor quando a equipe salva não existe mais na alocação atual", async () => {
    salvarEquipe("equipe_9");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    render(<App />);
    expect(await screen.findByText("Qual é a sua equipe?")).toBeInTheDocument();
  });

  it("seleciona uma equipe e mostra a agenda dela", async () => {
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Equipe 1" }));

    expect(await screen.findByRole("heading", { name: "Equipe 1" })).toBeInTheDocument();
  });

  it("marca um local como concluído e atualiza a tela", async () => {
    salvarEquipe("equipe_1");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    const dadosAtualizados: AlocacaoPublicada = {
      ...DADOS,
      alocacoes: [
        {
          ...DADOS.alocacoes[0],
          locais: [{ ...DADOS.alocacoes[0].locais[0], concluido: true }],
        },
      ],
    };
    vi.mocked(concluirLocal).mockResolvedValue(dadosAtualizados);
    const user = userEvent.setup();
    render(<App />);

    const checkbox = await screen.findByRole("checkbox", { name: /RA-01/ });
    await user.click(checkbox);

    await waitFor(() =>
      expect(concluirLocal).toHaveBeenCalledWith({
        equipeId: "equipe_1",
        dia: "2026-09-14",
        localId: "RA-01",
        concluido: true,
      }),
    );
    await waitFor(() => expect(screen.getByRole("checkbox", { name: /RA-01/ })).toBeChecked());
  });

  it("mostra erro quando marcar conclusão falha, sem perder a agenda", async () => {
    salvarEquipe("equipe_1");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    vi.mocked(concluirLocal).mockRejectedValue(new ApiError("Local não encontrado na alocação publicada.", 404));
    const user = userEvent.setup();
    render(<App />);

    const checkbox = await screen.findByRole("checkbox", { name: /RA-01/ });
    await user.click(checkbox);

    expect(await screen.findByText("Local não encontrado na alocação publicada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Equipe 1" })).toBeInTheDocument();
  });

  it("mostra erro genérico quando marcar conclusão falha com erro não-ApiError", async () => {
    salvarEquipe("equipe_1");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    vi.mocked(concluirLocal).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    render(<App />);

    const checkbox = await screen.findByRole("checkbox", { name: /RA-01/ });
    await user.click(checkbox);

    expect(await screen.findByText("Erro ao atualizar o local.")).toBeInTheDocument();
  });

  it("volta para o seletor de equipe ao clicar em Trocar equipe", async () => {
    salvarEquipe("equipe_1");
    vi.mocked(obterAlocacaoAtual).mockResolvedValue(DADOS);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Trocar equipe" }));

    expect(await screen.findByText("Qual é a sua equipe?")).toBeInTheDocument();
  });
});
