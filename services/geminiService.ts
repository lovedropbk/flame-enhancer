import { GEMINI_TEXT_MODEL, RECOMMENDED_BIO_LENGTH } from '../constants';
import { QuestionnaireAnswers, RefinementSettings } from "../types";

// Secure API call function that doesn't expose API key
async function callGeminiAPI(endpoint: string, body: any) {
  console.log('🔄 Making API call to:', endpoint);
  console.log('📤 Request body structure:', {
    contents: body.contents?.length || 0,
    safetySettings: body.safetySettings?.length || 0,
    generationConfig: !!body.generationConfig
  });

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ endpoint, body })
    });

    console.log('📡 API Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error Response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `HTTP ${response.status}: ${errorText}` };
      }
      
      throw new Error(`API Error (${response.status}): ${errorData.error || errorText}`);
    }

    const result = await response.json();
    console.log('✅ API Success Response structure:', {
      candidates: result.candidates?.length || 0,
      usageMetadata: !!result.usageMetadata,
      modelVersion: result.modelVersion
    });

    return result;
  } catch (error) {
    console.error('💥 API call failed:', error);
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

// Image conversion utility for maximum compatibility
const convertImageToJPEG = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    console.log('🖼️ Converting image:', file.name, 'Type:', file.type, 'Size:', file.size);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      console.log('📐 Original dimensions:', img.width, 'x', img.height);
      
      // Optimize for mobile and API limits - max 1024px on longest side
      const maxSize = 1024;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      console.log('📐 Resized dimensions:', width, 'x', height);
      
      // Draw and convert to JPEG with good quality
      ctx?.drawImage(img, 0, 0, width, height);
      
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64Data = dataUrl.split(',')[1];
        
        console.log('✅ Image converted successfully. New size:', Math.round(base64Data.length * 0.75), 'bytes');
        
        resolve({
          base64Data,
          mimeType: 'image/jpeg'
        });
      } catch (error) {
        console.error('❌ Canvas conversion failed:', error);
        reject(new Error(`Failed to convert image: ${error}`));
      }
    };
    
    img.onerror = (error) => {
      console.error('❌ Image load failed:', error);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    
    img.src = URL.createObjectURL(file);
  });
};

export const generateBioFromAnswers = async (
  answers: QuestionnaireAnswers, 
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
  photos: Array<{id: string, file: File, fileName: string}>,
  numToSelect: number,
  userGender?: string,
  targetGender?: string
): Promise<Array<{id: string, reason: string}>> => {
  console.log('🔍 Starting photo analysis for', photos.length, 'photos, selecting', numToSelect);
  
  // Convert all images to JPEG format for maximum compatibility
  const convertedPhotos = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    console.log(`📸 Processing photo ${i + 1}/${photos.length}:`, photo.fileName);
    
    try {
      const converted = await convertImageToJPEG(photo.file);
      convertedPhotos.push({
        id: photo.id,
        ...converted,
        fileName: photo.fileName
      });
    } catch (error) {
      console.error(`❌ Failed to convert photo ${photo.fileName}:`, error);
      throw new Error(`Failed to process image "${photo.fileName}": ${error}`);
    }
  }

  const prompt = `Analyze these ${photos.length} photos and select the best ${numToSelect} for a dating profile. Consider attractiveness, photo quality, and variety.

User gender: ${userGender || 'not specified'}
Target audience: ${targetGender || 'not specified'}

Return a JSON array with exactly ${numToSelect} objects, each with "id" and "reason" fields.`;

  const parts: Array<{text: string} | {inlineData: {mimeType: string, data: string}}> = [{ text: prompt }];
  
  // Add converted photos as inline data
  convertedPhotos.forEach(photo => {
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