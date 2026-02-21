export interface Visit {
  id: string;
  visitDate: string;
  patientName: string;
  procedureName: string;
  amount: number;
  percent: number;
  doctorIncome: number;
  notes: string;
  ownerUid?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VisitDraft {
  visitDate: string;
  patientName: string;
  procedureName: string;
  amount: number;
  percent: number;
  notes: string;
}
