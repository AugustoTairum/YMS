export interface ScheduleItem {
  id: string;
  importador: string;
  cntr: string;
  tipoDoc: string;
  quadraFull: string;
  servico: string;
  remocoes: number;
  agendamentoFull: string;
  _rawDate: Date | null;
}

export interface StockItem {
  id: string;
  cntr: string;
  local: string;
  quadra: string;
  bay: string;
  pos: string;
  servico: string;
  quadraBase: string;
}

export interface StackerConfig {
  start: string;
  mph: number;
}

export type StackerId = '1' | '2' | '3';

export type PlanningState = Record<StackerId, StockItem[]>;
export type ConfigState = Record<StackerId, StackerConfig>;

export interface SortConfig {
  key: keyof ScheduleItem;
  direction: 'asc' | 'desc';
}