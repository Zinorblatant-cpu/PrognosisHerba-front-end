import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Home } from "./Home";
import { AlocacaoProvider, useAlocacao } from "../state/AlocacaoContext";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

const RESULTADO_FAKE = {
  periodo: { inicio: "2026-09-14", fim: "2026-09-15" },
  locaisDerivados: [],
  alocacoes: [
    { equipeId: "equipe_1", dia: "2026-09-14", locais: [{ localId: "A1", prioridade: "alta", dificuldade: "media" }] },
    { equipeId: "equipe_1", dia: "2026-09-15", locais: [{ localId: "A2", prioridade: "media", dificuldade: "facil" }] },
    { equipeId: "equipe_2", dia: "2026-09-14", locais: [{ localId: "A3", prioridade: "baixa", dificuldade: "facil" }] },
    { equipeId: "equipe_3", dia: "2026-09-15", locais: [{ localId: "A4", prioridade: "alta", dificuldade: "dificil" }] },
  ],
  naoAlocados: [{ localId: "B1", prioridade: "baixa", dificuldade: "dificil" }],
  alerta: null,
  semAlertaNoHorizonte: [],
} satisfies GerarAlocacaoDePrevisoesResponse;

describe("Home", () => {
  it("renderiza os quatro cards de navegação", () => {
    render(
      <MemoryRouter>
        <AlocacaoProvider>
          <Home />
        </AlocacaoProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Previsões IA" }).closest("a")).toHaveAttribute(
      "href",
      "/previsoes",
    );
    expect(screen.getByRole("heading", { name: "Otimização" }).closest("a")).toHaveAttribute(
      "href",
      "/otimizacao",
    );
    expect(screen.getByRole("heading", { name: "Cronograma" }).closest("a")).toHaveAttribute(
      "href",
      "/cronograma",
    );
    expect(screen.getByRole("heading", { name: "Monitoramento" }).closest("a")).toHaveAttribute(
      "href",
      "/monitoramento",
    );
  });

  it("mostra estado vazio de status quando nenhuma alocação foi gerada", () => {
    render(
      <MemoryRouter>
        <AlocacaoProvider>
          <Home />
        </AlocacaoProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Nenhuma alocação foi gerada nesta sessão ainda/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir para Otimização" })).toHaveAttribute("href", "/otimizacao");
  });

  it("mostra os KPIs quando há uma alocação gerada no contexto", async () => {
    const user = userEvent.setup();

    function Gerador() {
      const { setResultado } = useAlocacao();
      return <button onClick={() => setResultado(RESULTADO_FAKE)}>gerar</button>;
    }

    render(
      <MemoryRouter>
        <AlocacaoProvider>
          <Gerador />
          <Home />
        </AlocacaoProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "gerar" }));

    expect(screen.getByText("Período: 2026-09-14 a 2026-09-15")).toBeInTheDocument();
    expect(screen.getByText("Locais alocados")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Equipes em campo")).toBeInTheDocument();
    expect(screen.getByText("Dias úteis")).toBeInTheDocument();
    expect(screen.getByText("Não alocados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver cronograma completo →" })).toHaveAttribute("href", "/cronograma");
  });

  it("navega para /otimizacao ao clicar em Ir para Otimização", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AlocacaoProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/otimizacao" element={<p>página de otimização</p>} />
          </Routes>
        </AlocacaoProvider>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Ir para Otimização" }));
    expect(screen.getByText("página de otimização")).toBeInTheDocument();
  });
});
