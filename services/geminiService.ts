import { QuestionnaireAnswers, RefinementSettings } from "../types";
import { uploadForAnalysis } from "./cloudinaryService";

// Secure API call function that doesn't expose API key
async function callGeminiAPI(endpoint: string, body: any, timeoutMs: number = 60000, provider?: 'gemini' | 'openai') {
  console.log('🔄 Making API call to:', endpoint);
  console.log('📤 Request body structure:', {
    contents: body.contents?.length || 0,
    safetySettings: body.safetySettings?.length || 0,
    generationConfig: !!body.generationConfig,
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls.length : 0
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const payload: any = { endpoint, body };
    if (provider) payload.provider = provider;

    // Log JSON payload size in bytes (pre-flight)
    const payloadString = JSON.stringify(payload);
    console.log('📦 Outbound /api/gemini JSON payload size (bytes):', payloadString.length);

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payloadString,
      signal: controller.signal
    });

    console.log('📡 API Response status:', response.status, response.statusText);

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);

        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch {
            // If parsing fails, use a structured error format
            errorData = {
                error: `HTTP ${response.status}: ${response.statusText}`,
                details: errorText.substring(0, 200) + (errorText.length > 200 ? '...' : '')
            };
        }

        const errorMessage = errorData.error || `API request failed with status ${response.status}`;
        const finalError = new Error(errorMessage);
        (finalError as any).status = response.status;
        (finalError as any).details = errorData.details || errorText;
        throw finalError;
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
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error(`API call timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    console.error('💥 API call failed:', error);
    throw (error instanceof Error) ? error : new Error(String(error));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const DEFAULT_SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

// Payload budgeting (client-side) to avoid 413 at the edge
// We stay comfortably under Vercel's ~4.5MB limit to account for headers/overhead.
const MAX_GEMINI_JSON_BYTES = 3_800_000; // 3.8 MB safety cap
const IMAGE_PART_OVERHEAD_BYTES = 512;    // rough JSON overhead per inline image part
const PROMPT_OVERHEAD_FLOOR_BYTES = 1024; // minimal structure overhead

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

// Encoding options for adaptive downsizing
type EncodeOptions = {
  targetBytes?: number;     // target final JPEG bytes for this image
  maxDimension?: number;    // initial max width/height
  minDimension?: number;    // floor for width/height when stepping down
  initialQuality?: number;  // starting JPEG quality (0..1)
  minQuality?: number;      // floor for JPEG quality
  qualityStep?: number;     // decrement per iteration
  dimensionStep?: number;   // scale factor for dimension down-step
};

// Optimized image conversion for AI photo selection - balances quality vs payload size
// More robust on Android/Google Photos: multiple decode strategies, header sniffing for disguised HEIC, and clearer errors.
// Now supports adaptive downsizing within a per-image byte budget.
const convertImageToJPEG = (file: File, options: EncodeOptions = {}): Promise<{ base64Data: string; mimeType: string }> => {
  const {
    targetBytes = 250 * 1024,   // default ~250KB
    maxDimension = 768,
    minDimension = 384,
    initialQuality = 0.85,
    minQuality = 0.35,
  } = options;

  return new Promise((resolve, reject) => {
    console.log('🖼️ Converting image for AI analysis:', file.name, 'Original size:', Math.round(file.size / 1024) + 'KB', {
      targetBytes,
      maxDimension,
      minDimension,
      initialQuality,
      minQuality,
    });

    // Helpers
    const promiseWithTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> => {
      return new Promise((res, rej) => {
        const id = window.setTimeout(() => rej(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
        p.then(v => { window.clearTimeout(id); res(v); }).catch(e => { window.clearTimeout(id); rej(e); });
      });
    };

    const sniffIsoBrands = async (f: File): Promise<{ isHeicFamily: boolean; isAvif: boolean; brand?: string }> => {
      try {
        const buf = new Uint8Array(await f.slice(0, 32).arrayBuffer());
        // Look for 'ftyp' + brand (ISO Base Media File Format)
        const asAscii = Array.from(buf).map(c => String.fromCharCode(c)).join('');
        const brands = ['heic','heif','hevc','mif1','msf1','avif','avis'];
        let detected: string | undefined;
        if (asAscii.includes('ftyp')) {
          for (const b of brands) {
            if (asAscii.includes('ftyp' + b)) { detected = b; break; }
          }
        }
        const isHeicFamily = !!detected && ['heic','heif','hevc','mif1','msf1'].includes(detected);
        const isAvif = detected === 'avif' || detected === 'avis';
        return { isHeicFamily, isAvif, brand: detected };
      } catch {
        return { isHeicFamily: false, isAvif: false };
      }
    };

    const blobToDataURL = (blob: Blob, timeoutMs: number = 45000): Promise<string> => {
      return new Promise((res, rej) => {
        const reader = new FileReader();
        let to: number | null = window.setTimeout(() => {
          to && window.clearTimeout(to);
          rej(new Error('FileReader.readAsDataURL timed out'));
        }, timeoutMs);
        reader.onerror = () => {
          to && window.clearTimeout(to);
          rej(reader.error || new Error('Unknown FileReader error'));
        };
        reader.onload = () => {
          to && window.clearTimeout(to);
          res(String(reader.result));
        };
        reader.readAsDataURL(blob);
      });
    };

    const loadImageElement = (src: string, timeoutMs: number = 30000): Promise<HTMLImageElement> => {
      return new Promise((res, rej) => {
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        let to: number | null = window.setTimeout(() => {
          to && window.clearTimeout(to);
          rej(new Error('Image decode timed out'));
        }, timeoutMs);

        const done = () => { to && window.clearTimeout(to); res(img); };
        img.onload = () => {
          if ('decode' in img && typeof (img as any).decode === 'function') {
            (img as any).decode().then(done).catch(() => done());
          } else {
            done();
          }
        };
        img.onerror = () => {
          to && window.clearTimeout(to);
          rej(new Error('HTMLImageElement onerror'));
        };
        img.src = src;
      });
    };

    const computeTargetDims = (w: number, h: number, max = 768): { w: number; h: number } => {
      if (w <= max && h <= max) return { w, h };
      if (w >= h) {
        const nh = Math.round((h * max) / w);
        return { w: max, h: nh };
      } else {
        const nw = Math.round((w * max) / h);
        return { w: nw, h: max };
      }
    };

    // Iteratively encode by reducing quality and dimensions until the targetBytes is met
    const adaptiveEncode = (imgW: number, imgH: number, imageDraw: (w: number, h: number) => HTMLCanvasElement) => {
      let currentMax = maxDimension;
      let finalBase64 = '';
      let finalQuality = initialQuality;
      let finalDims = { w: 0, h: 0 };

      outer: while (true) {
        const dims = computeTargetDims(imgW, imgH, currentMax);
        let quality = initialQuality;

        // Prepare canvas for these dims
        let canvas = imageDraw(dims.w, dims.h);

        while (true) {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const base64Data = dataUrl.split(',')[1];
          const sizeBytes = Math.floor(base64Data.length * 0.75);

          // Log attempt
          console.log('🧪 JPEG attempt:', {
            dims: `${dims.w}x${dims.h}`,
            quality,
            sizeKB: Math.round(sizeBytes / 1024),
            targetKB: Math.round(targetBytes / 1024),
          });

          if (sizeBytes <= targetBytes || quality <= minQuality + 1e-6) {
            // Accept this result and see if within budget; if not within budget and we can reduce dims, do that next
            finalBase64 = base64Data;
            finalQuality = quality;
            finalDims = dims;
            break;
          }

          quality = Math.max(minQuality, +(quality - 0.07).toFixed(2));
          // Continue inner loop with reduced quality
        }

        const finalBytes = Math.floor(finalBase64.length * 0.75);
        if (finalBytes <= targetBytes || currentMax <= minDimension) {
          // Either within target or reached dimension floor
          console.log('✅ AI analysis image ready:', {
            finalDims: `${finalDims.w}x${finalDims.h}`,
            quality: Math.round(finalQuality * 100) + '%',
            sizeKB: Math.round(finalBytes / 1024),
            compressionRatio: Math.round((file.size / finalBytes) * 100) / 100 + 'x'
          });
          return { base64Data: finalBase64, mimeType: 'image/jpeg' as const };
        }

        // Otherwise decrease dimensions and try again
        const nextDim = Math.floor(currentMax * 0.85);
        const nextMax = Math.max(minDimension, nextDim);
        if (nextMax === currentMax) {
          // Can't reduce further
          console.log('🟡 Reached min dimension; accepting last encode at', finalBytes, 'bytes');
          return { base64Data: finalBase64, mimeType: 'image/jpeg' as const };
        }
        console.log('↘️ Reducing dimensions for next encode pass:', { from: currentMax, to: nextMax });
        currentMax = nextMax;
      }
    };

    // Run async flow
    (async () => {
      // 1) Header sniff for disguised HEIC coming from Google Photos / Pixel (can be named .jpg but still HEIC)
      const sniff = await sniffIsoBrands(file);
      const explicitHeic =
        /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || '');
      if (explicitHeic || sniff.isHeicFamily) {
        throw new Error(
          `This image appears to be HEIC/HEIF (${sniff.brand || 'heic'}). Android/Chrome cannot draw HEIC to canvas. Please use JPEG/PNG/WebP, take a screenshot, or "Save as JPEG" in Google Photos before uploading.`
        );
      }

      // 2) Preferred fast path: createImageBitmap
      try {
        if (typeof createImageBitmap === 'function') {
          const bitmap = await promiseWithTimeout(createImageBitmap(file), 25000, 'createImageBitmap');
          try {
            const out = adaptiveEncode(bitmap.width, bitmap.height, (w, h) => {
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(bitmap, 0, 0, w, h);
              return canvas;
            });
            bitmap.close?.();
            resolve(out);
            return;
          } finally {
            try { (bitmap as ImageBitmap).close?.(); } catch { /* noop */ }
          }
        }
      } catch (e) {
        console.warn('⚠️ createImageBitmap path failed, falling back to HTMLImageElement:', e);
      }

      // 3) Fallback A: Data URL
      try {
        const dataUrl = await blobToDataURL(file, 45000);
        const img = await loadImageElement(dataUrl, 30000);
        const out = adaptiveEncode(img.naturalWidth || img.width, img.naturalHeight || img.height, (w, h) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          return canvas;
        });
        resolve(out);
        return;
      } catch (e) {
        console.warn('⚠️ DataURL decode path failed, trying blob:objectURL path:', e);
      }

      // 4) Fallback B: blob: object URL
      let objectUrl: string | null = null;
      try {
        objectUrl = URL.createObjectURL(file);
        const img = await loadImageElement(objectUrl, 30000);
        const out = adaptiveEncode(img.naturalWidth || img.width, img.naturalHeight || img.height, (w, h) => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          return canvas;
        });
        resolve(out);
        return;
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    })().catch((err: any) => {
      console.error('❌ Image conversion failed:', err);
      // Normalize common Android/Google Photos failure into actionable guidance
      const base = `Failed to process image "${file.name}": ${err?.message || err}`;
      let hint = '';
      if (/HEIC|HEIF/i.test(String(err?.message))) {
        hint = '\nHint: On Google Pixel/Photos, export or save the photo as JPEG/PNG first, or take a screenshot.';
      } else if (/timed out|decode|HTMLImageElement onerror/i.test(String(err?.message))) {
        hint = '\nHint: If selected from Google Photos cloud, use "Download/Save to device" then re-upload.';
      }
      reject(new Error(base + hint));
    });
  });
};

export const generateBioFromAnswers = async (
  answers: QuestionnaireAnswers,
  tone?: string,
  refinementSettings?: RefinementSettings,
  currentBio?: string,
  providerOverride?: 'gemini' | 'openai'
): Promise<{ text: string; provider?: 'gemini' | 'openai'; modelVersion?: string }> => {

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

  // Add current bio context for refinements
  let currentBioContext = '';
  if (currentBio && refinementSettings) {
    currentBioContext = `
**CURRENT BIO FOR REFERENCE:**
"${currentBio}"

**REFINEMENT APPROACH:** Use the current bio as a foundation and enhance it with the new targeting preferences below. Keep what works well and improve what doesn't align with the new targeting goals. This is a refinement, not a complete rewrite.
`;
  }

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

${currentBioContext}

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
    // Let the server decide the model from environment (GEMINI_TEXT_MODEL).
    // Passing a non-matching endpoint avoids client-embedded model strings.
    const response = await callGeminiAPI('models/:generateContent', requestBody, 45000, providerOverride);

    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text || "Unable to generate bio. Please try again.";
      return {
        text,
        provider: response.provider,
        modelVersion: response.modelVersion
      };
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
  targetGender?: string,
  onProgress?: (progress: number) => void
): Promise<Array<{ id: string, reason: string }>> => {
  console.log('🔍 Starting photo analysis for', photos.length, 'photos, selecting', numToSelect);
  console.log('📊 Photo sizes:', photos.map(p => ({
    name: p.fileName,
    sizeMB: (p.file.size / (1024 * 1024)).toFixed(2)
  })));

  // Build prompt first so we can estimate overhead and compute a per-image budget
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

  // Compute a rough overhead by stringifying a minimal request with the prompt only
  const minimalPayload = {
    contents: [{ parts: [{ text: prompt }] }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: { temperature: 0.1, maxOutputTokens: 15000 }
  };
  const minimalJsonBytes = JSON.stringify(minimalPayload).length + PROMPT_OVERHEAD_FLOOR_BYTES;
  const n = photos.length;

  // More aggressive compression for mobile - reduce target sizes
  const baseRemaining = Math.max(0, MAX_GEMINI_JSON_BYTES - minimalJsonBytes - (n * IMAGE_PART_OVERHEAD_BYTES));
  const perImageTarget = Math.max(
    80 * 1024, // reduced floor to 80KB
    Math.min(180 * 1024, Math.floor(baseRemaining / Math.max(1, n))) // reduced cap to 180KB
  );

  // More aggressive initial dimension target based on count
  const initialMaxDim = n >= 10 ? 480 : n >= 8 ? 560 : 640;

  console.log('🧮 Budgeting:', {
    MAX_GEMINI_JSON_BYTES,
    minimalJsonBytes,
    images: n,
    perImageTargetKB: Math.round(perImageTarget / 1024),
    initialMaxDim
  });

  // Decide pipeline: default to Cloudinary URL pipeline for robustness on all devices.
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const useUrlPipeline = true; // Always prefer server-fetched URL pipeline
  console.log('🌐 Pipeline selection:', { isAndroid, isMobile, useUrlPipelineDefault: useUrlPipeline });

  type BuildResult = {
    requestBody: any;
    jsonBytes: number;
    idMap: string[]; // simpleId (1-based) -> originalId
  };

  const buildWithInlineData = async (): Promise<BuildResult> => {
    // Helper to encode all photos under a given per-image target and dimension cap
    const encodeAllWith = async (targetBytes: number, maxDim: number) => {
      const converted: Array<{
        originalId: string;
        simpleId: number;
        base64Data: string;
        mimeType: string;
        fileName: string;
      }> = [];
      let totalPayloadSizeBytes = 0;

      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        console.log(`📸 Processing photo ${i + 1}/${photos.length}:`, photo.fileName, { targetBytes, maxDim });

        try {
          const encoded = await convertImageToJPEG(photo.file, {
            targetBytes,
            maxDimension: maxDim,
            minDimension: 320, // reduced from 384
            initialQuality: 0.75, // reduced from 0.85
            minQuality: 0.25, // reduced from 0.35
          });
          const imageBytes = Math.floor(encoded.base64Data.length * 0.75);
          totalPayloadSizeBytes += imageBytes;

          converted.push({
            originalId: photo.id,
            simpleId: i + 1,
            base64Data: encoded.base64Data,
            mimeType: encoded.mimeType,
            fileName: photo.fileName
          });

          console.log(`✅ Photo ${i + 1} processed. Size: ${Math.round(imageBytes / 1024)}KB, Aggregate img bytes: ${Math.round(totalPayloadSizeBytes / 1024)}KB`);
        } catch (error) {
          console.error(`❌ Failed to convert photo ${photo.fileName}:`, error);
          throw new Error(`CONVERT_FAIL: ${String(error)}`);
        }
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string, data: string } }> = [{ text: prompt }];
      converted.forEach(p => parts.push({ inlineData: { mimeType: p.mimeType, data: p.base64Data } }));

      const requestBody = {
        contents: [{ parts }],
        safetySettings: DEFAULT_SAFETY_SETTINGS,
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 15000
        }
      };

      const jsonBytes = JSON.stringify(requestBody).length;
      console.log('📦 Built Gemini request JSON size (bytes):', jsonBytes, 'target cap:', MAX_GEMINI_JSON_BYTES);

      return { converted, requestBody, jsonBytes };
    };

    // More aggressive retry logic with up to 4 attempts
    let attempt = 0;
    let target = perImageTarget;
    let dims = initialMaxDim;

    let temp = await encodeAllWith(target, dims);
    while (temp.jsonBytes > MAX_GEMINI_JSON_BYTES && attempt < 4) {
      attempt++;
      // More aggressive reduction: decrease per-image target, step down dimension
      target = Math.max(60 * 1024, Math.floor(target * 0.7)); // reduced floor to 60KB
      dims = Math.max(320, Math.floor(dims * 0.75)); // reduced floor to 320px
      console.warn(`⚠️ JSON payload too large (${temp.jsonBytes} bytes). Attempt ${attempt + 1}/5: perImageTarget=${Math.round(target / 1024)}KB, maxDim=${dims}`);
      temp = await encodeAllWith(target, dims);
    }

    if (temp.jsonBytes > MAX_GEMINI_JSON_BYTES) {
      throw new Error(`OVERSIZE_JSON: ${temp.jsonBytes}`);
    }

    const idMap = temp.converted.map(c => c.originalId);
    return { requestBody: temp.requestBody, jsonBytes: temp.jsonBytes, idMap };
  };

  const buildWithUrlPipeline = async (maxWidth: number = Math.min(initialMaxDim, 640)): Promise<BuildResult> => {
    console.log('🌐 Using Cloudinary URL pipeline. Uploading for analysis...');
    console.log('📦 URL Pipeline Config:', { maxWidth, photos: photos.length });
    const analysisUrls: string[] = [];
    const idMap: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      console.log(`☁️ Uploading ${i + 1}/${photos.length} to Cloudinary for analysis:`, {
        fileName: p.fileName,
        sizeMB: (p.file.size / (1024 * 1024)).toFixed(2)
      });
      try {
        const { analysis } = await uploadForAnalysis(p.file, maxWidth, (progress) => {
            if (onProgress) {
                const overallProgress = (i + progress / 100) / photos.length * 100;
                onProgress(overallProgress);
            }
        });
        console.log(`✅ Upload successful for ${p.fileName}, URL: ${analysis}`);
        analysisUrls.push(analysis);
        idMap.push(p.id);
      } catch (e) {
        console.error(`❌ Cloudinary analysis upload failed for ${p.fileName}`, e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('🔍 Full error details:', { fileName: p.fileName, error: errorMsg, stack: e instanceof Error ? e.stack : undefined });
        throw new Error(`Cloudinary analysis upload failed for "${p.fileName}": ${errorMsg}`);
      }
    }

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      imageUrls: analysisUrls, // server will fetch and embed inlineData
      safetySettings: DEFAULT_SAFETY_SETTINGS,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 15000
      }
    };

    const jsonBytes = JSON.stringify(requestBody).length;
    console.log('📦 Built URL-pipeline Gemini request JSON size (bytes):', jsonBytes, 'urls:', analysisUrls.length);

    return { requestBody, jsonBytes, idMap };
  };

  let buildResult: BuildResult | null = null;

  // Try URL pipeline first. If it fails because Cloudinary is unconfigured, fallback to inline data.
  console.log('🚀 Attempting to build request payload...');
  try {
    console.log('📤 Trying Cloudinary URL pipeline first...');
    buildResult = await buildWithUrlPipeline(initialMaxDim);
    console.log('✅ Successfully built request with URL pipeline');
  } catch (err) {
    const msg = String((err as Error)?.message || err);
    console.error('❌ URL pipeline error:', {
      message: msg,
      isCloudinaryUnconfigured: msg.includes('CLOUDINARY_UNCONFIGURED'),
      fullError: err
    });
    
    if (msg.includes('CLOUDINARY_UNCONFIGURED')) {
        console.warn('⚠️ Cloudinary is not configured. Falling back to inline data pipeline.');
        console.log('📤 Attempting inline data pipeline as fallback...');
        buildResult = await buildWithInlineData();
        console.log('✅ Successfully built request with inline data pipeline');
    } else {
        console.error('💥 URL pipeline failed and no fallback available:', msg);
        throw new Error(`Photo upload failed: ${msg}`);
    }
  }

  if (!buildResult) {
    throw new Error('Photo analysis preparation failed: no build result.');
  }

  try {
    console.log('🚀 Sending request to Gemini API...');
    const response = await callGeminiAPI('models/:generateContent', buildResult.requestBody, 120000);

    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const text = response.candidates[0].content.parts[0]?.text;
      console.log('📝 Raw Gemini response text length:', text?.length || 0);
      console.log('📝 Response first 500 chars:', text?.substring(0, 500));

      const parsed = parseJsonFromGeminiResponse(text);
      console.log('🔍 Parsed JSON response:', JSON.stringify(parsed, null, 2));

      if (Array.isArray(parsed) && parsed.length === numToSelect) {
        console.log('✅ Photo selection successful!');

        // Map simple IDs (1-based) back to original photo IDs
        const mappedResults = parsed.map((selection: any) => {
          const idx = Number(selection.id);
          if (!Number.isFinite(idx) || idx < 1 || idx > buildResult!.idMap.length) {
            console.error(`❌ Invalid selection id in response:`, selection);
            return null;
          }
          const originalId = buildResult!.idMap[idx - 1];
          return {
            id: originalId,
            reason: selection.reason
          };
        }).filter((item): item is { id: string; reason: string } => !!item);

        console.log('✅ Mapped results:', mappedResults);
        return mappedResults;
      } else {
        console.error('❌ Invalid parsed response:', {
          isArray: Array.isArray(parsed),
          length: (parsed as any)?.length,
          expected: numToSelect,
          actual: parsed
        });
        throw new Error(`Expected ${numToSelect} photo selections, got ${Array.isArray(parsed) ? parsed.length : 0}`);
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
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStatus = error?.status;

    console.error("💥 Photo selection error:", {
      message: errorMessage,
      status: errorStatus,
      name: error?.name,
      stack: error?.stack,
    });

    if (errorStatus === 413 || errorMessage.includes('413')) {
      throw new Error("The uploaded photos are too large, even after compression. Please try selecting fewer photos or using smaller image files.");
    }
    if (errorMessage.includes('timed out')) {
      throw new Error("The photo analysis timed out. This can happen with very large images or a slow connection. Please try again.");
    }
    if (errorMessage.includes('CONVERT_FAIL')) {
       throw new Error(`An image could not be processed. Please check that it's a standard JPEG, PNG, or WebP file and try again. The system reported: ${errorMessage}`);
    }
    if (errorMessage.includes('API Error')) {
      throw new Error(`The AI analysis failed. The server said: "${errorMessage}". This might be a temporary issue. Please try again in a few moments.`);
    }
    
    // Generic fallback
    throw new Error(`Failed to analyze photos. Please try again.`);
  }
};

