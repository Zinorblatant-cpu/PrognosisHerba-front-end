const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** "2026-09-14" -> data local à meia-noite (evita o deslocamento de fuso do parse ISO puro). */
function parseData(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

function paraIso(ano: number, mesIndex: number, dia: number) {
  return `${ano}-${String(mesIndex + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export interface DiaCalendario {
  iso: string;
  totalLocais: number;
}

export interface MesCalendario {
  label: string;
  semanas: (DiaCalendario | null)[][];
}

/** Monta um calendário (dom-sáb) com um mês para cada mês entre `inicio` e `fim`, marcando quantos locais têm poda em cada dia. */
export function construirCalendario(
  inicio: string,
  fim: string,
  totalPorDia: Map<string, number>,
): MesCalendario[] {
  const dataInicio = parseData(inicio);
  const dataFim = parseData(fim);

  const cursorInicio = dataInicio.getFullYear() * 12 + dataInicio.getMonth();
  const cursorFim = dataFim.getFullYear() * 12 + dataFim.getMonth();

  const meses: MesCalendario[] = [];

  for (let cursor = cursorInicio; cursor <= cursorFim; cursor += 1) {
    const ano = Math.floor(cursor / 12);
    const mesIndex = cursor % 12;
    const diasNoMes = new Date(ano, mesIndex + 1, 0).getDate();
    const primeiroDiaSemana = new Date(ano, mesIndex, 1).getDay();

    const celulas: (DiaCalendario | null)[] = [...Array<null>(primeiroDiaSemana).fill(null)];
    for (let dia = 1; dia <= diasNoMes; dia += 1) {
      const iso = paraIso(ano, mesIndex, dia);
      celulas.push({ iso, totalLocais: totalPorDia.get(iso) ?? 0 });
    }
    while (celulas.length % 7 !== 0) celulas.push(null);

    const semanas: (DiaCalendario | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));

    meses.push({ label: `${MESES[mesIndex]} ${ano}`, semanas });
  }

  return meses;
}
