


import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse, Candidate, Part } from "@google/genai";
import { GEMINI_TEXT_MODEL, RECOMMENDED_BIO_LENGTH, NUM_PHOTOS_TO_SELECT } from '../constants';
import { QuestionnaireAnswers, Question, SelectedPhoto, RefinementSettings } from "../types";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY for Gemini is not set. Please ensure it is configured in your environment variables. This application will not work without it.");
}

const DEFAULT_SAFETY_SETTINGS = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE},
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const genAI = new GoogleGenAI({ 
  apiKey: API_KEY!
});


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
    if (value <= 10) return "Sweet & Wholesome"; // 0
    if (value <= 35) return "Kind & Easygoing"; // 25
    if (value <= 60) return "Fun & Balanced"; // 50
    if (value <= 85) return "Confident & Bold"; // 75
    return "Edgy & Daring"; // 100
};

const getGoalString = (value: number | null): string => {
    if (value === null) return "User is unsure; aim for a tone that is open to possibilities, from casual to serious.";
    if (value <= 10) return "Ready for Marriage"; // 0
    if (value <= 35) return "Serious Relationship"; // 25
    if (value <= 60) return "Something Meaningful"; // 50
    if (value <= 85) return "Open to Dating"; // 75
    return "Casual Fun"; // 100
};

const getSophisticationString = (value: number | null): string => {
    if (value === null) return "User is unsure; aim for a generally intelligent and witty tone that is broadly accessible.";
    if (value <= 15) return "The target partner is a highly educated academic or specialist. Use complex sentence structures and advanced vocabulary. It's okay to be niche and specific. Think 'University Professor'."; // 0
    if (value <= 40) return "The target partner is a cultured intellectual who appreciates arts, literature, and deep conversation. Use more sophisticated vocabulary and mention intellectual hobbies if possible. Think 'Cultured Intellectual'."; // 25
    if (value <= 65) return "The target partner is an intelligent, likely career-focused professional. Use witty, clever language. References to ambition or a balanced lifestyle are good. Think 'Witty Professional'."; // 50
    if (value <= 90) return "The target partner is fun, social, and extroverted. Use energetic, playful language. Keep it light and focused on social activities. Think 'Life of the Party'."; // 75
    return "The target partner has simple interests, is impressed by luxury/status, and prefers direct, simple English. Use braggy but simple language (e.g., 'My passport is getting full'). Think 'Insta-Model'."; // 100
}


