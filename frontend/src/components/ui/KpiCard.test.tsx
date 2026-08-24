import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "./KpiCard";

describe("KpiCard", () => {
  it("renderiza label e valor", () => {
    render(<KpiCard label="Locais" value="12" />);
    expect(screen.getByText("Locais")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renderiza delta, deltaLabel e ícone quando informados", () => {
    render(
      <KpiCard
        label="Equipes"
        value="4"
        delta="+2"
        deltaLabel="vs. mês anterior"
        icon={<span data-testid="icon">*</span>}
      />,
    );
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.getByText("vs. mês anterior")).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("não renderiza delta nem ícone quando ausentes", () => {
    render(<KpiCard label="Dias" value="20" />);
    expect(screen.queryByText("▲")).not.toBeInTheDocument();
  });
});
