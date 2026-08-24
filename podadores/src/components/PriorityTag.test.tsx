import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriorityTag } from "./PriorityTag";

describe("PriorityTag", () => {
  it.each(["alta", "media", "baixa"] as const)("renderiza o estilo para prioridade %s", (prioridade) => {
    render(<PriorityTag prioridade={prioridade} />);
    expect(screen.getByText(prioridade)).toBeInTheDocument();
  });

  it("aplica o estilo de fallback para uma prioridade desconhecida", () => {
    render(<PriorityTag prioridade="desconhecida" />);
    const tag = screen.getByText("desconhecida");
    expect(tag).toHaveClass("bg-fg-muted/10");
  });
});
