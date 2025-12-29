import { Component, ChangeDetectionStrategy, inject, signal, OnInit, input, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../../services/gemini.service';
import { VocabularyCard, Level } from '../../models/types';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-vocabulary-trainer',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './vocabulary-trainer.component.html',
  styleUrls: ['./vocabulary-trainer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VocabularyTrainerComponent implements OnInit, OnDestroy {
  private aiService = inject(AiService);
  
  level = input.required<Level>();

  currentCard = signal<VocabularyCard | null>(null);
  isFlipped = signal(false);
  isLoading = signal(false);
  error = signal('');
  
  private germanVoice: SpeechSynthesisVoice | undefined;

  constructor() {
    this.loadVoices();
  }

  ngOnInit() {
    this.aiService.clearHistoryForSkill(this.level().id, 'Vocabulary');
    this.getNewCard('noun');
  }

  ngOnDestroy() {
    window.speechSynthesis.cancel();
  }

  private loadVoices() {
    if (!('speechSynthesis' in window)) {
        console.error("This browser does not support speech synthesis.");
        return;
    }
    const setVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      this.germanVoice = voices.find(voice => voice.lang.startsWith('de')) || voices.find(voice => voice.default);
    };
    
    setVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setVoices;
    }
  }

  async getNewCard(category: 'adjective' | 'noun') {
    this.isLoading.set(true);
    this.isFlipped.set(false);
    this.error.set('');
    this.currentCard.set(null); // Clear previous card on new fetch

    // Give the card time to flip back before fetching new content
    setTimeout(async () => {
      try {
        const newCard = await this.aiService.generateVocabularyCard(this.level().id, category);
        this.currentCard.set(newCard);
      } catch (e: any) {
        let errorMessage = e.message || 'Could not load a new card. Please try again.';
        if (errorMessage.includes('API key not set')) {
          errorMessage += ' Click the settings icon ⚙️ in the header to configure it.';
        }
        this.error.set(errorMessage);
        console.error(e);
      } finally {
        this.isLoading.set(false);
      }
    }, 200);
  }

  flipCard() {
    this.isFlipped.update(value => !value);
  }

  speakWord(word: string) {
    if (!word || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel(); // Stop any previous speech
    const utterance = new SpeechSynthesisUtterance(word);
    if (this.germanVoice) {
      utterance.voice = this.germanVoice;
      utterance.lang = 'de-DE';
    }
    utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
    };
    window.speechSynthesis.speak(utterance);
  }
}