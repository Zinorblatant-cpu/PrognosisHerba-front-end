import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sprout } from "lucide-react";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "./Estado";

describe("Estado", () => {
  it("EstadoCarregando mostra a mensagem", () => {
    render(<EstadoCarregando mensagem="Carregando previsões..." />);
    expect(screen.getByText("Carregando previsões...")).toBeInTheDocument();
  });

  it("EstadoErro mostra a mensagem e aceita className extra", () => {
    const { container } = render(<EstadoErro mensagem="Backend fora do ar." className="mb-4" />);
    expect(screen.getByText("Backend fora do ar.")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("mb-4");
  });

  it("EstadoVazio usa o ícone padrão quando nenhum é informado", () => {
    render(<EstadoVazio mensagem="Nada por aqui." />);
    expect(screen.getByText("Nada por aqui.")).toBeInTheDocument();
  });

  it("EstadoVazio aceita ícone e ação customizados", () => {
    render(
      <EstadoVazio
        mensagem="Nada por aqui."
        icon={<Sprout size={22} />}
        acao={<button type="button">Gerar</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Gerar" })).toBeInTheDocument();
  });
});
