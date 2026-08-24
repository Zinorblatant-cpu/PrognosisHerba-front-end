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

export interface PeriodoReferencia {
  inicio: string;
  fim: string;
}

export interface AlocacaoPublicada {
  publicadoEm: string;
  periodo: PeriodoReferencia;
  alocacoes: AlocacaoDiaComStatus[];
  naoAlocados: LocalAlocado[];
}

export interface ConcluirLocalRequest {
  equipeId: string;
  dia: string;
  localId: string;
  concluido: boolean;
}
