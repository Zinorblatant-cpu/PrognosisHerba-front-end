import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Agenda } from "./Agenda";
import type { AlocacaoPublicada } from "../lib/types";

const DADOS: AlocacaoPublicada = {
  publicadoEm: "2026-08-24T00:00:00Z",
  periodo: { inicio: "2026-09-14", fim: "2026-09-15" },
  alocacoes: [
    {
      equipeId: "equipe_1",
      dia: "2026-09-15",
      locais: [
        { localId: "RA-02", prioridade: "media", dificuldade: "facil", concluido: false },
      ],
    },
    {
      equipeId: "equipe_1",
      dia: "2026-09-14",
      locais: [
        { localId: "RA-01", prioridade: "alta", dificuldade: "media", concluido: true },
      ],
    },
    {
      equipeId: "equipe_2",
      dia: "2026-09-14",
      locais: [{ localId: "RA-03", prioridade: "baixa", dificuldade: "dificil", concluido: false }],
    },
  ],
  naoAlocados: [],
};

describe("Agenda", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mostra o nome da equipe e ordena os dias", () => {
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Equipe 1" })).toBeInTheDocument();

    const dias = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(dias).toEqual(["14/09 · seg", "15/09 · ter"]);
  });

  it("mostra apenas os locais da equipe selecionada", () => {
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    expect(screen.getByText("RA-01")).toBeInTheDocument();
    expect(screen.getByText("RA-02")).toBeInTheDocument();
    expect(screen.queryByText("RA-03")).not.toBeInTheDocument();
  });

  it("mostra o progresso concluídos/total", () => {
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("mostra estado vazio e progresso 0/0 quando a equipe não tem locais", () => {
    const dadosVazios: AlocacaoPublicada = { ...DADOS, alocacoes: [] };
    render(
      <Agenda
        dados={dadosVazios}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );
    expect(screen.getByText("0/0")).toBeInTheDocument();
    expect(screen.getByText(/Nenhum local alocado para a sua equipe/)).toBeInTheDocument();
  });

  it("chama onAlternarConclusao com o dia e o local ao marcar o checkbox", async () => {
    const user = userEvent.setup();
    const onAlternarConclusao = vi.fn();
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={onAlternarConclusao}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /RA-02/ }));

    expect(onAlternarConclusao).toHaveBeenCalledWith("2026-09-15", {
      localId: "RA-02",
      prioridade: "media",
      dificuldade: "facil",
      concluido: false,
    });
  });

  it("desabilita o checkbox do local pendente", () => {
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente="2026-09-15__RA-02"
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /RA-02/ })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /RA-01/ })).not.toBeDisabled();
  });

  it("chama onTrocarEquipe ao clicar em Trocar equipe", async () => {
    const user = userEvent.setup();
    const onTrocarEquipe = vi.fn();
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={onTrocarEquipe}
        onAlternarConclusao={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Trocar equipe" }));
    expect(onTrocarEquipe).toHaveBeenCalled();
  });

  it("destaca o dia de hoje e rola até ele", () => {
    vi.setSystemTime(new Date("2026-09-15T12:00:00"));
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    const secaoHoje = screen.getByText("15/09 · ter").closest("section")!;
    expect(within(secaoHoje).getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("14/09 · seg").closest("section")!.textContent).not.toContain("Hoje");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("não rola a tela quando nenhum dia listado é hoje", () => {
    vi.setSystemTime(new Date("2026-01-01T12:00:00"));
    render(
      <Agenda
        dados={DADOS}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    expect(screen.queryByText("Hoje")).not.toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it("mostra mensagem de conclusão quando todos os locais da equipe estão concluídos", () => {
    const dadosCompletos: AlocacaoPublicada = {
      ...DADOS,
      alocacoes: DADOS.alocacoes.map((a) =>
        a.equipeId === "equipe_1" ? { ...a, locais: a.locais.map((l) => ({ ...l, concluido: true })) } : a,
      ),
    };
    render(
      <Agenda
        dados={dadosCompletos}
        equipeId="equipe_1"
        pendente={null}
        onTrocarEquipe={vi.fn()}
        onAlternarConclusao={vi.fn()}
      />,
    );

    expect(screen.getByText("Tudo concluído por aqui! 🌿")).toBeInTheDocument();
  });
});
