import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Equipe } from "./Equipe";

function renderizar() {
  render(
    <MemoryRouter>
      <Equipe />
    </MemoryRouter>,
  );
}

describe("Equipe", () => {
  it("renderiza um card para cada um dos sete integrantes", () => {
    renderizar();
    expect(screen.getAllByRole("article")).toHaveLength(7);
    expect(screen.getByText(/7 estudantes da FIAP/)).toBeInTheDocument();
    for (const nome of [
      "Arthur Souza",
      "Carlos Eduardo Pires Cervelli",
      "Felipe Krzyzanovski dos Santos Menezes",
      "Guilherme Carreri",
      "Leonardo Lopes Oliveira",
      "Lucas Ferrari Lima",
      "Mateus Patricio Pereira",
    ]) {
      expect(screen.getByRole("heading", { name: nome })).toBeInTheDocument();
      expect(screen.getByRole("img", { name: `Foto de ${nome}` })).toBeInTheDocument();
    }
  });

  it("aponta o botão de LinkedIn de cada integrante para o perfil, abrindo em nova aba", () => {
    renderizar();
    const linkedin = screen.getByRole("link", { name: "LinkedIn de Lucas Ferrari Lima" });
    expect(linkedin).toHaveAttribute("href", "https://www.linkedin.com/in/lucas-ferrari-lima");
    expect(linkedin).toHaveAttribute("target", "_blank");
    expect(linkedin).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getAllByRole("link", { name: /^LinkedIn de / })).toHaveLength(7);
  });

  it("mostra GitHub e destaques só para quem os tem", () => {
    renderizar();
    expect(screen.getAllByRole("link", { name: /^GitHub de / })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "GitHub de Felipe Krzyzanovski dos Santos Menezes" })).toHaveAttribute(
      "href",
      "https://github.com/Felipek06",
    );
    expect(
      screen.getByText("Databricks Certified: Machine Learning & Data Engineer Associate"),
    ).toBeInTheDocument();
    expect(screen.getByText("Formações Alura: Python e SQL com PostgreSQL")).toBeInTheDocument();
  });

  it("lista as habilidades de cada integrante", () => {
    renderizar();
    const habilidades = screen.getByRole("list", { name: "Habilidades de Guilherme Carreri" });
    expect(habilidades).toHaveTextContent("Machine Learning");
    expect(habilidades).toHaveTextContent("Power BI");
  });

  it("mostra o vídeo de apresentação do projeto", () => {
    renderizar();
    const secao = screen.getByRole("region", { name: "Apresentação do PrognosisHerba" });
    expect(secao.querySelector("video source")).toHaveAttribute("src", "/video/apresentacao.mp4");
  });

  it("navega para o painel ao clicar em Acessar o painel", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Equipe />} />
          <Route path="/painel" element={<p>painel</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("link", { name: /Acessar o painel/ }));
    expect(screen.getByText("painel")).toBeInTheDocument();
  });
});
