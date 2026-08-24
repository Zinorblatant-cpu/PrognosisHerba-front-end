import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("renderiza a marca e todos os itens de navegação", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Herba")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Início/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /Previsões IA/ })).toHaveAttribute("href", "/previsoes");
    expect(screen.getByRole("link", { name: /Otimização/ })).toHaveAttribute("href", "/otimizacao");
    expect(screen.getByRole("link", { name: /Cronograma/ })).toHaveAttribute("href", "/cronograma");
  });

  it("marca o item ativo com base na rota atual", () => {
    render(
      <MemoryRouter initialEntries={["/otimizacao"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /Otimização/ })).toHaveClass("text-primary");
    expect(screen.getByRole("link", { name: /Início/ })).not.toHaveClass("text-primary");
  });
});
