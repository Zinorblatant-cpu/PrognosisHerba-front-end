import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell, PageHeader } from "./AppShell";

describe("AppShell", () => {
  it("renderiza a sidebar e os filhos", () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("conteúdo da página")).toBeInTheDocument();
    expect(screen.getByText("Início")).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renderiza título, subtítulo e ação", () => {
    render(<PageHeader title="Título" subtitle="Subtítulo" action={<button>Ação</button>} />);
    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("Subtítulo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ação" })).toBeInTheDocument();
  });

  it("renderiza sem subtítulo nem ação", () => {
    render(<PageHeader title="Só título" />);
    expect(screen.getByText("Só título")).toBeInTheDocument();
  });
});
