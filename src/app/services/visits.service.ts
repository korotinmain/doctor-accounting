import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  addDoc,
  collection,
  collectionData,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  Timestamp
} from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

import { Visit, VisitDraft } from '../models/visit.model';

const VISITS_COLLECTION = 'visits';

@Injectable({
  providedIn: 'root'
})
export class VisitsService {
  constructor(
    private readonly firestore: Firestore,
    private readonly auth: Auth
  ) {}

  getVisitsByMonth(month: string, ownerUid: string): Observable<Visit[]> {
    const { start, end } = this.getMonthBounds(month);
    const visitsCollection = collection(this.firestore, VISITS_COLLECTION);
    const visitsQuery = query(
      visitsCollection,
      where('ownerUid', '==', ownerUid),
      where('visitDate', '>=', start),
      where('visitDate', '<=', end),
      orderBy('visitDate', 'desc')
    );

    return collectionData(visitsQuery, { idField: 'id' }).pipe(
      map((items) =>
        items
          .map((item) => this.normalizeVisit(item as Record<string, unknown>))
          .sort((left, right) => {
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
    const ownerUid = this.getCurrentUid();
    const visitsCollection = collection(this.firestore, VISITS_COLLECTION);
    await addDoc(visitsCollection, this.toCreatePayload(draft, ownerUid));
  }

  async updateVisit(id: string, draft: VisitDraft): Promise<void> {
    this.ensureAuthenticated();
    const visitDoc = doc(this.firestore, `${VISITS_COLLECTION}/${id}`);
    await updateDoc(visitDoc, this.toUpdatePayload(draft));
  }

  async deleteVisit(id: string): Promise<void> {
    this.ensureAuthenticated();
    const visitDoc = doc(this.firestore, `${VISITS_COLLECTION}/${id}`);
    await deleteDoc(visitDoc);
  }

  private toCreatePayload(draft: VisitDraft, ownerUid: string) {
    return {
      ...this.prepareDraft(draft),
      ownerUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }

  private toUpdatePayload(draft: VisitDraft) {
    return {
      ...this.prepareDraft(draft),
      updatedAt: serverTimestamp()
    };
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

  private normalizeVisit(item: Record<string, unknown>): Visit {
    return {
      id: String(item['id'] ?? ''),
      visitDate: String(item['visitDate'] ?? ''),
      patientName: String(item['patientName'] ?? ''),
      procedureName: String(item['procedureName'] ?? ''),
      amount: this.toNumber(item['amount']),
      percent: this.toNumber(item['percent']),
      doctorIncome: this.toNumber(item['doctorIncome']),
      notes: String(item['notes'] ?? ''),
      ownerUid: item['ownerUid'] ? String(item['ownerUid']) : undefined,
      createdAt: this.toMillis(item['createdAt']),
      updatedAt: this.toMillis(item['updatedAt'])
    };
  }

  private toNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private toMillis(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (value instanceof Timestamp) {
      return value.toMillis();
    }

    return undefined;
  }

  private ensureAuthenticated(): void {
    if (!this.auth.currentUser) {
      throw new Error('Користувач не авторизований.');
    }
  }

  private getCurrentUid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Користувач не авторизований.');
    }

    return uid;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
