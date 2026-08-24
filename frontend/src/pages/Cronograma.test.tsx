import { describe, expect, it } from "vitest";
import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Cronograma } from "./Cronograma";
import { AlocacaoProvider, useAlocacao } from "../state/AlocacaoContext";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

const RESULTADO: GerarAlocacaoDePrevisoesResponse = {
  periodo: { inicio: "2026-09-08", fim: "2026-09-20" },
  locaisDerivados: [
    { id: "A1", prioridade: "alta", dificuldade: "media", dataAlvo: "2026-09-10", alturaPrevistaCm: 11 },
    { id: "A2", prioridade: "media", dificuldade: "facil", dataAlvo: "2026-09-08", alturaPrevistaCm: 12 },
    { id: "A3", prioridade: "baixa", dificuldade: "dificil", dataAlvo: "2026-09-15", alturaPrevistaCm: 9 },
    { id: "A5", prioridade: "alta", dificuldade: "facil", dataAlvo: "2026-09-11", alturaPrevistaCm: 10 },
    { id: "A6", prioridade: "media", dificuldade: "media", dataAlvo: "2026-09-09", alturaPrevistaCm: 10 },
    { id: "C1", prioridade: "alta", dificuldade: "media", dataAlvo: "2026-09-20", alturaPrevistaCm: 10.5 },
  ],
  alocacoes: [
    {
      equipeId: "equipe_1",
      dia: "2026-09-10",
      locais: [
        { localId: "A1", prioridade: "alta", dificuldade: "media" },
        { localId: "A2", prioridade: "media", dificuldade: "facil" },
        { localId: "A3", prioridade: "baixa", dificuldade: "dificil" },
        { localId: "A4", prioridade: "outra", dificuldade: "media" },
        { localId: "A5", prioridade: "alta", dificuldade: "facil" },
        { localId: "A6", prioridade: "media", dificuldade: "media" },
      ],
    },
    { equipeId: "equipe_2", dia: "2026-09-10", locais: [] },
    { equipeId: "equipe_2", dia: "2026-09-11", locais: [] },
  ],
  naoAlocados: [
    { localId: "C1", prioridade: "alta", dificuldade: "media" },
    { localId: "C2", prioridade: "baixa", dificuldade: "facil" },
  ],
  alerta: null,
  semAlertaNoHorizonte: [],
};

function renderCronograma(resultado: GerarAlocacaoDePrevisoesResponse | null) {
  function Semear() {
    const { setResultado } = useAlocacao();
    useEffect(() => {
      if (resultado) setResultado(resultado);
    }, [setResultado]);
    return null;
  }

  return render(
    <MemoryRouter initialEntries={["/cronograma"]}>
      <AlocacaoProvider>
        <Routes>
          <Route
            path="/cronograma"
            element={
              <>
                <Semear />
                <Cronograma />
              </>
            }
          />
          <Route path="/otimizacao" element={<p>página de otimização</p>} />
        </Routes>
      </AlocacaoProvider>
    </MemoryRouter>,
  );
}

describe("Cronograma", () => {
  it("mostra estado vazio e navega para Otimização", async () => {
    const user = userEvent.setup();
    renderCronograma(null);

    expect(screen.getByText(/Nenhuma alocação foi gerada ainda/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ir para Otimização" }));
    expect(screen.getByText("página de otimização")).toBeInTheDocument();
  });

  it("renderiza a grade com equipes, dias, folgas e não alocados", () => {
    renderCronograma(RESULTADO);

    expect(screen.getByText("Equipe 1")).toBeInTheDocument();
    expect(screen.getByText("Equipe 2")).toBeInTheDocument();

    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText(/no limite/)).toBeInTheDocument();

    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(screen.getByText(/dias atrasado/)).toBeInTheDocument();

    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(screen.getByText(/dias de folga/)).toBeInTheDocument();

    expect(screen.getByText("A4")).toBeInTheDocument();

    expect(screen.getByText("A5")).toBeInTheDocument();
    expect(screen.getByText(/1 dia de folga/)).toBeInTheDocument();

    expect(screen.getByText("A6")).toBeInTheDocument();
    expect(screen.getByText(/1 dia atrasado/)).toBeInTheDocument();

    expect(screen.getAllByText("—").length).toBeGreaterThan(0);

    expect(screen.getByText("Não alocados")).toBeInTheDocument();
    expect(screen.getByText("C1")).toBeInTheDocument();
    expect(screen.getByText(/poda até/)).toBeInTheDocument();
    expect(screen.getByText("C2")).toBeInTheDocument();
  });

  it("mostra mensagem de todos alocados quando não há pendências", () => {
    renderCronograma({ ...RESULTADO, naoAlocados: [] });
    expect(screen.getByText(/Todos os locais derivados da previsão foram alocados/)).toBeInTheDocument();
  });

  it("singular de local/equipe/dia quando há apenas um de cada", () => {
    const resultadoSingular: GerarAlocacaoDePrevisoesResponse = {
      ...RESULTADO,
      locaisDerivados: [RESULTADO.locaisDerivados[0]],
      alocacoes: [
        {
          equipeId: "equipe_1",
          dia: "2026-09-10",
          locais: [{ localId: "A1", prioridade: "alta", dificuldade: "media" }],
        },
      ],
      naoAlocados: [],
    };
    renderCronograma(resultadoSingular);
    expect(screen.getByText(/1 local · 1 equipe · 1 dia útil/)).toBeInTheDocument();
  });
});
