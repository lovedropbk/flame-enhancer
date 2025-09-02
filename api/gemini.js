import { GoogleGenerativeAI } from "@google/generative-ai";
import { v2 as cloudinary } from "cloudinary";

const isCloudinaryConfigured =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
    console.warn("⚠️ Cloudinary credentials are not fully configured. Direct upload will be disabled.");
}

// Helper utilities for detailed logging/measurement on server side
const ESTIMATE_BYTES_FROM_BASE64 = (charLen) => Math.floor((charLen || 0) * 0.75);
const safeJsonLength = (obj) => {
  try { return JSON.stringify(obj).length; } catch { return -1; }
};
// Soft caps for observability; requests over ~4.5MB may be rejected by the platform before reaching this code
const SERVER_JSON_SOFT_WARN = 3_900_000; // ~3.9MB
const INLINE_BYTES_SOFT_WARN = 3_400_000; // ~3.4MB worth of base64 payload (raw decoded bytes)

async function fetchUrlAsInlineData(url, index) {
  // Force JPEG format from Cloudinary, as JXL etc. are not supported by Gemini.
  const fetchUrl = url.replace(/\.jxl$/, ".jpg");
  console.log("🌐 Fetching image URL for inlineData", { index, originalUrl: url, fetchUrl });

  let resp;
  try {
    resp = await fetch(fetchUrl);
  } catch (e) {
    console.error("❌ Failed to fetch image URL", { index, fetchUrl, error: e?.message || String(e) });
    throw new Error(`Failed to fetch image for analysis at ${fetchUrl}: ${e?.message || e}`);
  }

  if (!resp.ok) {
    console.error("❌ Non-OK response when fetching image", {
      index, fetchUrl, status: resp.status, statusText: resp.statusText,
    });
    throw new Error(`Image fetch failed: ${resp.status} ${resp.statusText}`);
  }

  // Always treat the fetched image as JPEG, as that's what we requested.
  const mimeType = "image/jpeg";
  const ab = await resp.arrayBuffer();
  const b64 = Buffer.from(new Uint8Array(ab)).toString("base64");
  return { mimeType, data: b64, rawBytes: ab.byteLength };
}

