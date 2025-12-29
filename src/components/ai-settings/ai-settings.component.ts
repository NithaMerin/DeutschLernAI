import { Component, ChangeDetectionStrategy, inject, signal, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiSettingsService, AiModel } from '../../services/ai-settings.service';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiSettingsComponent implements OnInit {
  aiSettingsService = inject(AiSettingsService);
  close = output<void>();

  selectedModelId = signal('');
  availableModels: AiModel[] = [];

  ngOnInit() {
    this.selectedModelId.set(this.aiSettingsService.selectedModelId());
    this.availableModels = this.aiSettingsService.availableModels;
  }

  save() {
    this.aiSettingsService.saveSettings(this.selectedModelId());
    this.close.emit();
  }

  cancel() {
    this.close.emit();
  }
}