export const generateBioFromAnswers = async (
  answers: QuestionnaireAnswers,
  questionDefinitions: Question[],
  tone?: string,
  refinementSettings?: RefinementSettings
): Promise<string> => {
  if (!API_KEY) return Promise.reject(new Error("Gemini API Key not configured. Cannot generate bio."));

  let promptDetails = "Here's what the user shared about themselves:\n";
  if (answers.q0_name) promptDetails += `- Their Name: ${answers.q0_name}\n`;
  if (answers.q0_age) promptDetails += `- Their Age: ${answers.q0_age}\n`;
  if (answers.q0_gender) promptDetails += `- Their Gender: ${answers.q0_gender}\n`;
  if (answers.q0_target_gender) promptDetails += `- Their Target Audience: ${answers.q0_target_gender}\n`;
  
  questionDefinitions.forEach(question => {
    const qId = question.id;
    if (['q0_name', 'q0_age', 'q0_gender', 'q0_target_gender'].includes(qId)) return;

    const answerValue = answers[qId];
    if (answerValue !== undefined) {
      let answerText = Array.isArray(answerValue) ? answerValue.join(', ') : String(answerValue);
      if (answerText.trim() === '' && qId !== 'q18_free_text') return;
      if (Array.isArray(answerValue) && answerValue.length === 0) return;
      promptDetails += `- ${question.text}: ${answerText}\n`;
    }
  });

  const toneInstruction = tone 
    ? `An additional specific tone for this bio is **${tone}**. Incorportate this into the overall style.`
    : '';
  
  let refinementInstruction = '';
  if (refinementSettings) {
      const vibeString = getVibeString(refinementSettings.targetVibe);
      const goalString = getGoalString(refinementSettings.relationshipGoal);
      const sophisticationString = getSophisticationString(refinementSettings.targetSophistication);

      let simplicityInstruction = '';
      if (refinementSettings.useSimpleLanguage) {
        simplicityInstruction = `
---
**!! OVERRIDING LANGUAGE INSTRUCTION !!**
- **USE EXTREMELY SIMPLE LANGUAGE:** The user has indicated the target audience are non-native English speakers. You MUST use very simple, basic English. Short sentences. Common words only. AVOID all sophisticated vocabulary, witty remarks that rely on complex language, or complex sentence structures. DUMB IT DOWN SIGNIFICANTLY. The goal is easy comprehension above all else. This instruction is MORE IMPORTANT than the 'Target Partner Sophistication' setting when it comes to language complexity.
---
`;
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


      refinementInstruction = `
---
**TARGETING PREFERENCES (VERY IMPORTANT):**
${simplicityInstruction}
Use these specific targeting preferences to subtly guide the bio's tone and content. **DO NOT MENTION THESE PREFERENCES DIRECTLY IN THE BIO** unless explicitly instructed (like for travel status). Instead, embody them in the writing style.
- **Target Vibe**: The user wants to attract someone with a '${vibeString}' personality. Adjust language accordingly.
- **Relationship Goal**: The user is looking for '${goalString}'. Your bio should reflect this. For 'Ready for Marriage', emphasize stability and long-term qualities. For 'Casual Fun', emphasize spontaneity and adventure.
- **Target Partner Sophistication**: ${sophisticationString} This is a critical instruction that should heavily influence vocabulary, sentence structure, and content.
- **Location Details**: ${locationInstruction || 'User is based locally.'}
- **Other Notes from User**: "${refinementSettings.additionalInfo || 'None'}"
---
`;
  }


  const prompt = `You are an expert dating profile ghostwriter. Your mission is to write a short, magnetic, and natural-sounding dating app bio (30-45 words) based on the user's answers and goals.

**Core Principles of a World-Class Bio:**
1.  **Use Emojis Intelligently:** Sprinkle in 2-4 relevant emojis to add personality and visual flair. Use them to replace words where it makes sense (e.g., "Passionate about 🍕 & ✈️"). This is crucial for a modern feel.
2.  **Be Witty & Confident:** The tone should be confident, light-hearted, and maybe a little cheeky. Avoid clichés.
3.  **Show, Don't Tell:** Instead of saying "I'm funny," write something that *is* funny. Use their answers to imply traits.
4.  **Create a "Hook":** End with an engaging question or a playful challenge that makes it easy for someone to start a conversation. (e.g., "Last one to [local cafe] buys the coffee?", "Tell me your most controversial food opinion.", "What's the next adventure?").
5.  **Keep it Punchy:** Short sentences. High impact. Aim for a bio that is easily scannable and memorable.
6.  **Sound Natural & Authentic:** The bio should sound like a real person wrote it, not a corporate marketing team. Avoid overly complex words or sentences that feel forced. The goal is connection, not just impressing. Use casual language.

**CRITICAL RULES:**
- **Word Count:** Stay between 30 and 45 words. This is a strict limit.
- **No Name/Age:** DO NOT include the user's name or age in the bio.
- **Output Format:** Your response MUST be ONLY the bio text itself. No introductions, no explanations, no markdown. Just the pure bio text.
- **${toneInstruction}**

${refinementInstruction}

Here are the user's answers (including their name, age, gender, and target audience for critical context):
${promptDetails}

Now, write a bio that gets swipes. Make it pop.`;
    
  try {
    console.log(`[geminiService.ts generateBio] Calling Gemini for Bio Generation with model: ${GEMINI_TEXT_MODEL}`);
    const response: GenerateContentResponse = await genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
            safetySettings: DEFAULT_SAFETY_SETTINGS
        }
    });
    
    const responseText = response.text;

    if (responseText && responseText.trim() !== '') {
        return responseText.trim();
    } else {
        console.error('[geminiService.ts generateBio] Gemini API did not return text for bio generation. Full response object:', JSON.stringify(response, null, 2));
        let detail = "No text content received.";
        if (response.candidates?.[0]?.finishReason) detail += ` Finish Reason: ${response.candidates[0].finishReason}.`;
        throw new Error(`Failed to generate bio. ${detail}`);
    }
  } catch (error) {
    console.error('[geminiService.ts generateBio] Error generating bio with Gemini:', error);
    throw new Error(`Failed to generate bio. ${error instanceof Error ? error.message : 'Unknown Gemini API error.'}`);
  }
};


