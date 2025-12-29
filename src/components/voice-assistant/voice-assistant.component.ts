import { Component, ChangeDetectionStrategy, inject, signal, output, OnDestroy, AfterViewInit, ElementRef, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../../services/gemini.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface AssistantMessage {
  author: 'user' | 'bot';
  text: string;
}

type AssistantStatus = 'idle' | 'listening' | 'processing' | 'speaking';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

@Component({
  selector: 'app-voice-assistant',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './voice-assistant.component.html',
  styleUrls: ['./voice-assistant.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceAssistantComponent implements AfterViewInit, OnDestroy {
  close = output<void>();
  private aiService = inject(AiService);
  private translationService = inject(TranslationService);

  private recognition: any;
  private voices: SpeechSynthesisVoice[] = [];

  status = signal<AssistantStatus>('idle');
  conversation = signal<AssistantMessage[]>([]);
  
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');

  constructor() {
    this.setupSpeechRecognition();
    this.loadVoices();
  }

  ngAfterViewInit() {
    // Give a moment for the animation to complete
    setTimeout(() => {
        const initialMessage = this.translationService.translate('assistant.welcome');
        this.addBotMessage(initialMessage, true);
    }, 300);
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.abort();
    }
    window.speechSynthesis.cancel();
  }

  private setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'de-DE'; // Listen for German, but it's flexible
      this.recognition.interimResults = false;
      this.recognition.onstart = () => this.status.set('listening');
      this.recognition.onend = () => {
        if (this.status() === 'listening') this.status.set('idle');
      };
      this.recognition.onerror = (event: any) => {
        console.error('Assistant speech recognition error', event.error);
        this.status.set('idle');
      };
      this.recognition.onresult = (event: any) => {
        this.handleUserQuery(event.results[0][0].transcript);
      };
    }
  }

  private loadVoices() {
    const setVoices = () => this.voices = window.speechSynthesis.getVoices();
    setVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setVoices;
    }
  }

  toggleListen() {
    if (!this.recognition) {
      alert('Speech recognition is not supported on this browser.');
      return;
    }
    if (this.status() === 'listening') {
      this.recognition.stop();
    } else if (this.status() === 'idle') {
      this.recognition.start();
    }
  }

  private async handleUserQuery(query: string) {
    if (!query.trim()) {
      this.status.set('idle');
      return;
    }

    this.status.set('processing');
    this.conversation.update(c => [...c, { author: 'user', text: query }]);
    this.scrollToBottom();

    try {
      const targetLang = this.translationService.currentLanguage() === 'ta' ? 'Tamil' : 'English';
      const rawResponse = await this.aiService.getAssistantResponse(query, targetLang);
      
      // Sanitize the response to remove symbols that are read aloud by TTS engines
      // and can clutter the display. This replaces asterisks and colons with a space,
      // then consolidates multiple spaces into one.
      const cleanResponse = rawResponse.replace(/[*:]/g, ' ').replace(/\s+/g, ' ').trim();

      this.addBotMessage(cleanResponse, true);
    } catch (e: any) {
      const errorMessage = e.message || 'An error occurred';
      this.addBotMessage(errorMessage, true);
    }
  }

  private addBotMessage(text: string, shouldSpeak: boolean) {
    this.conversation.update(c => [...c, { author: 'bot', text }]);
    this.scrollToBottom();
    if (shouldSpeak) {
      this.speak(text);
    } else {
      this.status.set('idle');
    }
  }

  private speak(text: string) {
    if (!('speechSynthesis' in window) || !text) {
      this.status.set('idle');
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = this.translationService.currentLanguage();
    
    if (targetLang === 'ta') {
        utterance.lang = 'ta-IN';
        utterance.voice = this.voices.find(v => v.lang === 'ta-IN') || null;
    } else {
        utterance.lang = 'en-US';
        utterance.voice = this.voices.find(v => v.lang === 'en-US' && v.name.includes('Google')) || this.voices.find(v => v.lang === 'en-US') || null;
    }

    utterance.onstart = () => this.status.set('speaking');
    utterance.onend = () => this.status.set('idle');
    utterance.onerror = (e) => {
      console.error('Assistant speech synthesis error:', e.error);
      this.status.set('idle');
    };
    window.speechSynthesis.speak(utterance);
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.chatContainer()?.nativeElement;
      if (element) {
        element.scrollTop = element.scrollHeight;
      }
    }, 50);
  }
}