import { GEMINI_TEXT_MODEL, RECOMMENDED_BIO_LENGTH, NUM_PHOTOS_TO_SELECT } from '../constants';
import { QuestionnaireAnswers, Question, SelectedPhoto, RefinementSettings } from "../types";

// Secure API call function that doesn't expose API key
async function callGeminiAPI(endpoint: string, body: any) {
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint, body })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'API request failed' }));
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

const DEFAULT_SAFETY_SETTINGS = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE"},
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

const parseJsonFromGeminiResponse = (responseText: string | undefined): any => {
  if (typeof responseText !== 'string') {
    throw new Error("Cannot parse JSON from undefined or non-string response text.");
  }
  let jsonStr = responseText.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s; 
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Failed to parse JSON response:", e, "Raw response text (if available):", responseText);
    throw new Error(`Failed to parse the JSON response. Content snippet: ${jsonStr.substring(0,100)}...`);
  }
};

const getVibeString = (value: number | null): string => {
    if (value === null) return "User is unsure; create a balanced and broadly appealing vibe.";
    if (value <= 10) return "Sweet & Wholesome";
    if (value <= 35) return "Kind & Easygoing";
    if (value <= 60) return "Fun & Balanced";
    if (value <= 85) return "Confident & Bold";
    return "Edgy & Provocative";
};

export const generateBioFromAnswers = async (
  answers: QuestionnaireAnswers, 
  questions: Question[], 
  tone?: string,
  refinementSettings?: RefinementSettings
): Promise<string> => {
  const prompt = `Create a dating profile bio based on these answers. Make it ${RECOMMENDED_BIO_LENGTH} characters or less, engaging, and authentic.

Answers: ${JSON.stringify(answers)}
${tone ? `Tone: ${tone}` : ''}
${refinementSettings ? `Refinement: ${JSON.stringify(refinementSettings)}` : ''}

Return only the bio text, no quotes or formatting.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200
    }
  };

  try {
    const response = await callGeminiAPI(`models/${GEMINI_TEXT_MODEL}:generateContent`, requestBody);
    
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text;
      return text || "Unable to generate bio. Please try again.";
    }
    
    throw new Error("Invalid response format from Gemini API");
  } catch (error) {
    console.error("Error generating bio:", error);
    throw new Error("Failed to generate bio. Please try again.");
  }
};

export const selectBestPhotos = async (
  photos: Array<{id: string, base64Data: string, mimeType: string, fileName: string}>,
  numToSelect: number,
  userGender?: string,
  targetGender?: string
): Promise<Array<{id: string, reason: string}>> => {
  const prompt = `Analyze these ${photos.length} photos and select the best ${numToSelect} for a dating profile. Consider attractiveness, photo quality, and variety.

User gender: ${userGender || 'not specified'}
Target audience: ${targetGender || 'not specified'}

Return a JSON array with exactly ${numToSelect} objects, each with "id" and "reason" fields.`;

  const parts = [{ text: prompt }];
  
  // Add photos as inline data
  photos.forEach(photo => {
    parts.push({
      inlineData: {
        mimeType: photo.mimeType,
        data: photo.base64Data
      }
    });
  });

  const requestBody = {
    contents: [{ parts }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1000
    }
  };

  try {
    const response = await callGeminiAPI(`models/${GEMINI_TEXT_MODEL}:generateContent`, requestBody);
    
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text;
      const parsed = parseJsonFromGeminiResponse(text);
      
      if (Array.isArray(parsed) && parsed.length === numToSelect) {
        return parsed;
      }
    }
    
    throw new Error("Invalid response format from photo selection");
  } catch (error) {
    console.error("Error selecting photos:", error);
    throw new Error("Failed to analyze photos. Please try again.");
  }
};

export const refineBioWithChatFeedback = async (
  currentBio: string,
  feedback: string
): Promise<string> => {
  const prompt = `Refine this dating profile bio based on the user's feedback:

Current bio: "${currentBio}"
User feedback: "${feedback}"

Return only the improved bio text, no quotes or formatting. Keep it under ${RECOMMENDED_BIO_LENGTH} characters.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200
    }
  };

  try {
    const response = await callGeminiAPI(`models/${GEMINI_TEXT_MODEL}:generateContent`, requestBody);
    
    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text;
      return text || currentBio;
    }
    
    return currentBio;
  } catch (error) {
    console.error("Error refining bio:", error);
    throw new Error("Failed to refine bio. Please try again.");
  }
};