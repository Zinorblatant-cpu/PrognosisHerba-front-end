export interface RegiaoClusterizada {
  idRegiao: string;
  rota: string;
  rotaSimulada: boolean;
  alturaAtualCm: number;
  tendenciaCmPorSemana: number;
  semanasDesdeUltimaPoda: number;
  clusterId: number;
}

export interface Cluster {
  clusterId: number;
  rotulo: string;
  regioes: string[];
  rotas: string[];
  alturaMediaCm: number;
  tendenciaMediaCmPorSemana: number;
}

export interface Clusterizacao {
  avisoRota: string;
  clusters: Cluster[];
  regioes: RegiaoClusterizada[];
}

export interface Parametros {
  limiarPodaCm: number;
  capacidadeDiaria: number;
}

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

export interface PeriodoReferencia {
  inicio: string;
  fim: string;
}

export interface GerarAlocacaoDePrevisoesRequest {
  quantidadeEquipes: number;
  capacidadeDiaria?: number;
  limiarPodaCm?: number;
}

export interface GerarAlocacaoDePrevisoesResponse {
  periodo: PeriodoReferencia;
  locaisDerivados: LocalDerivado[];
  alocacoes: AlocacaoDia[];
  naoAlocados: LocalAlocado[];
  alerta: AlertaCapacidade | null;
  semAlertaNoHorizonte: string[];
}

export interface PublicarAlocacaoRequest {
  periodo: PeriodoReferencia;
  alocacoes: AlocacaoDia[];
  naoAlocados: LocalAlocado[];
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
  periodo: PeriodoReferencia;
  alocacoes: AlocacaoDiaComStatus[];
  naoAlocados: LocalAlocado[];
}

export interface AnaliseGramaColuna {
  fracaoX: number;
  alturaPct: number | null;
  nivel: number;
  categoria: string;
}

export interface AnalisePick {
  pxPorCm: number;
  pontosInteriores: number;
  pontosBorda: number;
  areaCm2: number;
  larguraCm: number;
  alturaMediaCm: number;
}

export interface AnaliseGramaResponse {
  nivel: number;
  categoria: string;
  alturaMedianaPct: number | null;
  margemErroPct: number | null;
  coberturaVerdePct: number;
  porColuna: AnaliseGramaColuna[];
  larguraPx: number;
  alturaPx: number;
  imagemAnotadaBase64: string;
  analisePick: AnalisePick | null;
}

/** Dois pontos clicados na fita métrica (coordenadas na resolução nativa da
 * imagem) + a distância real (cm) que eles representam. */
export interface CalibracaoFita {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
  distanciaCm: number;
}
