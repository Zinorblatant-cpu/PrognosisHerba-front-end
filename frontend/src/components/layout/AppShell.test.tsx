import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("a gaveta começa fechada e o botão de menu a abre", async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    const aside = screen.getByText("Início").closest("aside")!;
    expect(aside).toHaveClass("-translate-x-full");

    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(aside).toHaveClass("translate-x-0");
  });

  it("navegar pela gaveta a fecha", async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await userEvent.click(screen.getByRole("link", { name: /Cronograma/ }));
    expect(screen.getByText("Início").closest("aside")).toHaveClass("-translate-x-full");
  });

  it("o botão de fechar recolhe a gaveta", async () => {
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.getByText("Início").closest("aside")).toHaveClass("-translate-x-full");
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
