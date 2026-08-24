import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renderiza com o estilo primary por padrão", () => {
    render(<Button>Clique</Button>);
    const button = screen.getByRole("button", { name: "Clique" });
    expect(button).toHaveClass("bg-primary");
  });

  it("renderiza com o estilo secondary quando informado", () => {
    render(<Button variant="secondary">Cancelar</Button>);
    const button = screen.getByRole("button", { name: "Cancelar" });
    expect(button).toHaveClass("border-border");
  });

  it("aplica className extra", () => {
    render(<Button className="w-full">Extra</Button>);
    expect(screen.getByRole("button", { name: "Extra" })).toHaveClass("w-full");
  });

  it("dispara onClick e respeita disabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Desabilitado
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Desabilitado" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
