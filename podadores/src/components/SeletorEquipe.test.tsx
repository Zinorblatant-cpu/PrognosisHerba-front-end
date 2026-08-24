import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeletorEquipe } from "./SeletorEquipe";

describe("SeletorEquipe", () => {
  it("renderiza um botão por equipe, com nome formatado", () => {
    render(<SeletorEquipe equipes={["equipe_1", "equipe_2"]} onSelecionar={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Equipe 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equipe 2" })).toBeInTheDocument();
  });

  it("chama onSelecionar com o id da equipe clicada", async () => {
    const user = userEvent.setup();
    const onSelecionar = vi.fn();
    render(<SeletorEquipe equipes={["equipe_1", "equipe_2"]} onSelecionar={onSelecionar} />);

    await user.click(screen.getByRole("button", { name: "Equipe 2" }));

    expect(onSelecionar).toHaveBeenCalledWith("equipe_2");
  });

  it("renderiza sem equipes sem quebrar", () => {
    render(<SeletorEquipe equipes={[]} onSelecionar={vi.fn()} />);
    expect(screen.getByText("Qual é a sua equipe?")).toBeInTheDocument();
  });
});
