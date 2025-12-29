import { Component, ChangeDetectionStrategy, inject, signal, computed, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReportService } from '../../services/report.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { Report } from '../../models/types';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'app-report-center',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './report-center.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCenterComponent {
  reportService = inject(ReportService);
  private translationService = inject(TranslationService);
  close = output<void>();
  viewReport = output<Report>();

  selectedReportIds = signal<string[]>([]);
  
  isViewDisabled = computed(() => this.selectedReportIds().length !== 1);
  isDeleteDisabled = computed(() => this.selectedReportIds().length === 0);

  onCheckboxChange(id: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.selectedReportIds.update(ids => {
      if (isChecked) {
        return [...ids, id];
      } else {
        return ids.filter(i => i !== id);
      }
    });
  }

  viewSelected() {
    if (this.isViewDisabled()) {
      alert(this.translationService.translate('reports.selectOne'));
      return;
    }
    const reportId = this.selectedReportIds()[0];
    const report = this.reportService.getReport(reportId);
    if (report) {
      this.viewReport.emit(report);
    }
  }

  deleteSelected() {
    if (this.isDeleteDisabled()) return;
    
    if (confirm(`Are you sure you want to delete ${this.selectedReportIds().length} report(s)?`)) {
        this.reportService.deleteReports(this.selectedReportIds());
        this.selectedReportIds.set([]);
    }
  }
}