import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService } from '../../services/gemini.service';
import { TranslationTargetLanguage } from '../../models/types';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-translator',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './translator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranslatorComponent {
  private aiService = inject(AiService);

  inputText = signal('');
  targetLanguage = signal<TranslationTargetLanguage>('English');
  translatedText = signal('');
  isLoading = signal(false);
  error = signal('');

  async onTranslate() {
    if (!this.inputText().trim()) {
      return;
    }

    this.isLoading.set(true);
    this.translatedText.set('');
    this.error.set('');

    try {
      const result = await this.aiService.translateText(this.inputText(), this.targetLanguage());
      this.translatedText.set(result);
    } catch (e: any) {
      let errorMessage = e.message || 'An unexpected error occurred. Please try again.';
       if (errorMessage.includes('API key not set')) {
        errorMessage += ' Click the settings icon ⚙️ in the header to configure it.';
      }
      this.error.set(errorMessage);
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }
}