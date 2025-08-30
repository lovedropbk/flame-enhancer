export default async function handler(req, res) {
  // Enhanced logging for debugging
  console.log("🚀 API Handler called:", {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers),
    hasBody: !!req.body,
  });

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

  const API_KEY = process.env.OPENAI_API_KEY;

  // Enhanced API key debugging (without exposing the key)
  console.log("🔑 API Key check:", {
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
    const { endpoint, body } = req.body || {};

    console.log("📥 Received request:", {
      endpoint,
      bodyStructure: {
        contents: body?.contents?.length || 0,
        safetySettings: body?.safetySettings?.length || 0,
        generationConfig: !!body?.generationConfig,
      },
    });

    if (!body) {
      console.error("❌ Missing required fields:", { body: !!body });
      return res.status(400).json({ error: "Missing body" });
    }

    // Extract prompt and images from Gemini-style request
    const parts = body?.contents?.[0]?.parts || [];
    const textPart = parts.find((p) => typeof p?.text === "string")?.text || "";
    const imageParts = parts
      .filter((p) => !!p?.inlineData)
      .map((p) => ({
        mimeType: p.inlineData.mimeType,
        data: p.inlineData.data, // base64 without prefix
      }));

    // Prepare OpenAI Chat Completions payload (supports multimodal via image_url)
    // We intentionally retain the "gemini" endpoint path so the frontend does not change.
    const openAiMessages = [];

    if (imageParts.length > 0) {
      // Multimodal message: text + images
      const content = [];

      if (textPart) {
        content.push({ type: "text", text: textPart });
      }

      // Convert inlineData to data: URL that OpenAI accepts in image_url
      for (const img of imageParts) {
        const url = `data:${img.mimeType};base64,${img.data}`;
        content.push({
          type: "image_url",
          image_url: { url },
        });
      }

      openAiMessages.push({
        role: "user",
        content,
      });

      console.log("📸 Photo selection request details:", {
        totalParts: parts.length,
        textPartPresent: !!textPart,
        imageParts: imageParts.length,
        promptPreview: textPart?.substring(0, 200) + "...",
      });
    } else {
      // Text-only message
      openAiMessages.push({
        role: "user",
        content: textPart,
      });
    }

    // Map generation config
    const rawTemperature =
      typeof body?.generationConfig?.temperature === "number"
        ? body.generationConfig.temperature
        : undefined;
    // gpt-5-mini only supports default temperature. Omit unless exactly 1.
    const temperatureParam = rawTemperature === 1 ? 1 : undefined;

    // Map Gemini maxOutputTokens to OpenAI Chat Completions "max_completion_tokens"
    // Clamp to a safe upper bound to avoid model limit errors.
    const rawMaxCompletionTokens =
      typeof body?.generationConfig?.maxOutputTokens === "number"
        ? body.generationConfig.maxOutputTokens
        : undefined;
    const max_completion_tokens =
      typeof rawMaxCompletionTokens === "number"
        ? Math.min(rawMaxCompletionTokens, 4096)
        : undefined;

    const openAiPayload = {
      model: "gpt-5-mini",
      messages: openAiMessages,
      ...(temperatureParam !== undefined ? { temperature: temperatureParam } : {}),
      ...(max_completion_tokens !== undefined ? { max_completion_tokens } : {}),
    };

    // Log size and structure
    const requestBody = JSON.stringify(openAiPayload);
    console.log("📊 OpenAI request details:", {
      endpoint: "chat.completions",
      requestSizeKB: Math.round(requestBody.length / 1024),
      hasImages: imageParts.length > 0,
      hasText: !!textPart,
      temperature: temperatureParam,
      max_completion_tokens,
    });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    console.log("📡 OpenAI Response status:", response.status, response.statusText);

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ OpenAI API error:", {
        status: response.status,
        statusText: response.statusText,
        error: data,
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
      modelVersion: "gpt-5-mini",
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

    res.status(200).json(geminiShaped);
  } catch (error) {
    console.error("💥 Server error:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
      type: error.name,
    });
  }
}