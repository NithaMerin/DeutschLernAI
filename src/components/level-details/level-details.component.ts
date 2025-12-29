import { Component, ChangeDetectionStrategy, input, output, signal, effect, inject, untracked, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Level, Skill, LearningContent, GameData, SpeakingExercise, PronunciationFeedback, ListeningExercise, Report } from '../../models/types';
import { AiService } from '../../services/gemini.service'; // Keep path, change class
import { TranslatePipe } from '../../pipes/translate.pipe';
import { TranslationService } from '../../services/translation.service';
import { VocabularyTrainerComponent } from '../vocabulary-trainer/vocabulary-trainer.component';
import { ReportService } from '../../services/report.service';

declare var marked: {
  parse(markdown: string): string;
};

type SpeakingStatus = 'idle' | 'listening' | 'processing' | 'feedback';
type AudioStatus = 'idle' | 'playing';

@Component({
  selector: 'app-level-details',
  standalone: true,
  imports: [CommonModule, TranslatePipe, VocabularyTrainerComponent],
  templateUrl: './level-details.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelDetailsComponent implements OnDestroy {
  level = input.required<Level>();
  back = output<void>();

  private aiService = inject(AiService);
  private reportService = inject(ReportService);
  translationService = inject(TranslationService);
  private recognition: any;
  private germanVoice: SpeechSynthesisVoice | undefined;

  skills: Skill[] = ['Reading', 'Writing', 'Listening', 'Speaking', 'Vocabulary', 'Assessment'];
  selectedSkill = signal<Skill>('Reading');
  isLoading = signal(false);
  content = signal<LearningContent | null>(null);
  
  private contentRequestCounter = 0;

  // Assessment state
  readonly ASSESSMENT_LENGTH = 25;
  assessmentState = signal({
    questionsAnswered: 0,
    correctAnswers: 0,
    isComplete: false,
    results: [] as { question: GameData; userAnswer: string; isCorrect: boolean }[],
  });
  userSelection = signal<{ answer: string; isCorrect: boolean } | null>(null);
  
  // Speaking state
  speakingStatus = signal<SpeakingStatus>('idle');
  userTranscript = signal('');
  pronunciationFeedback = signal<PronunciationFeedback | null>(null);

  // Listening state
  readonly LISTENING_QUIZ_LENGTH = 10;
  audioStatus = signal<AudioStatus>('idle');
  listeningUserSelection = signal<{ answer: string; isCorrect: boolean } | null>(null);
  showListeningTranslation = signal(false);
  listeningQuizState = signal({
    questionsAnswered: 0,
    correctAnswers: 0,
    isComplete: false,
    results: [] as { question: ListeningExercise; userAnswer: string; isCorrect: boolean }[],
  });
  
  contentEffect = effect(() => {
    const levelId = this.level().id;
    const skill = this.selectedSkill();

    if (skill !== 'Vocabulary') {
      untracked(() => this.generateContent(levelId, skill));
    } else {
      this.content.set(null);
      this.isLoading.set(false);
    }
  });

  constructor() {
    this.setupSpeechRecognition();
    this.loadVoices();
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
      this.recognition.lang = 'de-DE';
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => this.speakingStatus.set('listening');
      this.recognition.onend = () => {
        if (this.speakingStatus() === 'listening') {
          this.speakingStatus.set('idle');
        }
      };
      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.speakingStatus.set('idle');
      };
      this.recognition.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        this.userTranscript.set(speechResult);
        this.analyzeReading();
      };
    } else {
      console.error('Speech Recognition not supported in this browser.');
    }
  }

   private loadVoices() {
    const setVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      this.germanVoice = voices.find(voice => voice.lang.startsWith('de')) || voices.find(voice => voice.default);
    };
    
    setVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = setVoices;
    }
  }

  parsedMarkdown = computed(() => {
    const currentContent = this.content();
    if (currentContent && currentContent.type === 'markdown' && typeof currentContent.data === 'string') {
      return marked.parse(currentContent.data);
    }
    return '';
  });

  assessmentQuestion = computed(() => {
     const currentContent = this.content();
    if (currentContent && currentContent.type === 'game') {
      return currentContent.data as GameData;
    }
    return null;
  });

  speakingExercise = computed(() => {
    const currentContent = this.content();
    if (currentContent && currentContent.type === 'speaking') {
      return currentContent.data as SpeakingExercise;
    }
    return null;
  });

  listeningExercise = computed(() => {
    const currentContent = this.content();
    if (currentContent && currentContent.type === 'listening') {
      return currentContent.data as ListeningExercise;
    }
    return null;
  });

  async generateContent(levelId: string, skill: Skill) {
    this.contentRequestCounter++;
    const currentRequest = this.contentRequestCounter;

    this.isLoading.set(true);
    this.content.set(null);
    this.userSelection.set(null);
    this.pronunciationFeedback.set(null);
    this.speakingStatus.set('idle');

    // Reset states based on the new skill
    if (skill !== 'Assessment') {
      this.assessmentState.set({ questionsAnswered: 0, correctAnswers: 0, isComplete: false, results: [] });
    } else {
      this.startAssessment();
    }
    
    if (skill !== 'Speaking') {
      this.userTranscript.set('');
    }

    if (skill !== 'Listening') {
        this.listeningQuizState.set({ questionsAnswered: 0, correctAnswers: 0, isComplete: false, results: [] });
        this.listeningUserSelection.set(null);
        this.showListeningTranslation.set(false);
        window.speechSynthesis.cancel();
        this.audioStatus.set('idle');
    } else {
        this.startListeningQuiz();
    }

    try {
      const result = await this.aiService.generateLearningContent(levelId, skill);
      if (currentRequest === this.contentRequestCounter) {
        this.content.set(result);
      }
    } catch (e: any) {
      if (currentRequest === this.contentRequestCounter) {
        let errorMessage = e.message || 'Could not generate content.';
        if (errorMessage.includes('API key not set')) {
          errorMessage += '\n\nClick the settings icon ⚙️ in the header to configure it.';
        }
        this.content.set({type: 'markdown', data: `### ❌ Error\n\n${errorMessage}`});
      }
    } finally {
      if (currentRequest === this.contentRequestCounter) {
        this.isLoading.set(false);
      }
    }
  }

  selectSkill(skill: Skill) {
    this.selectedSkill.set(skill);
  }

  goBack() {
    this.back.emit();
  }

  // --- Assessment Logic ---
  startAssessment() {
    this.assessmentState.set({
        questionsAnswered: 0,
        correctAnswers: 0,
        isComplete: false,
        results: [],
    });
  }

  handleAssessmentAnswer(selectedOption: string) {
    if (this.userSelection()) return;

    const question = this.assessmentQuestion();
    if (question) {
      const isCorrect = selectedOption === question.correctAnswer;
      this.userSelection.set({ answer: selectedOption, isCorrect });

      const newResult = { question, userAnswer: selectedOption, isCorrect };
      this.assessmentState.update(state => ({
        questionsAnswered: state.questionsAnswered + 1,
        correctAnswers: isCorrect ? state.correctAnswers + 1 : state.correctAnswers,
        isComplete: state.questionsAnswered + 1 === this.ASSESSMENT_LENGTH,
        results: [...state.results, newResult]
      }));

      if (!this.assessmentState().isComplete) {
        setTimeout(() => this.loadNewAssessmentQuestion(), 1500);
      }
    }
  }

  async loadNewAssessmentQuestion() {
    this.isLoading.set(true);
    this.userSelection.set(null);
    try {
      const result = await this.aiService.generateLearningContent(this.level().id, 'Assessment');
      this.content.set(result);
    } catch (e: any) {
      let errorMessage = e.message || 'Could not generate new question.';
       if (errorMessage.includes('API key not set')) {
        errorMessage += '\n\nClick the settings icon ⚙️ in the header to configure it.';
      }
      this.content.set({type: 'markdown', data: `### ❌ Error\n\n${errorMessage}`});
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Speaking Logic ---
  toggleListen() {
    if (!this.recognition) {
      alert('Speech recognition is not supported by your browser.');
      return;
    }
    if (this.speakingStatus() === 'listening') {
      this.recognition.stop();
    } else if (this.speakingStatus() === 'idle') {
      this.pronunciationFeedback.set(null);
      this.recognition.start();
    }
  }

  async analyzeReading() {
    const sentenceToAnalyze = this.speakingExercise()?.sentence;
    if (!sentenceToAnalyze || !this.userTranscript()) return;

    this.speakingStatus.set('processing');
    try {
      const feedback = await this.aiService.analyzePronunciation(sentenceToAnalyze, this.userTranscript());
      this.pronunciationFeedback.set(feedback);
      this.speakingStatus.set('feedback');
    } catch (e: any) {
      let errorMessage = e.message || "Couldn't analyze your speech.";
      this.pronunciationFeedback.set({
        overallComment: errorMessage,
        score: 0,
        analyzedWords: sentenceToAnalyze.split(' ').map(word => ({ word, status: 'incorrect', comment: 'Analysis failed' }))
      });
      this.speakingStatus.set('feedback');
    }
  }

  tryAgainSpeaking() {
     this.speakingStatus.set('idle');
     this.userTranscript.set('');
     this.pronunciationFeedback.set(null);
  }

  loadNewSentence() {
    this.generateContent(this.level().id, 'Speaking');
  }

  // --- Listening Quiz Logic ---
  startListeningQuiz() {
    // Force clear history at the start of every quiz to ensure unique questions
    this.aiService.clearHistoryForSkill(this.level().id, 'Listening');
    this.listeningQuizState.set({
        questionsAnswered: 0,
        correctAnswers: 0,
        isComplete: false,
        results: [],
    });
  }

  playListeningScript() {
    const exercise = this.listeningExercise();
    if (!exercise || this.audioStatus() === 'playing') return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(exercise.script);
    if (this.germanVoice) {
      utterance.voice = this.germanVoice;
      utterance.lang = 'de-DE';
    }
    utterance.onstart = () => this.audioStatus.set('playing');
    utterance.onend = () => this.audioStatus.set('idle');
    utterance.onerror = (e) => {
        console.error("Speech synthesis error", e);
        this.audioStatus.set('idle');
    };
    window.speechSynthesis.speak(utterance);
  }

  handleListeningAnswer(selectedOption: string) {
    if (this.listeningUserSelection()) return;

    const exercise = this.listeningExercise();
    if (exercise) {
        const isCorrect = selectedOption === exercise.correctAnswer;
        this.listeningUserSelection.set({ answer: selectedOption, isCorrect });

        const newResult = { question: exercise, userAnswer: selectedOption, isCorrect };
        
        let isNowComplete = false;
        this.listeningQuizState.update(state => {
            const questionsAnswered = state.questionsAnswered + 1;
            isNowComplete = questionsAnswered === this.LISTENING_QUIZ_LENGTH;
            return {
                questionsAnswered: questionsAnswered,
                correctAnswers: isCorrect ? state.correctAnswers + 1 : state.correctAnswers,
                isComplete: isNowComplete,
                results: [...state.results, newResult]
            };
        });
        
        if (isNowComplete) {
            const finalState = this.listeningQuizState();
            const report: Omit<Report, 'id' | 'date'> = {
                title: `Listening Quiz - Level ${this.level().id}`,
                levelId: this.level().id,
                score: finalState.correctAnswers,
                total: this.LISTENING_QUIZ_LENGTH,
                results: finalState.results,
            };
            this.reportService.addReport(report);
        } else {
            setTimeout(() => this.loadNewListeningExercise(), 1500);
        }
    }
  }

  async loadNewListeningExercise() {
    this.isLoading.set(true);
    this.content.set(null);
    this.listeningUserSelection.set(null);
    this.showListeningTranslation.set(false);

    try {
      const result = await this.aiService.generateLearningContent(this.level().id, 'Listening');
      this.content.set(result);
    } catch (e: any) {
       let errorMessage = e.message || 'Could not generate new question.';
       if (errorMessage.includes('API key not set')) {
        errorMessage += '\n\nClick the settings icon ⚙️ in the header to configure it.';
      }
      this.content.set({type: 'markdown', data: `### ❌ Error\n\n${errorMessage}`});
    } finally {
      this.isLoading.set(false);
    }
  }

  getOptionTranslation(exercise: ListeningExercise, option: string): string {
    const optionIndex = exercise.options.indexOf(option);
    if (optionIndex > -1 && exercise.optionsTranslations && exercise.optionsTranslations.length > optionIndex) {
        return exercise.optionsTranslations[optionIndex];
    }
    return '';
  }
}