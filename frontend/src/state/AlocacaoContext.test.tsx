import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlocacaoProvider, useAlocacao } from "./AlocacaoContext";
import type { GerarAlocacaoDePrevisoesResponse } from "../lib/types";

const RESULTADO_FAKE = {
  mesReferencia: { ano: 2026, mes: 9 },
  locaisDerivados: [],
  alocacoes: [],
  naoAlocados: [],
  alerta: null,
  foraDoMes: [],
  semAlertaNoHorizonte: [],
} satisfies GerarAlocacaoDePrevisoesResponse;

function Consumidor() {
  const { resultado, setResultado } = useAlocacao();
  return (
    <div>
      <p>{resultado ? `mes:${resultado.mesReferencia.mes}` : "sem resultado"}</p>
      <button onClick={() => setResultado(RESULTADO_FAKE)}>gerar</button>
    </div>
  );
}

describe("AlocacaoContext", () => {
  it("começa sem resultado e atualiza após setResultado", async () => {
    const user = userEvent.setup();
    render(
      <AlocacaoProvider>
        <Consumidor />
      </AlocacaoProvider>,
    );

    expect(screen.getByText("sem resultado")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "gerar" }));

    expect(screen.getByText("mes:9")).toBeInTheDocument();
  });

  it("lança erro ao usar useAlocacao fora do provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumidor />)).toThrow("useAlocacao deve ser usado dentro de AlocacaoProvider");
    errorSpy.mockRestore();
  });
});
