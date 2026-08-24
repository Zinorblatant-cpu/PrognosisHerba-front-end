import { describe, expect, it } from "vitest";
import { limparEquipe, obterEquipeSalva, salvarEquipe } from "./equipe";

describe("equipe", () => {
  it("retorna null quando nenhuma equipe foi salva", () => {
    expect(obterEquipeSalva()).toBeNull();
  });

  it("salva e recupera a equipe selecionada", () => {
    salvarEquipe("equipe_2");
    expect(obterEquipeSalva()).toBe("equipe_2");
  });

  it("substitui a equipe salva anteriormente", () => {
    salvarEquipe("equipe_2");
    salvarEquipe("equipe_5");
    expect(obterEquipeSalva()).toBe("equipe_5");
  });

  it("limpa a equipe salva", () => {
    salvarEquipe("equipe_2");
    limparEquipe();
    expect(obterEquipeSalva()).toBeNull();
  });
});
