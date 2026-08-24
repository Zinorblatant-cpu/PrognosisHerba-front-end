export interface LocalAlocado {
  localId: string;
  prioridade: string;
  dificuldade: string;
}

export interface LocalAlocadoComStatus extends LocalAlocado {
  concluido: boolean;
}

export interface AlocacaoDiaComStatus {
  equipeId: string;
  dia: string;
  locais: LocalAlocadoComStatus[];
}

export interface AlocacaoPublicada {
  publicadoEm: string;
  mesReferencia: { ano: number; mes: number };
  alocacoes: AlocacaoDiaComStatus[];
  naoAlocados: LocalAlocado[];
}

export interface ConcluirLocalRequest {
  equipeId: string;
  dia: string;
  localId: string;
  concluido: boolean;
}
