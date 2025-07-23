

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'longtext' | 'single-choice' | 'multiple-choice';
  options?: string[];
  placeholder?: string;
}

export interface QuestionnaireAnswers {
  [questionId: string]: string | string[] | undefined; // Allow undefined for optional properties
  q0_name?: string; // Specifically for user's name
  q0_age?: string;  // Specifically for user's age (as string for input flexibility)
  q0_gender?: string; // Specifically for user's gender
  q0_target_gender?: string; // Specifically for user's target gender
}

export interface UploadedPhoto {
  id: string; // Unique ID for the uploaded photo, e.g., timestamp + filename
  file: File;
  objectURL: string; // For client-side preview
  base64Data?: string; // For sending to API
  mimeType?: string; // For sending to API
}

export interface SelectedPhoto {
  id: string; // Matches id from UploadedPhoto
  objectURL: string;
  reason: string;
  originalFileName: string;
  enhancedObjectURL?: string; // URL for the AI-enhanced photo
}

export interface GeneratedProfile {
  bio: string;
  selectedPhotos: SelectedPhoto[];
  userName?: string; // User's name from questionnaire
  userAge?: string; // User's age from questionnaire
}

export interface RefinementSettings {
  targetVibe: number | null; // 0-100, now allows null for "Not Sure"
  relationshipGoal: number | null; // 0-100, now allows null for "Not Sure"
  targetSophistication: number | null; // 0-100, now allows null for "Not Sure"
  swipeLocation: string;
  locationStatus: 'living' | 'visiting' | null;
  originLocation: string;
  additionalInfo: string;
  useSimpleLanguage: boolean;
}


export type AppStep =
  | 'welcome'
  | 'essentialQuestionnaire'
  | 'photoUpload'
  | 'analyzingPreliminary'
  | 'preliminaryResults'
  | 'analyzingFinal'
  | 'finalResults';

// Old types, kept for reference during transition or if parts are reused.
// To be removed once fully transitioned.
export interface PhotoAnalysis {
  id: string;
  originalUrl: string;
  originalType: string;
  score: string;
  feedback: string;
}

export interface BioAnalysisResult {
  original: string;
  rewritten: string;
}