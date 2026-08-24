import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tag, StatusTag } from "./Tag";

describe("Tag", () => {
  it("renderiza o nível como label quando label não é informado", () => {
    render(<Tag nivel="alta" />);
    expect(screen.getByText("alta")).toBeInTheDocument();
  });

  it("renderiza label customizado quando informado", () => {
    render(<Tag nivel="alta" label="Prioridade alta" />);
    expect(screen.getByText("Prioridade alta")).toBeInTheDocument();
  });

  it("aplica estilo de fallback (Informativo) para nível desconhecido", () => {
    render(<Tag nivel="desconhecido" />);
    const tag = screen.getByText("desconhecido");
    expect(tag).toHaveClass("bg-fg-muted/10");
  });

  it.each(["Alto", "alto", "alta", "Médio", "medio", "media", "Baixo", "baixo", "baixa", "Informativo"] as const)(
    "renderiza o nível %s sem quebrar",
    (nivel) => {
      render(<Tag nivel={nivel} />);
      expect(screen.getAllByText(nivel).length).toBeGreaterThan(0);
    },
  );
});

describe("StatusTag", () => {
  it("renderiza estilo de sucesso para Programado", () => {
    render(<StatusTag status="Programado" />);
    const tag = screen.getByText("Programado");
    expect(tag).toHaveClass("bg-success/10");
  });

  it("renderiza estilo de aviso para Pendente", () => {
    render(<StatusTag status="Pendente" />);
    const tag = screen.getByText("Pendente");
    expect(tag).toHaveClass("bg-warning/10");
  });
});
