import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { AppShell, PageHeader } from "./AppShell";

function BotaoNavegar() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/otimizacao")}>ir para otimização</button>;
}

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

  it("a tecla Esc fecha a gaveta", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const aside = screen.getByText("Início").closest("aside")!;
    expect(aside).toHaveClass("translate-x-0");

    await user.keyboard("{Escape}");
    expect(aside).toHaveClass("-translate-x-full");
  });

  it("outras teclas não fecham a gaveta", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo</p>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const aside = screen.getByText("Início").closest("aside")!;

    await user.keyboard("{Enter}");
    expect(aside).toHaveClass("translate-x-0");
  });

  it("fecha a gaveta ao navegar programaticamente (fora de um link dela)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <Routes>
            <Route path="/" element={<BotaoNavegar />} />
            <Route path="/otimizacao" element={<p>otimizacao</p>} />
          </Routes>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    const aside = screen.getByText("Início").closest("aside")!;
    expect(aside).toHaveClass("translate-x-0");

    await user.click(screen.getByRole("button", { name: "ir para otimização" }));
    expect(aside).toHaveClass("-translate-x-full");
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
