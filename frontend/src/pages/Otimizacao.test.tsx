import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Otimizacao } from "./Otimizacao";
import { AlocacaoProvider } from "../state/AlocacaoContext";
import { ApiError, gerarAlocacaoDePrevisoes } from "../lib/api";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, gerarAlocacaoDePrevisoes: vi.fn() };
});

const RESULTADO: GerarAlocacaoDePrevisoesResponse = {
  mesReferencia: { ano: 2026, mes: 9 },
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
    mensagem: "Capacidade insuficiente para o mês.",
  },
  foraDoMes: [{ id: "B1", prioridade: "media", dificuldade: "facil", dataAlvo: "2026-10-01", alturaPrevistaCm: 9 }],
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

  it("revela campos de ano/mês ao desmarcar detecção automática", async () => {
    const user = userEvent.setup();
    renderOtimizacao();

    expect(screen.queryByLabelText("Ano")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/Detectar mês automaticamente/));

    const ano = screen.getByLabelText("Ano") as HTMLInputElement;
    const mes = screen.getByLabelText("Mês") as HTMLInputElement;
    expect(ano).toBeInTheDocument();

    await user.clear(ano);
    await user.type(ano, "2027");
    await user.clear(mes);
    await user.type(mes, "3");

    expect(ano).toHaveValue(2027);
    expect(mes).toHaveValue(3);
  });

  it("gera alocação com sucesso e mostra tabela, alerta e seções extras", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));

    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());
    expect(screen.getByText("Capacidade insuficiente para o mês.")).toBeInTheDocument();
    expect(screen.getByText(/Fora do mês selecionado/)).toBeInTheDocument();
    expect(screen.getByText(/Sem necessidade de poda nas próximas 12 semanas/)).toBeInTheDocument();
    expect(gerarAlocacaoDePrevisoes).toHaveBeenCalledWith({
      quantidadeEquipes: 4,
      capacidadeDiaria: 3,
      ano: undefined,
      mes: undefined,
    });
  });

  it("envia ano/mês quando detecção automática está desligada", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByLabelText(/Detectar mês automaticamente/));
    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));

    await waitFor(() =>
      expect(gerarAlocacaoDePrevisoes).toHaveBeenCalledWith({
        quantidadeEquipes: 4,
        capacidadeDiaria: 3,
        ano: 2026,
        mes: 9,
      }),
    );
  });

  it("mostra só a seção 'fora do mês' quando não há regiões sem alerta no horizonte", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue({ ...RESULTADO, semAlertaNoHorizonte: [] });
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));

    await waitFor(() => expect(screen.getByText(/Fora do mês selecionado/)).toBeInTheDocument());
    expect(screen.queryByText(/Sem necessidade de poda/)).not.toBeInTheDocument();
  });

  it("mostra só a seção 'sem alerta' quando não há locais fora do mês", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue({ ...RESULTADO, foraDoMes: [] });
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));

    await waitFor(() => expect(screen.getByText(/Sem necessidade de poda/)).toBeInTheDocument());
    expect(screen.queryByText(/Fora do mês selecionado/)).not.toBeInTheDocument();
  });

  it("não mostra seções extras quando não há locais fora do mês nem regiões sem alerta", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue({ ...RESULTADO, foraDoMes: [], semAlertaNoHorizonte: [] });
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));

    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());
    expect(screen.queryByText(/Fora do mês selecionado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem necessidade de poda/)).not.toBeInTheDocument();
  });

  it("navega para o cronograma ao clicar em Ver cronograma gerado", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockResolvedValue(RESULTADO);
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));
    await waitFor(() => expect(screen.getByText("A1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Ver cronograma gerado/ }));
    expect(screen.getByText("página de cronograma")).toBeInTheDocument();
  });

  it("mostra mensagem de erro vinda de ApiError", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockRejectedValue(new ApiError("Sem solução viável.", 422));
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));
    await waitFor(() => expect(screen.getByText("Sem solução viável.")).toBeInTheDocument());
  });

  it("mostra mensagem de erro genérica para erros não-ApiError", async () => {
    vi.mocked(gerarAlocacaoDePrevisoes).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderOtimizacao();

    await user.click(screen.getByRole("button", { name: /Gerar alocação/ }));
    await waitFor(() => expect(screen.getByText("Erro ao gerar alocação.")).toBeInTheDocument());
  });
});
