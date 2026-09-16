import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Calendario } from "./Calendario";
import type { MesCalendario } from "../../lib/calendario";

const MESES: MesCalendario[] = [
  {
    label: "Setembro 2026",
    semanas: [
      [
        null,
        null,
        { iso: "2026-09-01", totalLocais: 0 },
        { iso: "2026-09-02", totalLocais: 3 },
        null,
        null,
        null,
      ],
    ],
  },
];

describe("Calendario", () => {
  it("mostra o rótulo do mês", () => {
    render(<Calendario meses={MESES} />);
    expect(screen.getByText("Setembro 2026")).toBeInTheDocument();
  });

  it("destaca em vermelho o dia com locais de poda e mostra a quantidade", () => {
    render(<Calendario meses={MESES} />);
    const diaComPoda = screen.getByText("2").closest("div");
    expect(diaComPoda).toHaveClass("border-danger/40");
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("não destaca o dia sem locais de poda", () => {
    render(<Calendario meses={MESES} />);
    const diaSemPoda = screen.getByText("1").closest("div");
    expect(diaSemPoda).not.toHaveClass("border-danger/40");
  });
});