export const selectBestPhotos = async (
  photos: Array<{ id: string; base64Data: string; mimeType: string; fileName: string }>,
  numToSelect: number = NUM_PHOTOS_TO_SELECT,
  userGender?: string,
  targetGender?: string
): Promise<Array<{ id: string; reason: string }>> => {
  if (!API_KEY) return Promise.reject(new Error("Gemini API Key not configured. Cannot select photos."));
  if (!photos || photos.length === 0) return Promise.resolve([]);

  const imageParts = photos.map(p => ({
    inlineData: { mimeType: p.mimeType, data: p.base64Data }
  }));

  const textPrompt = `You are a world-class dating profile consultant for a ${userGender || 'person'} interested in meeting ${targetGender || 'people'}. Your task is to act as an expert photo selector. You must choose the top photos that make the user look as ATTRACTIVE, confident, and appealing as possible for a dating app, keeping their gender and target audience in mind.

I have uploaded ${photos.length} photos. Their original filenames (and unique IDs for your reference) are:
${photos.map(p => `- ${p.fileName} (ID: ${p.id})`).join('\n')}

**CRITICAL INSTRUCTIONS:**
- If there are ${numToSelect} or more photos, you MUST select exactly ${numToSelect}.
- If there are fewer than ${numToSelect} photos, you MUST select ALL of them.

**PHOTO SELECTION & REASON GENERATION:**
For each photo you select, you must provide its unique ID and a specific "reason".
- **The "reason" is critical.** It MUST be a single, complete, flattering sentence.
- The sentence should be between 5 and 15 words long.
- It must explain *why* the photo is a good choice for a dating profile.
- Example of a good reason: "Your genuine smile here is incredibly warm and approachable."
- Example of a bad reason: "good photo".

**OUTPUT FORMAT:**
- Your response MUST be a valid JSON array of objects.
- Each object in the array represents one selected photo and MUST contain two keys: "id" (string) and "reason" (string).
- The "id" MUST exactly match one of the photo IDs provided above.
- The "reason" MUST be the single sentence you generated.
- DO NOT include any text, explanations, or markdown fences like \`\`\`json or \`\`\` outside of the JSON array. Your entire output must be parsable as JSON.

Example of a PERFECT response:
[
  { "id": "photo_123.jpg", "reason": "This photo has great lighting and shows off your warm smile." },
  { "id": "photo_456.png", "reason": "This full-body shot shows confidence and a great sense of style." }
]

Now, analyze the provided photos and return the JSON array.`;

  const contents = { parts: [...imageParts, { text: textPrompt }] };
  
  try {
    console.log(`[geminiService.ts selectBestPhotos] Calling Gemini for Photo Selection with model: ${GEMINI_TEXT_MODEL}`);
    const response: GenerateContentResponse = await genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL, 
        contents: contents, 
        config: { 
            responseMimeType: "application/json",
            temperature: 0.0,
            safetySettings: DEFAULT_SAFETY_SETTINGS
        }
    });
    const responseText = response.text;

    if (!responseText || responseText.trim() === '') {
        console.error('[geminiService.ts selectBestPhotos] Gemini API did not return text. Full response:', JSON.stringify(response, null, 2));
        let detail = "No text content received.";
        if (response.candidates?.[0]?.finishReason) detail += ` Finish Reason: ${response.candidates[0].finishReason}.`;
        throw new Error(`Failed to select photos. ${detail}`);
    }

    const parsedData = parseJsonFromGeminiResponse(responseText);

    if (Array.isArray(parsedData) && (parsedData.length === 0 || (typeof parsedData[0].id === 'string' && typeof parsedData[0].reason === 'string'))) {
      return parsedData; 
    } else {
      console.error("[geminiService.ts selectBestPhotos] Parsed JSON does not match expected structure:", parsedData);
      throw new Error("Received unexpected JSON structure for photo selection.");
    }

  } catch (error) {
    console.error('[geminiService.ts selectBestPhotos] Error selecting best photos with Gemini:', error);
    let errorMessage = 'Failed to select best photos. ';
    if (error instanceof Error) errorMessage += error.message;
    else errorMessage += 'Unknown Gemini API error.';
    throw new Error(errorMessage);
  }
};

export const refineBioWithChatFeedback = async (
  currentBio: string,
  userFeedback: string
): Promise<string> => {
  if (!API_KEY) return Promise.reject(new Error("Gemini API Key not configured. Cannot refine bio."));

  const prompt = `You are an expert dating profile editor. A user has an existing bio and wants to make a small change. Your task is to subtly edit the bio to incorporate the user's feedback while preserving the original tone and core message. Do not rewrite the entire bio from scratch.

**Current Bio:**
"${currentBio}"

**User's Request:**
"${userFeedback}"

**CRITICAL RULES:**
- Apply the user's change gracefully and intelligently.
- Keep the bio short, modern, and engaging (around 45 words).
- Your response MUST BE ONLY the edited bio text itself. No introductions, no explanations, no markdown. Just the pure bio text.`;

  try {
    console.log(`[geminiService.ts refineBioWithChatFeedback] Calling Gemini for Bio Refinement with model: ${GEMINI_TEXT_MODEL}`);
    const response: GenerateContentResponse = await genAI.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
            safetySettings: DEFAULT_SAFETY_SETTINGS,
            temperature: 0.1
        }
    });

    const responseText = response.text;

    if (responseText && responseText.trim() !== '') {
        return responseText.trim();
    } else {
        console.error('[geminiService.ts refineBioWithChatFeedback] Gemini API did not return text for bio refinement. Full response:', JSON.stringify(response, null, 2));
        let detail = "No text content received.";
        if (response.candidates?.[0]?.finishReason) detail += ` Finish Reason: ${response.candidates[0].finishReason}.`;
        throw new Error(`Failed to refine bio. ${detail}`);
    }
  } catch (error) {
    console.error('[geminiService.ts refineBioWithChatFeedback] Error refining bio with Gemini:', error);
    throw new Error(`Failed to refine bio. ${error instanceof Error ? error.message : 'Unknown Gemini API error.'}`);
  }
};