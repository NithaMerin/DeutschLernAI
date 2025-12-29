import { Injectable, signal, effect } from '@angular/core';

export interface AiModel {
  id: string;
  name: string;
  provider: string;
  isFree?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AiSettingsService {
  private readonly MODEL_ID_STORAGE_KEY = 'deutschlern-model-id';
  // The API key is now fixed as requested.
  private readonly fixedApiKey = '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';

  // The list now contains only the free AI models. Default is now DeepSeek.
  availableModels: AiModel[] = [
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', isFree: true },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct', provider: 'MistralAI', isFree: true },
    { id: 'google/gemma-7b-it:free', name: 'Gemma 7B', provider: 'Google', isFree: true },
    { id: 'google/gemini-pro-1.0', name: 'Gemini Pro 1.0', provider: 'Google', isFree: true },
  ];

  // This method now returns the hardcoded key.
  apiKey(): string {
    return this.fixedApiKey;
  }
  
  selectedModelId = signal<string>(this.availableModels[0].id); // Default to DeepSeek Chat

  constructor() {
    if (typeof window !== 'undefined' && window.localStorage) {
      // API key retrieval from local storage is removed.
      const storedModelId = window.localStorage.getItem(this.MODEL_ID_STORAGE_KEY);
      
      if (storedModelId) {
        // Ensure the stored model is still in our curated list
        const isValidModel = this.availableModels.some(m => m.id === storedModelId);
        if (isValidModel) {
          this.selectedModelId.set(storedModelId);
        }
      }
    }
  }

  // Method is simplified to only handle the model ID.
  saveSettings(modelId: string): void {
    this.selectedModelId.set(modelId);
    
    if (typeof window !== 'undefined' && window.localStorage) {
      // API key storage is removed.
      window.localStorage.setItem(this.MODEL_ID_STORAGE_KEY, modelId);
    }
  }
}