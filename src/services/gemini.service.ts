import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslationTargetLanguage, Skill, LearningContent, GameData, SpeakingExercise, PronunciationFeedback, ListeningExercise, VocabularyCard } from '../models/types';
import { AiSettingsService } from './ai-settings.service';

/**
 * Custom error for when the API key is not configured.
 */
export class ApiKeyNotSetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyNotSetError';
  }
}

// Interface for OpenAI-compatible API message format
interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable({
  providedIn: 'root',
})
export class AiService { // Renamed from GeminiService
  private http = inject(HttpClient);
  private aiSettings = inject(AiSettingsService);

  private readonly OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

  // History to prevent duplicate content generation
  private generatedContentHistory = new Map<string, string[]>();
  private readonly HISTORY_CAP = 10;

  private getHeaders() {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.aiSettings.apiKey()}`,
      // Recommended headers by OpenRouter
      'HTTP-Referer': `https://deutschlern.ai`, // Generic site URL
      'X-Title': `DeutschLern AI` 
    });
  }
  
  /**
   * Clears the content generation history for a specific skill session.
   * This ensures that each time a user starts a skill, they get fresh content.
   */
  public clearHistoryForSkill(levelId: string, skill: Skill): void {
    const keyPrefix = `${levelId}-${skill}`;
    // Clear history for all related categories (e.g., vocabulary nouns and adjectives)
    for (const key of this.generatedContentHistory.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.generatedContentHistory.delete(key);
      }
    }
  }

  private updateHistory(key: string, newItem: string): void {
    if (!this.generatedContentHistory.has(key)) {
      this.generatedContentHistory.set(key, []);
    }
    const history = this.generatedContentHistory.get(key)!;
    history.push(newItem);
    if (history.length > this.HISTORY_CAP) {
      history.shift(); // Keep the list size manageable
    }
  }

  private getHistoryPromptFragment(key: string, itemType: string): string {
    const history = this.generatedContentHistory.get(key);
    if (history && history.length > 0) {
      return `To ensure variety, please generate a completely new and different ${itemType} from the following examples that have already been shown: "${history.join('", "')}".`;
    }
    return 'Please generate a unique item.';
  }

  private parseError(error: any): string {
    // Prefer the detailed error message from the API response body.
    if (error?.error) { // error.error is the body in HttpErrorResponse
        const errorBody = error.error;
        if (typeof errorBody === 'object' && errorBody !== null) {
            // Standard OpenAI/OpenRouter structure: { error: { message: "..." } }
            if (errorBody.error?.message) {
                if (typeof errorBody.error.message === 'string') {
                    return errorBody.error.message;
                } else {
                    // Handle cases where `message` itself is an object
                    return `API Error: ${JSON.stringify(errorBody.error)}`;
                }
            }
            // Simpler structure: { message: "..." }
            if (errorBody.message) {
                if (typeof errorBody.message === 'string') {
                    return errorBody.message;
                }
            }
            // If the body is an object but we didn't find a standard message, stringify it.
            return `API Response Body: ${JSON.stringify(errorBody)}`;
        }
        // The body might be a plain string.
        if (typeof errorBody === 'string') {
            return errorBody;
        }
    }

    // Fallback to the top-level message property (e.g., for network errors or our custom errors).
    if (error?.message) {
        return error.message;
    }

    // If all else fails, provide a generic message.
    return 'An unknown API error occurred. Please check the browser console for details.';
  }

  private async executeChatCompletion(messages: AiMessage[]): Promise<any> {
    const apiKey = this.aiSettings.apiKey();
    if (!apiKey) {
      throw new ApiKeyNotSetError('OpenRouter API key not set. Please set it in the AI Settings.');
    }
    
    const body: any = {
      model: this.aiSettings.selectedModelId(),
      messages,
      temperature: 0.8, // Slightly increased for more variety
    };
    
    // NOTE: The `response_format` parameter has been removed. It is not supported
    // by all models on OpenRouter (especially free ones) and can cause API errors.
    // We now rely exclusively on strong system prompts for JSON generation.
    
    try {
      const response$ = this.http.post<any>(this.OPENROUTER_API_URL, body, { headers: this.getHeaders() });
      return await firstValueFrom(response$);
    } catch (error) {
      const parsedMessage = this.parseError(error);
      console.error('AI Service Error:', { originalError: error, parsedMessage });
      throw new Error(parsedMessage);
    }
  }

  async generateLearningContent(level: string, skill: Skill): Promise<LearningContent> {
    if (skill === 'Assessment') return this.generateAssessmentQuestion(level);
    if (skill === 'Speaking') return this.generateSpeakingExercise(level);
    if (skill === 'Listening') return this.generateListeningExercise(level);
    return this.generateMarkdownContent(level, skill);
  }

  private async generateMarkdownContent(level: string, skill: Skill): Promise<LearningContent> {
    const key = `${level}-${skill}`;
    const historyPrompt = this.getHistoryPromptFragment(key, 'topic or prompt');
    const prompt = this.createLearningPrompt(level, skill) + ` ${historyPrompt}`;

    const messages: AiMessage[] = [
      { role: 'system', content: 'You are an expert German language teacher.' },
      { role: 'user', content: prompt }
    ];
    const response = await this.executeChatCompletion(messages);
    const contentData = response.choices[0].message.content;
    this.updateHistory(key, contentData.substring(0, 100)); // Store first 100 chars as a proxy for the topic
    return { type: 'markdown', data: contentData };
  }

  private async generateJsonBasedContent(prompt: string): Promise<any> {
    const messages: AiMessage[] = [
        { role: 'system', content: 'You are a helpful assistant that always responds in JSON format. Do not include markdown ```json tags or any other text outside the JSON object.' },
        { role: 'user', content: prompt }
    ];
    let responseContent = '';
    const response = await this.executeChatCompletion(messages);
    responseContent = response.choices[0].message.content;

    // Clean the response to ensure it's valid JSON
    const jsonMatch = responseContent.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
        responseContent = jsonMatch[0];
    }

    try {
        return JSON.parse(responseContent);
    } catch (error) {
        console.error('Failed to parse JSON from AI response:', responseContent);
        throw new Error('The AI returned a response that was not valid JSON.');
    }
  }
  
  private async generateAssessmentQuestion(level: string): Promise<LearningContent> {
    const key = `${level}-Assessment`;
    const historyPrompt = this.getHistoryPromptFragment(key, 'question');
    const prompt = `As an expert German language teacher, create a single, **unique** fill-in-the-blank assessment question for a beginner at the ${level} level. The sentence should have one blank word represented by '___'. Provide three options: the correct word and two plausible incorrect words. Structure the output as a JSON object with keys: "sentence", "options", "correctAnswer", and "translation". ${historyPrompt}`;
    const gameData = await this.generateJsonBasedContent(prompt);
    this.updateHistory(key, gameData.sentence);
    return { type: 'game', data: gameData as GameData };
  }

  private async generateSpeakingExercise(level: string): Promise<LearningContent> {
    const key = `${level}-Speaking`;
    const historyPrompt = this.getHistoryPromptFragment(key, 'sentence');
    const prompt = `As a German language teacher, create a single, simple German sentence for a beginner at the ${level} level to practice speaking. Also provide its English translation. Structure the output as a JSON object with keys: "sentence" and "translation". ${historyPrompt}`;
    const exerciseData = await this.generateJsonBasedContent(prompt);
    this.updateHistory(key, exerciseData.sentence);
    return { type: 'speaking', data: exerciseData as SpeakingExercise };
  }

  private async generateListeningExercise(level: string): Promise<LearningContent> {
    const key = `${level}-Listening`;
    const historyPrompt = this.getHistoryPromptFragment(key, 'script');
    const prompt = `As a German language teacher, create a listening exercise for a beginner at the ${level} level. The entire exercise must be in German, with English translations provided for review purposes. Provide:
1.  A short German audio script (2-3 simple sentences).
2.  An English translation of the script.
3.  A multiple-choice comprehension question **in German** about the script.
4.  An English translation of the question.
5.  Three plausible answer options **in German** (one correct).
6.  A parallel array of English translations for the three options.
7.  The correct answer (the exact string from the German options).
Structure the output as a JSON object with keys: "script", "translation", "question", "questionTranslation", "options", "optionsTranslations", and "correctAnswer". 
To ensure freshness, please base the scenario on a random, uncommon topic. ${historyPrompt}`;
    const listeningData = await this.generateJsonBasedContent(prompt);
    this.updateHistory(key, listeningData.script);
    return { type: 'listening', data: listeningData as ListeningExercise };
  }

  async generateVocabularyCard(level: string, category: 'adjective' | 'noun'): Promise<VocabularyCard> {
    const key = `${level}-Vocabulary-${category}`;
    const historyPrompt = this.getHistoryPromptFragment(key, 'word');
    const prompt = `Generate a German vocabulary flashcard for a learner at the ${level} level. The category is "${category}". Ensure the word is appropriate for this level and is not a very common word. Provide the German word, its English translation, a simple German example sentence, and the English translation of that sentence. Structure the output as a JSON object with keys: "word", "translation", "exampleSentence", and "exampleTranslation". ${historyPrompt}`;
    const cardData = await this.generateJsonBasedContent(prompt);
    this.updateHistory(key, cardData.word);
    return cardData;
  }

  async analyzePronunciation(originalText: string, userTranscript: string): Promise<PronunciationFeedback> {
    const prompt = `As a German pronunciation coach, analyze the user's speech.
      Original sentence: "${originalText}"
      User's transcript: "${userTranscript}"
      
      Provide a word-by-word analysis in a JSON object. The object should have three keys: "overallComment" (string), "score" (integer 0-100), and "analyzedWords" (an array of objects).
      Each object in "analyzedWords" should represent a word from the original sentence and have keys: "word" (string) and "status" ('correct', 'incorrect', or 'mispronounced').
      For 'incorrect' or 'mispronounced' words, also include a "comment" (string).`;
      
    return this.generateJsonBasedContent(prompt);
  }

  async translateText(text: string, targetLanguage: TranslationTargetLanguage): Promise<string> {
    const prompt = `Translate the following German text to ${targetLanguage}. Provide only the translation, without any additional explanations or introductions. German Text: "${text}"`;
    const messages: AiMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.executeChatCompletion(messages);
    return response.choices[0].message.content;
  }

  private createLearningPrompt(level: string, skill: Skill): string {
    const baseInstruction = `As an expert German language teacher, create a simple and engaging exercise for a beginner at the ${level} level focusing on the skill of **${skill}**. The response should be in Markdown format and different every time.`;
    switch (skill) {
      case 'Reading':
        return `${baseInstruction} Provide a short paragraph (3-5 sentences) in German about a common topic like daily routines, hobbies, or family. After the paragraph, list 5 key vocabulary words from the text, providing their translations in both English and Tamil. Format it with "Paragraph", and "Vocabulary" headings.`;
      case 'Writing':
        return `${baseInstruction} Provide a simple writing prompt in German. The prompt should ask the learner to write 2-3 sentences about a personal topic. Also, provide 3-4 helpful German vocabulary words with English and Tamil translations that they could use in their response.`;
      default:
        return `Create a German learning exercise for a ${level} student.`;
    }
  }

  async getAssistantResponse(query: string, targetLanguage: 'English' | 'Tamil'): Promise<string> {
    const prompt = `You are a helpful and friendly German language learning assistant. Your primary goal is to provide clear, direct, and helpful answers to a user's questions about German words or phrases. The user wants the response in ${targetLanguage}.

    **CRITICAL INSTRUCTIONS:**
    1.  The user will often ask a question in ${targetLanguage} but include a specific German word or phrase they want to understand (e.g., "What does 'Entschuldigung' mean?").
    2.  Your task is to identify that specific German term within the user's query.
    3.  Provide a direct translation of the German term.
    4.  After the translation, provide one simple example sentence in German showing how the term is used, and then provide the ${targetLanguage} translation of that example sentence.
    5.  Keep your entire response concise and focused on being helpful. Do not add conversational filler.
    6.  **DO NOT** use any formatting like asterisks or markdown.

    **Example Interaction:**
    - User Query: "What is the meaning of 'guten Morgen'?"
    - Your Ideal Response (if target language is English): "'Guten Morgen' means 'Good morning'. For example, you can say 'Guten Morgen, wie geht's?', which means 'Good morning, how are you?'."

    ---
    User Query: "${query}"
    
    Now, please provide your response following these instructions exactly.`;
    
    const messages: AiMessage[] = [{ role: 'user', content: prompt }];
    const response = await this.executeChatCompletion(messages);
    return response.choices[0].message.content;
  }
}