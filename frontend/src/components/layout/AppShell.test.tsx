import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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

  it("abre o menu mobile ao clicar no botão e fecha ao clicar no overlay", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppShell>
          <p>conteúdo da página</p>
        </AppShell>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();

    await user.click(screen.getByTestId("sidebar-overlay"));
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
  });

  it("fecha o menu mobile ao navegar para outra rota", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppShell>
          <Routes>
            <Route path="/" element={<p>home</p>} />
            <Route path="/otimizacao" element={<p>otimizacao</p>} />
          </Routes>
        </AppShell>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByTestId("sidebar-overlay")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Otimização/ }));
    expect(screen.queryByTestId("sidebar-overlay")).not.toBeInTheDocument();
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
