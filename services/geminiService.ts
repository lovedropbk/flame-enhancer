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

    // Log the complete Gemini response for debugging
    console.log('🔍 Complete Gemini API Response:', JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error('💥 API call failed:', error);
    throw error;
  }
}

const DEFAULT_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

const parseJsonFromGeminiResponse = (responseText: string | undefined): any => {
  if (typeof responseText !== 'string') {
    throw new Error("Cannot parse JSON from undefined or non-string response text.");
  }

  console.log('🔍 Parsing Gemini response, length:', responseText.length);
  console.log('🔍 Raw response:', responseText);

  let jsonStr = responseText.trim();

  // Try to extract JSON array if wrapped in code fences or text
  const fenceRegex = /```(?:json)?\s*\n?(.*?)\n?\s*```/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[1]) {
    jsonStr = match[1].trim();
    console.log('✅ Extracted from code fences:', jsonStr);
  } else {
    // Look for JSON array pattern
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
      console.log('✅ Extracted JSON array:', jsonStr);
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    console.log('✅ Successfully parsed JSON:', parsed);
    return parsed;
  } catch (e) {
    console.error("❌ Failed to parse JSON:", e);
    console.error("❌ Attempted to parse:", jsonStr);
    throw new Error(`Failed to parse JSON response. Raw content: ${responseText.substring(0, 200)}...`);
  }
};

// Refinement helper functions
const getVibeString = (value: number | null): string => {
  if (value === null) return "User is unsure; create a balanced and broadly appealing vibe.";
  if (value <= 10) return "Sweet & Wholesome";
  if (value <= 35) return "Kind & Easygoing";
  if (value <= 60) return "Fun & Balanced";
  if (value <= 85) return "Confident & Bold";
  return "Edgy & Daring";
};

const getGoalString = (value: number | null): string => {
  if (value === null) return "User is unsure; aim for a tone that is open to possibilities, from casual to serious.";
  if (value <= 10) return "Ready for Marriage";
  if (value <= 35) return "Serious Relationship";
  if (value <= 60) return "Something Meaningful";
  if (value <= 85) return "Open to Dating";
  return "Casual Fun";
};

const getSophisticationString = (value: number | null): string => {
  if (value === null) return "User is unsure; aim for a generally intelligent and witty tone that is broadly accessible.";
  if (value <= 15) return "The target partner is a highly educated academic or specialist. Use complex sentence structures and advanced vocabulary. It's okay to be niche and specific. Think 'University Professor'.";
  if (value <= 40) return "The target partner is a cultured intellectual who appreciates arts, literature, and deep conversation. Use more sophisticated vocabulary and mention intellectual hobbies if possible. Think 'Cultured Intellectual'.";
  if (value <= 65) return "The target partner is an intelligent, likely career-focused professional. Use witty, clever language. References to ambition or a balanced lifestyle are good. Think 'Witty Professional'.";
  if (value <= 90) return "The target partner is fun, social, and extroverted. Use energetic, playful language. Keep it light and focused on social activities. Think 'Life of the Party'.";
  return "The target partner has simple interests, is impressed by luxury/status, and prefers direct, simple English. Use braggy but simple language (e.g., 'My passport is getting full'). Think 'Insta-Model'.";
};