export const refineBioWithChatFeedback = async (
  currentBio: string,
  feedback: string,
  refinementSettings?: RefinementSettings,
  forceChange: boolean = false,
  providerOverride?: 'gemini' | 'openai'
): Promise<string> => {
  // Add refinement context if available
  let refinementContext = '';
  if (refinementSettings) {
    const vibeString = getVibeString(refinementSettings.targetVibe);
    const goalString = getGoalString(refinementSettings.relationshipGoal);
    const sophisticationString = getSophisticationString(refinementSettings.targetSophistication);

    let simplicityInstruction = '';
    if (refinementSettings.useSimpleLanguage) {
      simplicityInstruction = `**LANGUAGE OVERRIDE:** Use extremely simple, basic English. Short sentences. Common words only. This is MORE IMPORTANT than sophistication settings.`;
    }

    let locationInstruction = '';
    if (refinementSettings.swipeLocation) {
      if (refinementSettings.locationStatus === 'visiting' && refinementSettings.originLocation) {
        locationInstruction = `**Location Context:** User is visiting ${refinementSettings.swipeLocation} from ${refinementSettings.originLocation}. Keep this travel context if relevant.`;
      } else if (refinementSettings.locationStatus === 'living') {
        locationInstruction = `**Location Context:** User lives in ${refinementSettings.swipeLocation}.`;
      }
    }

    refinementContext = `
**TARGETING CONTEXT (maintain these preferences while applying feedback):**
${simplicityInstruction}
- **Target Vibe:** ${vibeString}
- **Dating Goal:** ${goalString}  
- **Target Sophistication:** ${sophisticationString}
${locationInstruction}
- **Additional Context:** ${refinementSettings.additionalInfo || 'None'}
`;
  }

  const prompt = `You are an expert dating profile editor. A user has an existing bio and wants to make a small change. Your task is to subtly edit the bio to incorporate the user's feedback while preserving the original tone and core message. Do not rewrite the entire bio from scratch unless the request requires it.

**Current Bio:**
"${currentBio}"

**User's Request:**
"${feedback}"

${refinementContext}

**CRITICAL RULES:**
- Apply the user's change gracefully and intelligently while maintaining the targeting preferences above
- The edited text MUST be different from the Current Bio; reflect the user's request clearly (even if small)
- Keep the bio short, modern, and engaging (around 45 words)
- Your response MUST BE ONLY the edited bio text itself. No introductions, no explanations, no markdown. Just the pure bio text.
${forceChange ? '**FORCE CHANGE:** The edited bio MUST be noticeably different from the Current Bio. Make at least one substantive change (wording, tone, structure) that clearly reflects the user’s request.' : ''}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    generationConfig: {
      temperature: forceChange ? 0.3 : 0.1,  // Slightly higher when forcing change
      maxOutputTokens: 200
    }
  };

  try {
    // Server-side env decides the model (no client-side baked model)
    const response = await callGeminiAPI('models/:generateContent', requestBody, 30000, providerOverride);

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