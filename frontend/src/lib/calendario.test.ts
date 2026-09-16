import { describe, expect, it } from "vitest";
import { construirCalendario } from "./calendario";

function achar(meses: ReturnType<typeof construirCalendario>, iso: string) {
  for (const mes of meses) {
    for (const semana of mes.semanas) {
      for (const dia of semana) {
        if (dia?.iso === iso) return dia;
      }
    }
  }
  return null;
}

describe("construirCalendario", () => {
  it("monta um único mês quando início e fim estão no mesmo mês", () => {
    const meses = construirCalendario("2026-09-05", "2026-09-20", new Map([["2026-09-10", 2]]));

    expect(meses).toHaveLength(1);
    expect(meses[0].label).toBe("Setembro 2026");
    expect(achar(meses, "2026-09-10")?.totalLocais).toBe(2);
    expect(achar(meses, "2026-09-05")?.totalLocais).toBe(0);
  });

  it("monta um mês para cada mês que o período atravessa", () => {
    const meses = construirCalendario("2026-09-28", "2026-10-05", new Map());
    expect(meses.map((m) => m.label)).toEqual(["Setembro 2026", "Outubro 2026"]);
  });

  it("atravessa a virada do ano corretamente", () => {
    const meses = construirCalendario("2026-12-15", "2027-01-10", new Map([["2027-01-03", 1]]));
    expect(meses.map((m) => m.label)).toEqual(["Dezembro 2026", "Janeiro 2027"]);
    expect(achar(meses, "2027-01-03")?.totalLocais).toBe(1);
  });

  it("alinha o primeiro dia do mês na coluna correta da semana e preenche o resto com null", () => {
    const meses = construirCalendario("2026-09-01", "2026-09-01", new Map());
    const primeiraSemana = meses[0].semanas[0];
    const indice = primeiraSemana.findIndex((d) => d?.iso === "2026-09-01");

    expect(indice).toBe(new Date("2026-09-01T00:00:00").getDay());
    expect(primeiraSemana.slice(0, indice).every((d) => d === null)).toBe(true);

    const todasCelulas = meses[0].semanas.flat();
    expect(todasCelulas.length % 7).toBe(0);
    expect(todasCelulas.filter((d) => d !== null)).toHaveLength(30);
  });
});
