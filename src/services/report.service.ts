import { Injectable, signal, effect } from '@angular/core';
import { Report, ListeningQuizResult } from '../models/types';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly STORAGE_KEY = 'deutschlern-reports';
  
  reports = signal<Report[]>([]);
  hasNewReport = signal(false);

  constructor() {
    this.loadReportsFromStorage();

    // Persist reports to localStorage whenever they change
    effect(() => {
      const currentReports = this.reports();
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(currentReports));
      }
    });
  }

  private loadReportsFromStorage() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedReports = localStorage.getItem(this.STORAGE_KEY);
      if (storedReports) {
        this.reports.set(JSON.parse(storedReports));
      }
    }
  }

  addReport(reportData: Omit<Report, 'id' | 'date'>) {
    const newReport: Report = {
      ...reportData,
      id: self.crypto.randomUUID(),
      date: Date.now(),
    };
    this.reports.update(reports => [newReport, ...reports]);
    this.hasNewReport.set(true);
  }

  deleteReports(ids: string[]) {
    this.reports.update(reports => reports.filter(r => !ids.includes(r.id)));
  }

  getReport(id: string): Report | undefined {
    return this.reports().find(r => r.id === id);
  }

  markAsRead() {
    this.hasNewReport.set(false);
  }
}
