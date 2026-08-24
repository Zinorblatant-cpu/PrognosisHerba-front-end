const CHAVE_EQUIPE = "podador.equipeId";

export function obterEquipeSalva(): string | null {
  return localStorage.getItem(CHAVE_EQUIPE);
}

export function salvarEquipe(equipeId: string): void {
  localStorage.setItem(CHAVE_EQUIPE, equipeId);
}

export function limparEquipe(): void {
  localStorage.removeItem(CHAVE_EQUIPE);
}
