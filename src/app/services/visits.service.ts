import { Injectable } from '@angular/core';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  updateDoc,
  where
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { Visit, VisitDraft } from '../models/visit.model';

const VISITS_COLLECTION = 'visits';

@Injectable({
  providedIn: 'root'
})
export class VisitsService {
  constructor(private readonly firestore: Firestore) {}

  getVisitsByMonth(month: string): Observable<Visit[]> {
    const { start, end } = this.getMonthBounds(month);
    const visitsCollection = collection(this.firestore, VISITS_COLLECTION);
    const visitsQuery = query(
      visitsCollection,
      where('visitDate', '>=', start),
      where('visitDate', '<=', end),
      orderBy('visitDate', 'desc')
    );

    return collectionData(visitsQuery, { idField: 'id' }).pipe(
      map((items) =>
        (items as Visit[]).sort((left, right) => {
          const byDate = right.visitDate.localeCompare(left.visitDate);
          if (byDate !== 0) {
            return byDate;
          }

          return (right.createdAt ?? 0) - (left.createdAt ?? 0);
        })
      )
    );
  }

  async createVisit(draft: VisitDraft): Promise<void> {
    const visitsCollection = collection(this.firestore, VISITS_COLLECTION);
    await addDoc(visitsCollection, this.toCreatePayload(draft));
  }

  async updateVisit(id: string, draft: VisitDraft): Promise<void> {
    const visitDoc = doc(this.firestore, `${VISITS_COLLECTION}/${id}`);
    await updateDoc(visitDoc, this.toUpdatePayload(draft));
  }

  async deleteVisit(id: string): Promise<void> {
    const visitDoc = doc(this.firestore, `${VISITS_COLLECTION}/${id}`);
    await deleteDoc(visitDoc);
  }

  private toCreatePayload(draft: VisitDraft) {
    return {
      ...this.prepareDraft(draft),
      createdAt: Date.now()
    };
  }

  private toUpdatePayload(draft: VisitDraft) {
    return this.prepareDraft(draft);
  }

  private prepareDraft(draft: VisitDraft) {
    const amount = this.round(draft.amount);
    const percent = this.round(draft.percent);
    const doctorIncome = this.round((amount * percent) / 100);

    return {
      visitDate: draft.visitDate,
      patientName: draft.patientName.trim(),
      procedureName: draft.procedureName.trim(),
      amount,
      percent,
      doctorIncome,
      notes: draft.notes.trim()
    };
  }

  private getMonthBounds(month: string): { start: string; end: string } {
    const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : this.getCurrentMonth();
    const [year, monthNumber] = safeMonth.split('-').map((value) => Number(value));
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const normalizedMonth = String(monthNumber).padStart(2, '0');

    return {
      start: `${year}-${normalizedMonth}-01`,
      end: `${year}-${normalizedMonth}-${String(lastDay).padStart(2, '0')}`
    };
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
