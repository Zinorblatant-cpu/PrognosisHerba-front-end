import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrevisoesIA } from "./PrevisoesIA";
import { ApiError, getParametros, getPrevisoes } from "../lib/api";
import type { PrevisaoRegiao } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, getPrevisoes: vi.fn(), getParametros: vi.fn() };
});

const PREVISOES: PrevisaoRegiao[] = [
  {
    idRegiao: "Norte",
    inclinacaoGraus: 12,
    areaDeRisco: "alto",
    semanas: [
      { data: "2026-09-07", alturaPrevistaCm: 5, nivelAlerta: "baixo" },
      { data: "2026-09-14", alturaPrevistaCm: 11, nivelAlerta: "alto" },
    ],
  },
  {
    idRegiao: "Sul",
    inclinacaoGraus: 4,
    areaDeRisco: "baixo",
    semanas: [{ data: "2026-09-07", alturaPrevistaCm: 3, nivelAlerta: "baixo" }],
  },
];

describe("PrevisoesIA", () => {
  beforeEach(() => {
    vi.mocked(getPrevisoes).mockReset();
    vi.mocked(getParametros).mockReset();
    vi.mocked(getParametros).mockResolvedValue({ limiarPodaCm: 9, capacidadeDiaria: 3 });
  });

  it("mostra estado de carregamento e depois os dados da primeira região", async () => {
    vi.mocked(getPrevisoes).mockResolvedValue(PREVISOES);
    render(<PrevisoesIA />);

    expect(screen.getByText("Carregando previsões...")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Altura prevista — Norte")).toBeInTheDocument());
    expect(screen.getByText("2026-09-07")).toBeInTheDocument();
    // horizonte derivado dos dados carregados (2 semanas no fake), não cravado
    expect(
      screen.getByText("Crescimento previsto para as próximas 2 semanas, por região"),
    ).toBeInTheDocument();
  });

  it("troca de região ao clicar no botão da região", async () => {
    vi.mocked(getPrevisoes).mockResolvedValue(PREVISOES);
    const user = userEvent.setup();
    render(<PrevisoesIA />);

    await waitFor(() => expect(screen.getByText("Altura prevista — Norte")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Sul" }));

    expect(screen.getByText("Altura prevista — Sul")).toBeInTheDocument();
  });

  it("mostra mensagem de erro vinda de ApiError", async () => {
    vi.mocked(getPrevisoes).mockRejectedValue(new ApiError("Backend fora do ar.", 0));
    render(<PrevisoesIA />);

    await waitFor(() => expect(screen.getByText("Backend fora do ar.")).toBeInTheDocument());
    expect(screen.getByText("Crescimento previsto por região, semana a semana")).toBeInTheDocument();
  });

  it("mostra mensagem de erro genérica para erros não-ApiError", async () => {
    vi.mocked(getPrevisoes).mockRejectedValue(new Error("boom"));
    render(<PrevisoesIA />);

    await waitFor(() => expect(screen.getByText("Erro ao carregar previsões.")).toBeInTheDocument());
  });

  it("cai no limiar padrão quando GET /parametros falha", async () => {
    vi.mocked(getParametros).mockRejectedValue(new ApiError("sem parâmetros", 500));
    vi.mocked(getPrevisoes).mockResolvedValue(PREVISOES);
    render(<PrevisoesIA />);

    // A página continua de pé: o limiar é só a linha de referência do gráfico.
    await waitFor(() => expect(screen.getByText("Altura prevista — Norte")).toBeInTheDocument());
  });

  it("mostra estado vazio quando o backend não devolve nenhuma região", async () => {
    vi.mocked(getPrevisoes).mockResolvedValue([]);
    render(<PrevisoesIA />);

    await waitFor(() => expect(screen.queryByText("Carregando previsões...")).not.toBeInTheDocument());
    expect(screen.queryByText(/Altura prevista/)).not.toBeInTheDocument();
    expect(screen.getByText(/O backend não devolveu nenhuma região/)).toBeInTheDocument();
    expect(screen.getByText("Crescimento previsto por região, semana a semana")).toBeInTheDocument();
  });
});
