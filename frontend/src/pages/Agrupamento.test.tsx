import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Agrupamento } from "./Agrupamento";
import { ApiError, getClusterizacao } from "../lib/api";
import type { Clusterizacao as AgrupamentoDados } from "../lib/types";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, getClusterizacao: vi.fn() };
});

const DADOS: AgrupamentoDados = {
  avisoRota: "Dados de rota simulados — pendente integração.",
  clusters: [
    {
      clusterId: 0,
      rotulo: "crítico",
      regioes: ["RA-02"],
      rotas: ["SP-330 · km 0–40"],
      alturaMediaCm: 8.12,
      tendenciaMediaCmPorSemana: 0.797,
    },
    {
      clusterId: 1,
      rotulo: "atenção",
      regioes: ["RA-01", "RA-03"],
      rotas: ["SP-330 · km 0–40", "SP-348 · km 40–90"],
      alturaMediaCm: 6.11,
      tendenciaMediaCmPorSemana: -0.5,
    },
  ],
  regioes: [
    {
      idRegiao: "RA-01",
      rota: "SP-330 · km 0–40",
      rotaSimulada: true,
      alturaAtualCm: 4.29,
      tendenciaCmPorSemana: 0.991,
      semanasDesdeUltimaPoda: 1,
      clusterId: 1,
    },
    {
      idRegiao: "RA-02",
      rota: "SP-330 · km 0–40",
      rotaSimulada: false,
      alturaAtualCm: 8.12,
      tendenciaCmPorSemana: 0.797,
      semanasDesdeUltimaPoda: 5,
      clusterId: 0,
    },
  ],
};

describe("Agrupamento", () => {
  beforeEach(() => {
    vi.mocked(getClusterizacao).mockReset();
  });

  it("mostra o carregamento e depois os grupos e a tabela de indicadores", async () => {
    vi.mocked(getClusterizacao).mockResolvedValue(DADOS);
    render(<Agrupamento />);

    expect(screen.getByText("Carregando agrupamento...")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Grupo 1" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Grupo 2" })).toBeInTheDocument();
    // e a coluna "Grupo" da tabela referencia os mesmos grupos
    expect(screen.getAllByText("Grupo 1")).toHaveLength(2);
    expect(screen.getByText("crítico")).toBeInTheDocument();
    expect(screen.getByText("atenção")).toBeInTheDocument();

    // clusterId é 0-based no backend e 1-based na tela
    expect(screen.getByText("1 região")).toBeInTheDocument();
    expect(screen.getByText("2 regiões")).toBeInTheDocument();

    // RA-02 é sozinha no grupo 1, então a média do card e a linha da tabela
    // mostram o mesmo número — daí os dois nós.
    expect(screen.getAllByText("8.12 cm")).toHaveLength(2);
    expect(screen.getAllByText("+0.80 cm/sem")).toHaveLength(2);
    // tendência negativa sai com o sinal, sem "+"
    expect(screen.getByText("-0.50 cm/sem")).toBeInTheDocument();

    expect(screen.getAllByText("RA-01").length).toBeGreaterThan(0);
    expect(screen.getByText("1 semana")).toBeInTheDocument();
    expect(screen.getByText("5 semanas")).toBeInTheDocument();
  });

  it("avisa que os dados de rota são simulados", async () => {
    vi.mocked(getClusterizacao).mockResolvedValue(DADOS);
    render(<Agrupamento />);

    await waitFor(() => expect(screen.getByText(/Dados de rota simulados/)).toBeInTheDocument());
    // só a região com rotaSimulada leva o selo na tabela
    expect(screen.getAllByText("simulada")).toHaveLength(1);
  });

  it("usa o estilo informativo para rótulos de cluster desconhecidos", async () => {
    vi.mocked(getClusterizacao).mockResolvedValue({
      ...DADOS,
      clusters: [{ ...DADOS.clusters[0], rotulo: "rótulo novo" }],
    });
    render(<Agrupamento />);

    await waitFor(() => expect(screen.getByText("rótulo novo")).toBeInTheDocument());
  });

  it("mostra estado vazio quando não há grupos", async () => {
    vi.mocked(getClusterizacao).mockResolvedValue({ ...DADOS, clusters: [], regioes: [] });
    render(<Agrupamento />);

    await waitFor(() =>
      expect(screen.getByText(/Não há regiões suficientes/)).toBeInTheDocument(),
    );
  });

  it("mostra a mensagem de erro vinda de ApiError", async () => {
    vi.mocked(getClusterizacao).mockRejectedValue(new ApiError("Backend fora do ar.", 0));
    render(<Agrupamento />);

    await waitFor(() => expect(screen.getByText("Backend fora do ar.")).toBeInTheDocument());
  });

  it("mostra mensagem genérica para erros que não são ApiError", async () => {
    vi.mocked(getClusterizacao).mockRejectedValue(new Error("boom"));
    render(<Agrupamento />);

    await waitFor(() =>
      expect(screen.getByText("Erro ao carregar o agrupamento.")).toBeInTheDocument(),
    );
  });
});
