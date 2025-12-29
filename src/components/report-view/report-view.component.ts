import { Component, ChangeDetectionStrategy, signal, computed, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Report, ListeningExercise } from '../../models/types';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [CommonModule, DatePipe, TranslatePipe],
  templateUrl: './report-view.component.html',
  // This component is only used for rendering, so no complex change detection is needed.
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportViewComponent {
  report = input.required<Report>();

  scorePercentage = computed(() => {
    const currentReport = this.report();
    if (!currentReport || currentReport.total === 0) {
      return 0;
    }
    return Math.round((currentReport.score / currentReport.total) * 100);
  });

  getOptionTranslation(exercise: ListeningExercise, option: string): string {
    const optionIndex = exercise.options.indexOf(option);
    if (optionIndex > -1 && exercise.optionsTranslations && exercise.optionsTranslations.length > optionIndex) {
        return exercise.optionsTranslations[optionIndex];
    }
    return '';
  }
}
