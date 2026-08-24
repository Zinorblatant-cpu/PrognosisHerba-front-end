const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-09-14" -> data local à meia-noite (evita o deslocamento de fuso do parse ISO puro). */
function parseData(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

/** "2026-09-14" -> "14/09" */
export function formatarDiaMes(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function diaDaSemana(iso: string) {
  return DIAS_SEMANA[parseData(iso).getDay()];
}

/** "equipe_4" -> "Equipe 4" */
export function formatarEquipe(equipeId: string) {
  const legivel = equipeId.replace(/_/g, " ");
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}
