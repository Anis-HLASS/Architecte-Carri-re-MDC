export enum AppStep {
  ACQUISITION = 'ACQUISITION',
  ANALYSIS = 'ANALYSIS',
  TARGETING = 'TARGETING',
  TEMPLATE = 'TEMPLATE',
  GENERATION = 'GENERATION'
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface UserData {
  rawCvText?: string;
  jobOfferText?: string;
  additionalInfo?: string;
  latexTemplate?: string;
  latexCode?: string;
}
