import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.getByRole("link", { name: /Agrupamento/ })).toHaveAttribute("href", "/agrupamento");
    expect(screen.getByRole("link", { name: /Monitoramento/ })).toHaveAttribute("href", "/monitoramento");
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

  it("começa fechada (fora da tela) quando aberta não é informado", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    expect(screen.getByText("Herba").closest("aside")).toHaveClass("-translate-x-full");
  });

  it("permite clicar em um item de navegação sem passar aoNavegar", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("link", { name: /Cronograma/ }));
    expect(screen.getByRole("link", { name: /Cronograma/ })).toBeInTheDocument();
  });

  it("chama aoNavegar ao clicar no botão de fechar", async () => {
    const user = userEvent.setup();
    const aoNavegar = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar aberta aoNavegar={aoNavegar} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(aoNavegar).toHaveBeenCalled();
  });

  it("chama aoNavegar ao clicar em um item de navegação", async () => {
    const user = userEvent.setup();
    const aoNavegar = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar aberta aoNavegar={aoNavegar} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: /Cronograma/ }));
    expect(aoNavegar).toHaveBeenCalled();
  });
});
