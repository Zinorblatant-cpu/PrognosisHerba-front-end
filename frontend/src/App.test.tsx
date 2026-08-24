import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { getPrevisoes } from "./lib/api";

vi.mock("./lib/api", async () => {
  const actual = await vi.importActual<typeof import("./lib/api")>("./lib/api");
  return { ...actual, getPrevisoes: vi.fn() };
});

describe("App", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    vi.mocked(getPrevisoes).mockResolvedValue([]);
  });

  it("renderiza a Home na rota raiz", async () => {
    render(<App />);
    expect(await screen.findByText("O que você quer fazer?")).toBeInTheDocument();
  });

  it("renderiza a rota /previsoes", async () => {
    window.history.pushState({}, "", "/previsoes");
    render(<App />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Previsões IA" })).toBeInTheDocument());
  });

  it("renderiza a rota /otimizacao", () => {
    window.history.pushState({}, "", "/otimizacao");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Otimização" })).toBeInTheDocument();
  });

  it("renderiza a rota /cronograma", () => {
    window.history.pushState({}, "", "/cronograma");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Cronograma" })).toBeInTheDocument();
  });
});