export default async function handler(req, res) {
  // Enhanced logging for debugging
  const serverBodyLen = safeJsonLength(req.body);
  console.log("🚀 API Handler called:", {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers),
    hasBody: !!req.body,
    approxJsonBodyBytes: serverBodyLen,
  });

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    console.log("✅ OPTIONS request handled");
    res.status(200).end();
    return;
  }


  if (req.method !== "POST") {
    console.log("❌ Invalid method:", req.method);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const provider = (
    typeof (req.body?.provider) === "string" && req.body.provider
      ? req.body.provider
      : (process.env.AI_PROVIDER || "gemini")
  ).toLowerCase();
  const { endpoint, body } = req.body || {};

  console.log("🤖 Provider selection:", { provider });
  console.log("📥 Received request:", {
    endpoint,
    bodyStructure: {
      contents: body?.contents?.length || 0,
      safetySettings: body?.safetySettings?.length || 0,
      generationConfig: !!body?.generationConfig,
      imageUrls: Array.isArray(body?.imageUrls) ? body.imageUrls.length : 0,
    },
  });

  // Preflight body-size observability (note: 413 may still occur upstream before this code runs)
  if (serverBodyLen > SERVER_JSON_SOFT_WARN) {
    console.warn("⚠️ Server observed large JSON payload:", {
      approxJsonBodyBytes: serverBodyLen,
      warnThreshold: SERVER_JSON_SOFT_WARN,
      note: "If you see client-side 413 and no server logs, the edge rejected the request before invocation.",
    });
  }

  if (provider === "gemini") {
    const API_KEY = process.env.GOOGLE_GENAI_API_KEY;

    console.log("🔑 Google GenAI Key check:", {
      exists: !!API_KEY,
      length: API_KEY?.length || 0,
      prefix: API_KEY?.substring(0, 8) || "none",
      envVars: Object.keys(process.env).filter((key) => key.includes("GOOGLE") || key.includes("GENAI")),
      allEnvKeys: Object.keys(process.env).length,
    });

    if (!API_KEY) {
      console.error("GOOGLE_GENAI_API_KEY not found in environment variables");
      return res.status(500).json({ error: "API key not configured" });
    }

    // Extract model from endpoint like "models/<model>:generateContent"
    let modelName;
    if (typeof endpoint === "string") {
      const m = endpoint.match(/^models\/([^:]+)(?::.*)?$/);
      if (m) modelName = m[1];
    }
    if (!modelName) modelName = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

    try {
      const genAI = new GoogleGenerativeAI(API_KEY);
      const model = genAI.getGenerativeModel({ model: modelName });

      // Normalize Gemini generationConfig to the correct field (maxOutputTokens)
      const rawGen = typeof body?.generationConfig === "object" && body.generationConfig ? body.generationConfig : {};
      let normalizedGen = { ...rawGen };
      const candidateMax =
        typeof rawGen.maxOutputTokens === "number"
          ? rawGen.maxOutputTokens
          : typeof rawGen.max_completion_tokens === "number"
          ? rawGen.max_completion_tokens
          : typeof rawGen.max_tokens === "number"
          ? rawGen.max_tokens
          : undefined;
      if (typeof candidateMax === "number") {
        normalizedGen = { ...rawGen, maxOutputTokens: candidateMax };
        delete normalizedGen.max_completion_tokens;
        delete normalizedGen.max_tokens;
      }

      const requestPayload = {
        contents: Array.isArray(body?.contents) ? body.contents : [],
        ...(body?.safetySettings ? { safetySettings: body.safetySettings } : {}),
        ...(Object.keys(normalizedGen).length ? { generationConfig: normalizedGen } : {}),
      };

      // If client provided external image URLs (e.g., Cloudinary analysis URLs),
      // fetch them server-side and append as inlineData so Gemini sees all images in one call.
      const externalUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
      let fetchedBytesTotal = 0;
      if (externalUrls.length > 0) {
        console.log("🧩 imageUrls provided by client; server will fetch and embed as inlineData", {
          count: externalUrls.length,
        });

        if (!requestPayload.contents?.[0]) {
          requestPayload.contents = [{ parts: [] }];
        } else if (!Array.isArray(requestPayload.contents[0].parts)) {
          requestPayload.contents[0].parts = [];
        }
        const partsArray = requestPayload.contents[0].parts;

        for (let i = 0; i < externalUrls.length; i++) {
          const { mimeType, data, rawBytes } = await fetchUrlAsInlineData(externalUrls[i], i + 1);
          fetchedBytesTotal += rawBytes;
          partsArray.push({ inlineData: { mimeType, data } });
        }

        console.log("🧾 Embedded images from URLs", {
          count: externalUrls.length,
          fetchedBytesTotal,
          fetchedMB: +(fetchedBytesTotal / (1024 * 1024)).toFixed(2),
        });
      }

      // Detailed Gemini request observability (post-augmentation)
      const parts = requestPayload?.contents?.[0]?.parts || [];
      const textPart = parts.find((p) => typeof p?.text === "string")?.text || "";
      const imageParts = parts.filter((p) => !!p?.inlineData);
      const totalInlineBase64Chars = imageParts.reduce((acc, p) => acc + (p?.inlineData?.data?.length || 0), 0);
      const totalInlineBytes = ESTIMATE_BYTES_FROM_BASE64(totalInlineBase64Chars);

      console.log("📊 Gemini request details:", {
        endpoint,
        modelName,
        hasText: !!textPart,
        imageParts: imageParts.length,
        inlineBytesApprox: totalInlineBytes,
        inlineMB: +(totalInlineBytes / (1024 * 1024)).toFixed(2),
        promptPreview: (textPart?.substring(0, 200) || "") + "...",
      });

      if (totalInlineBytes > INLINE_BYTES_SOFT_WARN) {
        console.warn("⚠️ Large inlineData payload detected:", {
          inlineBytesApprox: totalInlineBytes,
          warnThreshold: INLINE_BYTES_SOFT_WARN,
          advisory: "Client should downsize images further; mobile/edge may reject > ~4MB total JSON.",
        });
      }

      const result = await model.generateContent(requestPayload);
      const resp = result?.response;

      if (modelName.includes("image")) {
        const imagePart = resp?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
        if (imagePart) {
          const geminiShaped = {
            provider: "gemini",
            candidates: [
              {
                content: {
                  parts: [imagePart],
                },
              },
            ],
            usageMetadata: resp?.usageMetadata,
            modelVersion: modelName,
          };
          return res.status(200).json(geminiShaped);
        }
      }

      let assistantText = "";
      try {
        assistantText = resp?.text?.() ?? "";
      } catch {
        assistantText =
          resp?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === "string")?.text ??
          "";
      }

      console.log("📝 Gemini completion length:", assistantText?.length || 0);
      console.log("📝 Gemini completion preview:", assistantText?.substring(0, 200) || "no text");

      const geminiShaped = {
        provider: "gemini",
        candidates: [
          {
            content: {
              parts: [{ text: assistantText }],
            },
          },
        ],
        usageMetadata: resp?.usageMetadata,
        modelVersion: modelName,
      };

      console.log("✅ Success response structure (Gemini-shaped):", {
        candidates: geminiShaped.candidates?.length || 0,
        usageMetadata: !!geminiShaped.usageMetadata,
        modelVersion: geminiShaped.modelVersion,
        firstCandidateTextLength:
          geminiShaped.candidates?.[0]?.content?.parts?.[0]?.text?.length || 0,
        firstCandidateTextPreview:
          geminiShaped.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 200) ||
          "no text",
      });

      console.log(
        "🔍 Complete Gemini-shaped Response:",
        JSON.stringify(geminiShaped, null, 2)
      );

      return res.status(200).json(geminiShaped);
    } catch (error) {
      console.error("💥 Google GenAI server error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return res.status(500).json({
        error: "Gemini request failed",
        details: error.message,
        type: error.name,
      });
    }
  } else {
    // OPENAI branch (default fallback)
    const API_KEY = process.env.OPENAI_API_KEY;

    // Enhanced API key debugging (without exposing the key)
    console.log("🔑 OpenAI API Key check:", {
      exists: !!API_KEY,
      length: API_KEY?.length || 0,
      prefix: API_KEY?.substring(0, 8) || "none",
      envVars: Object.keys(process.env).filter((key) => key.includes("OPENAI")),
      allEnvKeys: Object.keys(process.env).length,
    });

    if (!API_KEY) {
      console.error("OPENAI_API_KEY not found in environment variables");
      return res.status(500).json({ error: "API key not configured" });
    }

    try {
      if (!body) {
        console.error("❌ Missing required fields:", { body: !!body });
        return res.status(400).json({ error: "Missing body" });
      }

      // Extract prompt and images from Gemini-style request
      const partsBase = body?.contents?.[0]?.parts || [];
      const textPart = partsBase.find((p) => typeof p?.text === "string")?.text || "";
      const imagePartsInline = partsBase
        .filter((p) => !!p?.inlineData)
        .map((p) => ({
          mimeType: p.inlineData.mimeType,
          data: p.inlineData.data, // base64 without prefix
        }));

      const externalUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];

      // Prepare OpenAI Chat Completions payload (supports multimodal via image_url)
      const openAiMessages = [];
      const content = [];

      if (textPart) {
        content.push({ type: "text", text: textPart });
      }

      // Inline base64 → data: URL
      for (const img of imagePartsInline) {
        const url = `data:${img.mimeType};base64,${img.data}`;
        content.push({ type: "image_url", image_url: { url } });
      }

      // External URLs can be passed directly as image_url to OpenAI (when supported by model)
      for (const url of externalUrls) {
        content.push({ type: "image_url", image_url: { url } });
      }

      if (content.length > 0) {
        openAiMessages.push({ role: "user", content });
      } else {
        openAiMessages.push({ role: "user", content: textPart });
      }

      // Map generation config
      const rawTemperature =
        typeof body?.generationConfig?.temperature === "number"
          ? body.generationConfig.temperature
          : undefined;
      // gpt-5-mini only supports default temperature. Omit unless exactly 1.
      const temperatureParam = rawTemperature === 1 ? 1 : undefined;

      const model = process.env.OPENAI_MODEL || "gpt-5-mini";

      // Resolve tokens field deterministically based on model family (no trial-and-error)
      const rawMaxOutputTokens =
        typeof body?.generationConfig?.maxOutputTokens === "number"
          ? body.generationConfig.maxOutputTokens
          : undefined;
      const maxTokensValue =
        typeof rawMaxOutputTokens === "number"
          ? Math.min(rawMaxOutputTokens, 4096)
          : undefined;

      // Optional explicit override: OPENAI_TOKENS_FIELD=max_tokens|max_completion_tokens
      const explicitTokensField = String(process.env.OPENAI_TOKENS_FIELD || "").trim();
      let tokensField;
      if (explicitTokensField === "max_tokens" || explicitTokensField === "max_completion_tokens") {
        tokensField = explicitTokensField;
      } else if (String(process.env.OPENAI_USE_MAX_TOKENS || "").toLowerCase() === "1") {
        tokensField = "max_tokens";
      } else {
        const m = String(model).toLowerCase();
        // Newer OpenAI models require 'max_completion_tokens' on Chat Completions:
        // gpt-4o*, gpt-4.1*, gpt-5*, o3*, o4*
        const needsCompletionField =
          m.startsWith("gpt-4o") ||
          m.startsWith("gpt-4.1") ||
          m.startsWith("gpt-5") ||
          m.startsWith("o3") ||
          m.startsWith("o4") ||
          m.includes("4o-") ||
          m.includes("4.1-");
        tokensField = needsCompletionField ? "max_completion_tokens" : "max_tokens";
      }
      const openAiPayload = {
        model,
        messages: openAiMessages,
        ...(temperatureParam !== undefined ? { temperature: temperatureParam } : {}),
      };
      if (maxTokensValue !== undefined) {
        openAiPayload[tokensField] = maxTokensValue;
      }

      // Log size and structure
      const requestBody = JSON.stringify(openAiPayload);
      console.log("📊 OpenAI request details:", {
        endpoint: "chat.completions",
        requestSizeKB: Math.round(requestBody.length / 1024),
        hasImages: imagePartsInline.length + externalUrls.length > 0,
        hasText: !!textPart,
        temperature: temperatureParam,
        tokensField,
        tokensValue: maxTokensValue,
      });

      let response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      console.log("📡 OpenAI Response status:", response.status, response.statusText);

      let data = await response.json();

      if (!response.ok) {
        console.error("❌ OpenAI API error:", {
          status: response.status,
          statusText: response.statusText,
          error: data,
          model,
          tokensField,
        });
        return res.status(response.status).json({
          error: data.error?.message || data.message || "OpenAI request failed",
          details: data,
          status: response.status,
        });
      }

      // Extract assistant text
      const assistantText =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.message?.content?.[0]?.text ??
        "";

      console.log("📝 OpenAI completion length:", assistantText?.length || 0);
      console.log("📝 OpenAI completion preview:", assistantText?.substring(0, 200) || "no text");

      // Map to Gemini-shaped response so frontend remains unchanged
      const geminiShaped = {
        provider: "openai",
        candidates: [
          {
            content: {
              parts: [{ text: assistantText }],
            },
          },
        ],
        usageMetadata: {
          promptTokens: data?.usage?.prompt_tokens,
          candidatesTokens: data?.usage?.completion_tokens,
          totalTokenCount: data?.usage?.total_tokens,
        },
        modelVersion: model,
      };

      // Detailed response analysis for compatibility with existing logs
      console.log("✅ Success response structure (Gemini-shaped):", {
        candidates: geminiShaped.candidates?.length || 0,
        usageMetadata: !!geminiShaped.usageMetadata,
        modelVersion: geminiShaped.modelVersion,
        firstCandidateTextLength:
          geminiShaped.candidates?.[0]?.content?.parts?.[0]?.text?.length || 0,
        firstCandidateTextPreview:
          geminiShaped.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 200) ||
          "no text",
      });

      // Log the complete transformed response for debugging
      console.log(
        "🔍 Complete Gemini-shaped Response:",
        JSON.stringify(geminiShaped, null, 2)
      );

      return res.status(200).json(geminiShaped);
    } catch (error) {
      console.error("💥 OpenAI server error:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return res.status(500).json({
        error: "Internal server error",
        details: error.message,
        type: error.name,
      });
    }
  }
}