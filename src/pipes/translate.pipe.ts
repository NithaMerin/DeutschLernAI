import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  
  transform(key: string, interpolations?: Record<string, string | number>): string {
    return this.translationService.translate(key, interpolations);
  }
}
