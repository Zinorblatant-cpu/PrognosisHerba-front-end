import type { LocalAlocadoComStatus } from "./types";

const RANK_PRIORIDADE: Record<string, number> = { alta: 0, media: 1, baixa: 2 };

/** Pendentes primeiro (por prioridade), concluídos por último — para o podador ver o que falta de cara. */
export function ordenarLocais(locais: LocalAlocadoComStatus[]): LocalAlocadoComStatus[] {
  return locais
    .map((local, indice) => ({ local, indice }))
    .sort((a, b) => {
      if (a.local.concluido !== b.local.concluido) return a.local.concluido ? 1 : -1;

      const rankA = RANK_PRIORIDADE[a.local.prioridade] ?? 3;
      const rankB = RANK_PRIORIDADE[b.local.prioridade] ?? 3;
      if (rankA !== rankB) return rankA - rankB;

      return a.indice - b.indice;
    })
    .map(({ local }) => local);
}
