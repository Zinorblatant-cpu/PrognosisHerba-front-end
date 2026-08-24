import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardHeader } from "./Card";

describe("Card", () => {
  it("renderiza os filhos e aplica className extra", () => {
    render(<Card className="extra-class">conteúdo</Card>);
    const card = screen.getByText("conteúdo");
    expect(card).toHaveClass("extra-class");
    expect(card).toHaveClass("rounded-2xl");
  });

  it("funciona sem className", () => {
    render(<Card>sem classe</Card>);
    expect(screen.getByText("sem classe")).toBeInTheDocument();
  });
});

describe("CardHeader", () => {
  it("renderiza título, subtítulo e ação", () => {
    render(<CardHeader title="Título" subtitle="Subtítulo" action={<button>Ação</button>} />);
    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("Subtítulo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument();
  });

  it("renderiza sem subtítulo nem ação", () => {
    render(<CardHeader title="Só título" />);
    expect(screen.getByText("Só título")).toBeInTheDocument();
  });
});
