import { Visit } from './visit.model';

export interface LedgerVm {
  visits: Visit[];
  hasQuery: boolean;
}