// Optimized image conversion for AI photo selection - balances quality vs payload size
const convertImageToJPEG = (file: File): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    console.log('�️ oConverting image for AI analysis:', file.name, 'Original size:', Math.round(file.size / 1024) + 'KB');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      console.log('📐 Original dimensions:', img.width, 'x', img.height);

      // Better quality for accurate attractiveness assessment
      // Target: ~300KB per image for better AI analysis while staying under Vercel limits
      const maxSize = 768;
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

      console.log('📐 AI analysis dimensions:', width, 'x', height);

      // Draw and convert to JPEG with optimized quality for AI analysis
      ctx?.drawImage(img, 0, 0, width, height);

      try {
        // Start with higher quality for better attractiveness assessment
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let base64Data = dataUrl.split(',')[1];

        // Target ~300KB per image (400000 base64 chars ≈ 300KB) for better quality
        while (base64Data.length > 400000 && quality > 0.5) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          base64Data = dataUrl.split(',')[1];
        }

        console.log('✅ AI analysis image ready:', {
          quality: Math.round(quality * 100) + '%',
          sizeKB: Math.round(base64Data.length * 0.75 / 1024),
          compressionRatio: Math.round((file.size / (base64Data.length * 0.75)) * 100) / 100 + 'x'
        });

        resolve({
          base64Data,
          mimeType: 'image/jpeg'
        });
      } catch (error) {
        console.error('❌ AI analysis conversion failed:', error);
        reject(new Error(`Failed to convert image for AI analysis: ${error}`));
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

  let promptDetails = "Here's what the user shared about themselves:\n";
  if (answers.q0_name) promptDetails += `- Their Name: ${answers.q0_name}\n`;
  if (answers.q0_age) promptDetails += `- Their Age: ${answers.q0_age}\n`;
  if (answers.q0_gender) promptDetails += `- Their Gender: ${answers.q0_gender}\n`;
  if (answers.q0_target_gender) promptDetails += `- Their Target Audience: ${answers.q0_target_gender}\n`;

  // Add other answers
  Object.entries(answers).forEach(([key, value]) => {
    if (!['q0_name', 'q0_age', 'q0_gender', 'q0_target_gender'].includes(key) && value) {
      const answerText = Array.isArray(value) ? value.join(', ') : String(value);
      if (answerText.trim()) {
        promptDetails += `- ${key}: ${answerText}\n`;
      }
    }
  });

  const toneInstruction = tone ? `An additional specific tone for this bio is **${tone}**. Incorporate this into the overall style.` : '';

  // Add refinement instructions only when provided (advanced refinement flow)
  let refinementInstruction = '';
  if (refinementSettings) {
    const vibeString = getVibeString(refinementSettings.targetVibe);
    const goalString = getGoalString(refinementSettings.relationshipGoal);
    const sophisticationString = getSophisticationString(refinementSettings.targetSophistication);

    let simplicityInstruction = '';
    if (refinementSettings.useSimpleLanguage) {
      simplicityInstruction = `---**!! OVERRIDING LANGUAGE INSTRUCTION !!**- **USE EXTREMELY SIMPLE LANGUAGE:** The user has indicated the target audience are non-native English speakers. You MUST use very simple, basic English. Short sentences. Common words only. AVOID all sophisticated vocabulary, witty remarks that rely on complex language, or complex sentence structures. DUMB IT DOWN SIGNIFICANTLY. The goal is easy comprehension above all else. This instruction is MORE IMPORTANT than the 'Target Partner Sophistication' setting when it comes to language complexity.---`;
    }

    let locationInstruction = '';
    if (refinementSettings.swipeLocation) {
      if (refinementSettings.locationStatus === 'visiting' && refinementSettings.originLocation) {
        locationInstruction = `The user is currently visiting **${refinementSettings.swipeLocation}** but is from **${refinementSettings.originLocation}**. Weave this information into the bio in a cool and attractive way (e.g., "From [Origin], just landed in [Location] for a bit..." or "Exploring [Location] for the next two weeks. Any recommendations?").`;
      } else if (refinementSettings.locationStatus === 'living') {
        locationInstruction = `The user lives in **${refinementSettings.swipeLocation}**. You can use this for local charm if it feels natural (e.g., mentioning a local type of activity).`;
      }
      locationInstruction += `\n- **Language Nuance**: Based on the location **${refinementSettings.swipeLocation}**, subtly adjust the English complexity. If it's a major city in a non-native English speaking country (e.g., Tokyo, Bangkok), favor slightly simpler, clearer, more universal English. For native English speaking locations (e.g., New York, London), feel free to use more sophisticated or playful vocabulary. Use your world knowledge to make this judgment.`;
    }

    refinementInstruction = `---**TARGETING PREFERENCES (VERY IMPORTANT):**${simplicityInstruction}Use these specific targeting preferences to subtly guide the bio's tone and content. **DO NOT MENTION THESE PREFERENCES DIRECTLY IN THE BIO** unless explicitly instructed (like for travel status). Instead, embody them in the writing style.- **Target Vibe**: The user wants to attract someone with a '${vibeString}' personality. Adjust language accordingly.- **Relationship Goal**: The user is looking for '${goalString}'. Your bio should reflect this. For 'Ready for Marriage', emphasize stability and long-term qualities. For 'Casual Fun', emphasize spontaneity and adventure.- **Target Partner Sophistication**: ${sophisticationString} This is a critical instruction that should heavily influence vocabulary, sentence structure, and content.- **Location Details**: ${locationInstruction || 'User is based locally.'}- **Other Notes from User**: "${refinementSettings.additionalInfo || 'None'}"---`;
  }

  const prompt = `You are an expert dating profile ghostwriter. Your mission is to write a short, magnetic, and natural-sounding dating app bio (30-45 words) based on the user's answers and goals.

**Core Principles of a World-Class Bio:**
1. **Use Emojis Intelligently:** Sprinkle in 2-4 relevant emojis to add personality and visual flair. Use them to replace words where it makes sense (e.g., "Passionate about 🍕 & ✈️"). This is crucial for a modern feel.
2. **Be Witty & Confident:** The tone should be confident, light-hearted, and maybe a little cheeky. Avoid clichés.
3. **Show, Don't Tell:** Instead of saying "I'm funny," write something that *is* funny. Use their answers to imply traits.
4. **Create a "Hook":** End with an engaging question or a playful challenge that makes it easy for someone to start a conversation.
5. **Keep it Punchy:** Short sentences. High impact. Aim for a bio that is easily scannable and memorable.
6. **Sound Natural & Authentic:** The bio should sound like a real person wrote it, not a corporate marketing team.

**CRITICAL RULES:**
- **Word Count:** Stay between 30 and 45 words. This is a strict limit.
- **No Name/Age:** DO NOT include the user's name or age in the bio.
- **Output Format:** Your response MUST be ONLY the bio text itself. No introductions, no explanations, no markdown. Just the pure bio text.
- **${toneInstruction}**

${refinementInstruction}

${promptDetails}

Now, write a bio that gets swipes. Make it pop.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 5000
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
  photos: Array<{ id: string, file: File, fileName: string }>,
  numToSelect: number,
  userGender?: string,
  targetGender?: string
): Promise<Array<{ id: string, reason: string }>> => {
  console.log('🔍 Starting photo analysis for', photos.length, 'photos, selecting', numToSelect);

  // Convert all images to optimized JPEG format for AI analysis
  const convertedPhotos: Array<{
    originalId: string;
    simpleId: number;
    base64Data: string;
    mimeType: string;
    fileName: string;
  }> = [];
  let totalPayloadSize = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    console.log(`📸 Processing photo ${i + 1}/${photos.length}:`, photo.fileName);

    try {
      const converted = await convertImageToJPEG(photo.file);
      const imageSize = converted.base64Data.length * 0.75; // Approximate bytes
      totalPayloadSize += imageSize;

      convertedPhotos.push({
        originalId: photo.id,  // Keep original ID for mapping back
        simpleId: i + 1,       // Simple 1-based index for Gemini
        ...converted,
        fileName: photo.fileName
      });

      console.log(`✅ Photo ${i + 1} processed. Size: ${Math.round(imageSize / 1024)}KB, Total payload: ${Math.round(totalPayloadSize / 1024)}KB`);

      // Check if we're approaching Vercel's 4.5MB limit
      if (totalPayloadSize > 3500000) { // 3.5MB warning threshold
        console.warn(`⚠️ Payload size approaching limit: ${Math.round(totalPayloadSize / 1024)}KB`);
      }

    } catch (error) {
      console.error(`❌ Failed to convert photo ${photo.fileName}:`, error);
      throw new Error(`Failed to process image "${photo.fileName}": ${error}`);
    }
  }

  console.log(`📊 Total payload size: ${Math.round(totalPayloadSize / 1024)}KB for ${photos.length} photos`);

  const prompt = `You are a world-class dating profile consultant for a ${userGender || 'person'} interested in meeting ${targetGender || 'people'}. Your task is to act as an expert photo selector. You must choose the top photos that make the user look as ATTRACTIVE, confident, and appealing as possible for a dating app, keeping their gender and target audience in mind.

I have uploaded ${photos.length} photos numbered 1 to ${photos.length}.

**CRITICAL INSTRUCTION:**
- If there are ${numToSelect} or more photos, you MUST select exactly ${numToSelect}.
- If there are fewer than ${numToSelect} photos, you MUST select ALL of them.

**Selection Criteria (in order of importance):**
1. **Overall Attractiveness & Appeal:** How good does the user look? Does the photo radiate confidence, charm, or a desirable personality? This is the most important factor.
2. **Clarity and Focus:** The user must be clearly visible, in focus, and be the main subject of the photo.
3. **Flattering Lighting & Quality:** The photo must be well-lit. Avoid dark, blurry, pixelated, or low-quality images.
4. **Authentic Expression:** Genuine smiles and natural, candid expressions are strongly preferred over stiff or unnatural poses.
5. **Variety:** A good profile shows different sides of a person. If possible, create a varied set (e.g., a clear headshot, a full-body shot, a photo showing a hobby or activity).

For each photo you select, provide its position number (1 to ${photos.length}) as "id" and a reason. **This reason is critical.** The reason must be a concise, impactful, 10-word sentence that explains *why* it's a good choice (e.g., "Great smile and clear lighting make you look very approachable.").

IMPORTANT: Return ONLY a valid JSON array with exactly ${numToSelect} objects. Each object must have "id" (number from 1 to ${photos.length}) and "reason" (string) fields. Do not include any explanatory text, markdown, or code fences. Return only the raw JSON array.

Example format:
[{"id": 1, "reason": "Excellent lighting and genuine smile make you look very attractive."}, {"id": 5, "reason": "This full-body shot shows confidence and a great sense of style."}]`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string, data: string } }> = [{ text: prompt }];

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
      temperature: 0.1,
      maxOutputTokens: 15000  // MAX TOKENS - no limits for now!
    }
  };

  try {
    console.log('🚀 Sending request to Gemini API...');
    const response = await callGeminiAPI(`models/${GEMINI_TEXT_MODEL}:generateContent`, requestBody);

    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text;
      console.log('📝 Raw Gemini response text:', text);
      console.log('📝 Raw response length:', text?.length || 0);
      console.log('📝 Response first 500 chars:', text?.substring(0, 500));

      const parsed = parseJsonFromGeminiResponse(text);
      console.log('🔍 Parsed JSON response:', JSON.stringify(parsed, null, 2));

      if (Array.isArray(parsed) && parsed.length === numToSelect) {
        console.log('✅ Photo selection successful!');

        // Map simple IDs (1-based) back to original photo IDs
        const mappedResults = parsed.map((selection: any) => {
          const convertedPhoto = convertedPhotos.find(p => p.simpleId === selection.id);
          if (!convertedPhoto) {
            console.error(`❌ Could not find photo with simple ID ${selection.id}`);
            return null;
          }
          return {
            id: convertedPhoto.originalId,  // Return original ID
            reason: selection.reason
          };
        }).filter((item): item is { id: string; reason: string } => item !== null);

        console.log('✅ Mapped results:', mappedResults);
        return mappedResults;
      } else {
        console.error('❌ Invalid parsed response:', {
          isArray: Array.isArray(parsed),
          length: parsed?.length,
          expected: numToSelect,
          actual: parsed
        });
        throw new Error(`Expected ${numToSelect} photo selections, got ${parsed?.length || 0}`);
      }
    } else {
      console.error('❌ Invalid API response structure:', {
        hasCandidates: !!response.candidates,
        candidatesLength: response.candidates?.length,
        hasContent: !!response.candidates?.[0]?.content,
        fullResponse: response
      });
      throw new Error("Invalid response format from Gemini API");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.name : 'Unknown';

    console.error("💥 Photo selection error:", {
      message: errorMessage,
      stack: errorStack,
      name: errorName
    });

    // Provide more specific error messages
    if (errorMessage.includes('API Error')) {
      throw new Error(`Gemini API Error: ${errorMessage}`);
    } else if (errorMessage.includes('Expected')) {
      throw new Error(`Photo analysis incomplete: ${errorMessage}`);
    } else {
      throw new Error(`Photo analysis failed: ${errorMessage}`);
    }
  }
};

export const refineBioWithChatFeedback = async (
  currentBio: string,
  feedback: string
): Promise<string> => {
  const prompt = `You are an expert dating profile editor. A user has an existing bio and wants to make a small change. Your task is to subtly edit the bio to incorporate the user's feedback while preserving the original tone and core message. Do not rewrite the entire bio from scratch.

**Current Bio:**
"${currentBio}"

**User's Request:**
"${feedback}"

**CRITICAL RULES:**
- Apply the user's change gracefully and intelligently.
- Keep the bio short, modern, and engaging (around 45 words)
- Your response MUST BE ONLY the edited bio text itself. No introductions, no explanations, no markdown. Just the pure bio text.`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.1,  // Lower temperature for more precise editing
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