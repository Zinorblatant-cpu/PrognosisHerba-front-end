import { describe, expect, it } from "vitest";
import { ordenarLocais } from "./locais";
import type { LocalAlocadoComStatus } from "./types";

function local(
  localId: string,
  prioridade: string,
  concluido: boolean,
): LocalAlocadoComStatus {
  return { localId, prioridade, dificuldade: "media", concluido };
}

describe("ordenarLocais", () => {
  it("coloca os concluídos depois dos pendentes (concluído já na frente)", () => {
    const resultado = ordenarLocais([local("A", "media", true), local("B", "media", false)]);
    expect(resultado.map((l) => l.localId)).toEqual(["B", "A"]);
  });

  it("coloca os concluídos depois dos pendentes (pendente já na frente)", () => {
    const resultado = ordenarLocais([local("B", "media", false), local("A", "media", true)]);
    expect(resultado.map((l) => l.localId)).toEqual(["B", "A"]);
  });

  it("ordena os pendentes por prioridade: alta, média, baixa", () => {
    const resultado = ordenarLocais([
      local("A", "baixa", false),
      local("B", "alta", false),
      local("C", "media", false),
    ]);
    expect(resultado.map((l) => l.localId)).toEqual(["B", "C", "A"]);
  });

  it("mantém prioridade desconhecida por último entre os pendentes (desconhecida na frente)", () => {
    const resultado = ordenarLocais([
      local("A", "alguma-coisa", false),
      local("B", "baixa", false),
    ]);
    expect(resultado.map((l) => l.localId)).toEqual(["B", "A"]);
  });

  it("mantém prioridade desconhecida por último entre os pendentes (desconhecida atrás)", () => {
    const resultado = ordenarLocais([
      local("B", "baixa", false),
      local("A", "alguma-coisa", false),
    ]);
    expect(resultado.map((l) => l.localId)).toEqual(["B", "A"]);
  });

  it("preserva a ordem original quando prioridade e status empatam", () => {
    const resultado = ordenarLocais([
      local("A", "alta", false),
      local("B", "alta", false),
    ]);
    expect(resultado.map((l) => l.localId)).toEqual(["A", "B"]);
  });
});
