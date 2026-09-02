import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Otimizacao } from "./Otimizacao";
import { AlocacaoProvider } from "../state/AlocacaoContext";
import { ApiError, gerarAlocacaoDePrevisoes, publicarAlocacao } from "../lib/api";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, gerarAlocacaoDePrevisoes: vi.fn(), publicarAlocacao: vi.fn() };
});

const RESULTADO: GerarAlocacaoDePrevisoesResponse = {
  periodo: { inicio: "2026-09-14", fim: "2026-11-02" },
  locaisDerivados: [
    { id: "A1", prioridade: "alta", dificuldade: "media", dataAlvo: "2026-09-14", alturaPrevistaCm: 11 },
  ],
  alocacoes: [{ equipeId: "equipe_1", dia: "2026-09-14", locais: [{ localId: "A1", prioridade: "alta", dificuldade: "media" }] }],
  naoAlocados: [],
  alerta: {
    capacidadeTotalMes: 10,
    demandaTotal: 12,
    deficit: 2,
    equipesDiaAdicionais: 1,
    equipesExtrasSugeridas: 1,
    mensagem: "Capacidade insuficiente para o período.",
  },
  semAlertaNoHorizonte: ["Sul"],
};

function renderOtimizacao() {
  return render(
    <MemoryRouter initialEntries={["/otimizacao"]}>
      <AlocacaoProvider>
        <Routes>
          <Route path="/otimizacao" element={<Otimizacao />} />
          <Route path="/cronograma" element={<p>página de cronograma</p>} />
        </Routes>
      </AlocacaoProvider>
    </MemoryRouter>,
  );
}

describe("Otimizacao", () => {
  beforeEach(() => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockReset();
    vi.mocked(publicarAlocacao).mockReset();
    vi.mocked(publicarAlocacao).mockResolvedValue(undefined);
  });

  it("mostra estado inicial sem alocação", () => {
    renderOtimizacao();
    expect(screen.getByText("Nenhuma alocação gerada ainda.")).toBeInTheDocument();
  });

  it("permite editar quantidade de equipes e capacidade diária", async () => {
    const user = userEvent.setup();
    renderOtimizacao();

    const quantidade = screen.getByLabelText(/Quantidade de equipes/) as HTMLInputElement;
    await user.clear(quantidade);
    await user.type(quantidade, "6");
    expect(quantidade).toHaveValue(6);

    const capacidade = screen.getByLabelText(/Capacidade diária/) as HTMLInputElement;
    await user.clear(capacidade);
    await user.type(capacidade, "2");
    expect(capacidade).toHaveValue(2);
  });

  it("gera o cronograma completo com sucesso e mostra tabela, alerta e locais sem alerta", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));

    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());
    expect(screen.getByText("Capacidade insuficiente para o período.")).toBeInTheDocument();
    expect(screen.getByText(/Sem necessidade de poda no horizonte de previsão/)).toBeInTheDocument();
    expect(screen.getByText("Período: 2026-09-14 a 2026-11-02")).toBeInTheDocument();
    expect(gerarAlocacaoDePrevisoes).toHaveBeenCalledWith({ quantidadeEquipes: 4, capacidadeDiaria: 3 });

    await waitFor(() =>
      expect(publicarAlocacao).toHaveBeenCalledWith({
        periodo: RESULTADO.periodo,
        alocacoes: RESULTADO.alocacoes,
        naoAlocados: RESULTADO.naoAlocados,
      }),
    );
    expect(await screen.findByText(/Publicado para o site dos podadores/)).toBeInTheDocument();
  });

  it("continua funcionando mesmo se a publicação para os podadores falhar", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    vi.mocked(publicarAlocacao).mockRejectedValue(new Error("falha ao publicar"));
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));

    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());
    expect(screen.queryByText(/Publicado para o site dos podadores/)).not.toBeInTheDocument();
  });

  it("não mostra a seção de locais sem alerta quando não há nenhum", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue({ ...RESULTADO, semAlertaNoHorizonte: [] });
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));

    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());
    expect(screen.queryByText(/Sem necessidade de poda/)).not.toBeInTheDocument();
  });

  it("navega para o cronograma ao clicar em Ver cronograma gerado", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));
    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Ver cronograma gerado/ }));
    expect(screen.getByText("página de cronograma")).toBeInTheDocument();
  });

  it("mostra mensagem de erro vinda de ApiError", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockRejectedValue(new ApiError("Sem solução viável.", 422));
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));
    await waitFor(() => expect(screen.getByText("Sem solução viável.")).toBeInTheDocument());
  });

  it("mostra mensagem de erro genérica para erros não-ApiError", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar cronograma completo/ }));
    await waitFor(() => expect(screen.getByText("Erro ao gerar alocação.")).toBeInTheDocument());
  });
});
