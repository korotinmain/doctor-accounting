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
      orderBy('visitDate', 'desc'),
      orderBy('createdAt', 'desc')
    );

    return collectionData(visitsQuery, { idField: 'id' }).pipe(
      map((items) => items as Visit[])
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

    const start = new Date(Date.UTC(year, monthNumber - 1, 1));
    const end = new Date(Date.UTC(year, monthNumber, 0));

    return {
      start: this.formatDate(start),
      end: this.formatDate(end)
    };
  }

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
