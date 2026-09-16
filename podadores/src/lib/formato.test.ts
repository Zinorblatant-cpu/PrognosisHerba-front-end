import { afterEach, describe, expect, it, vi } from "vitest";
import { diaDaSemana, ehHoje, formatarDiaMes, formatarEquipe } from "./formato";

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

describe("ehHoje", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retorna true quando o iso é a data local de hoje", () => {
    vi.setSystemTime(new Date("2026-09-14T12:00:00"));
    expect(ehHoje("2026-09-14")).toBe(true);
  });

  it("retorna false quando o iso é outra data", () => {
    vi.setSystemTime(new Date("2026-09-14T12:00:00"));
    expect(ehHoje("2026-09-15")).toBe(false);
  });
});
