import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LevelDetailsComponent } from './components/level-details/level-details.component';
import { TranslatorComponent } from './components/translator/translator.component';
import { Level, Report } from './models/types';
import { TranslationService, Language } from './services/translation.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { AiSettingsService } from './services/ai-settings.service';
import { AiSettingsComponent } from './components/ai-settings/ai-settings.component';
import { VoiceAssistantComponent } from './components/voice-assistant/voice-assistant.component';
import { ReportService } from './services/report.service';
import { ReportCenterComponent } from './components/report-center/report-center.component';
import { ReportViewComponent } from './components/report-view/report-view.component';

type View = 'dashboard' | 'level' | 'translator';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    DashboardComponent,
    LevelDetailsComponent,
    TranslatorComponent,
    AiSettingsComponent,
    VoiceAssistantComponent,
    ReportCenterComponent,
    ReportViewComponent,
    TranslatePipe,
  ],
})
export class AppComponent {
  translationService = inject(TranslationService);
  aiSettingsService = inject(AiSettingsService);
  reportService = inject(ReportService);
  
  currentView = signal<View>('dashboard');
  selectedLevel = signal<Level | null>(null);
  showAiSettings = signal(false);
  showVoiceAssistant = signal(false);
  showReportCenter = signal(false);
  reportToView = signal<Report | null>(null);

  get ViewState() {
    return {
      isDashboard: this.currentView() === 'dashboard',
      isLevel: this.currentView() === 'level',
      isTranslator: this.currentView() === 'translator',
    };
  }

  constructor() {
    // Set default language
    this.translationService.setLanguage('de');
  }

  showLevel(level: Level) {
    this.selectedLevel.set(level);
    this.currentView.set('level');
  }

  showDashboard() {
    this.selectedLevel.set(null);
    this.currentView.set('dashboard');
  }

  showTranslator() {
    this.currentView.set('translator');
  }

  switchLanguage(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.translationService.setLanguage(selectElement.value as Language);
  }

  toggleAiSettings() {
    this.showAiSettings.update(val => !val);
  }

  closeAiSettings() {
    this.showAiSettings.set(false);
  }

  toggleVoiceAssistant() {
    this.showVoiceAssistant.update(v => !v);
  }
  
  toggleReportCenter() {
    this.showReportCenter.update(v => !v);
    if (this.showReportCenter()) {
      this.reportService.markAsRead();
    }
  }

  closeVoiceAssistant() {
    this.showVoiceAssistant.set(false);
  }
  
  viewReport(report: Report) {
    this.reportToView.set(report);
    this.showReportCenter.set(false);
  }

  closeReportView() {
    this.reportToView.set(null);
  }
}