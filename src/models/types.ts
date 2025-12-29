export type Skill = 'Reading' | 'Writing' | 'Speaking' | 'Listening' | 'Assessment' | 'Vocabulary';
export type TranslationTargetLanguage = 'English' | 'Tamil';

export interface Level {
  id: string;
  title: string;
  description: string;
  color: string;
}

export interface GameData {
  sentence: string;
  options: string[];
  correctAnswer: string;
  translation: string;
}

export interface SpeakingExercise {
  sentence: string;
  translation: string;
}

export interface ListeningExercise {
  script: string;
  translation: string; // English translation of the script
  question: string; // Question in German
  questionTranslation: string; // Question in English
  options: string[]; // Options in German
  optionsTranslations: string[]; // Parallel array of options in English
  correctAnswer: string; // Correct answer in German
}

export interface WordAnalysis {
  word: string;
  status: 'correct' | 'incorrect' | 'mispronounced';
  comment?: string;
  phoneticTranscription?: string;
  improvementSuggestion?: string;
}

export interface PronunciationFeedback {
  overallComment: string;
  score: number;
  analyzedWords: WordAnalysis[];
}

export interface VocabularyCard {
  word: string;
  translation: string;
  exampleSentence: string;
  exampleTranslation: string;
}

export interface LearningContent {
  type: 'markdown' | 'game' | 'speaking' | 'listening';
  data: string | GameData | SpeakingExercise | ListeningExercise;
}

export interface ListeningQuizResult {
  question: ListeningExercise;
  userAnswer: string;
  isCorrect: boolean;
}

export interface Report {
  id: string;
  title: string;
  date: number; // Will use Date.now()
  score: number;
  total: number;
  results: ListeningQuizResult[];
  levelId: string;
}