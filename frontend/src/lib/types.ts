export interface SemanaPrevisao {
  data: string;
  alturaPrevistaCm: number;
  nivelAlerta: "baixo" | "medio" | "alto";
}

export interface PrevisaoRegiao {
  idRegiao: string;
  inclinacaoGraus: number;
  areaDeRisco: "baixo" | "medio" | "alto";
  semanas: SemanaPrevisao[];
}

export interface LocalAlocado {
  localId: string;
  prioridade: string;
  dificuldade: string;
}

export interface AlocacaoDia {
  equipeId: string;
  dia: string;
  locais: LocalAlocado[];
}

export interface AlertaCapacidade {
  capacidadeTotalMes: number;
  demandaTotal: number;
  deficit: number;
  equipesDiaAdicionais: number;
  equipesExtrasSugeridas: number;
  mensagem: string;
}

export interface LocalDerivado {
  id: string;
  prioridade: string;
  dificuldade: string;
  dataAlvo: string;
  alturaPrevistaCm: number;
}

export interface GerarAlocacaoDePrevisoesRequest {
  quantidadeEquipes: number;
  capacidadeDiaria?: number;
  ano?: number;
  mes?: number;
  limiarPodaCm?: number;
}

export interface GerarAlocacaoDePrevisoesResponse {
  mesReferencia: { ano: number; mes: number };
  locaisDerivados: LocalDerivado[];
  alocacoes: AlocacaoDia[];
  naoAlocados: LocalAlocado[];
  alerta: AlertaCapacidade | null;
  foraDoMes: LocalDerivado[];
  semAlertaNoHorizonte: string[];
}
