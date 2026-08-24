import { describe, expect, it } from "vitest";
import { diaDaSemana, formatarDiaMes, formatarEquipe } from "./formato";

describe("formatarDiaMes", () => {
  it("converte data ISO para dd/mm", () => {
    expect(formatarDiaMes("2026-09-14")).toBe("14/09");
  });
});

describe("diaDaSemana", () => {
  it("retorna a abreviação do dia da semana", () => {
    // 2026-09-14 é uma segunda-feira
    expect(diaDaSemana("2026-09-14")).toBe("seg");
  });

  it("calcula corretamente para domingo", () => {
    // 2026-09-13 é um domingo
    expect(diaDaSemana("2026-09-13")).toBe("dom");
  });
});

describe("formatarEquipe", () => {
  it("substitui underscore por espaço e capitaliza", () => {
    expect(formatarEquipe("equipe_4")).toBe("Equipe 4");
  });

  it("funciona com ids sem underscore", () => {
    expect(formatarEquipe("time1")).toBe("Time1");
  });
});
