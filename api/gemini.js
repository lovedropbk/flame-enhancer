export default async function handler(req, res) {
  // Enhanced logging for debugging
  console.log('🚀 API Handler called:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.keys(req.headers),
    hasBody: !!req.body
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log('❌ Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  
  // Enhanced API key debugging (without exposing the key)
  console.log('🔑 API Key check:', {
    exists: !!API_KEY,
    length: API_KEY?.length || 0,
    prefix: API_KEY?.substring(0, 8) || 'none',
    envVars: Object.keys(process.env).filter(key => key.includes('GEMINI')),
    allEnvKeys: Object.keys(process.env).length
  });
  
  if (!API_KEY) {
    console.error('GEMINI_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { endpoint, body } = req.body;
    
    console.log('📥 Received request:', {
      endpoint,
      bodyStructure: {
        contents: body?.contents?.length || 0,
        safetySettings: body?.safetySettings?.length || 0,
        generationConfig: !!body?.generationConfig
      }
    });
    
    if (!endpoint || !body) {
      console.error('❌ Missing required fields:', { endpoint: !!endpoint, body: !!body });
      return res.status(400).json({ error: 'Missing endpoint or body' });
    }

    const fullUrl = `https://generativelanguage.googleapis.com/v1beta/${endpoint}?key=${API_KEY}`;
    console.log('🔗 Making request to endpoint:', endpoint);
    
    // Log the size of the request
    const requestBody = JSON.stringify(body);
    console.log('📊 Request details:', {
      endpoint,
      requestSizeKB: Math.round(requestBody.length / 1024),
      hasContents: !!body.contents,
      contentsLength: body.contents?.length || 0,
      hasSafetySettings: !!body.safetySettings,
      hasGenerationConfig: !!body.generationConfig
    });

    // Additional logging for photo selection requests
    if (body.contents && body.contents[0] && body.contents[0].parts) {
      const parts = body.contents[0].parts;
      const textParts = parts.filter(p => p.text);
      const imageParts = parts.filter(p => p.inlineData);
      
      console.log('📸 Photo selection request details:', {
        totalParts: parts.length,
        textParts: textParts.length,
        imageParts: imageParts.length,
        promptPreview: textParts[0]?.text?.substring(0, 200) + '...'
      });
    }
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

    console.log('📡 Response status:', response.status, response.statusText);
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: data
      });
      return res.status(response.status).json({
        error: data.error?.message || data.message || 'API request failed',
        details: data,
        status: response.status
      });
    }

    console.log('✅ Success response structure:', {
      candidates: data.candidates?.length || 0,
      usageMetadata: !!data.usageMetadata
    });

    // Detailed response analysis
    if (data.candidates && data.candidates[0]) {
      const candidate = data.candidates[0];
      console.log('📝 First candidate analysis:', {
        hasContent: !!candidate.content,
        hasParts: !!candidate.content?.parts,
        partsLength: candidate.content?.parts?.length || 0,
        firstPartType: candidate.content?.parts?.[0] ? Object.keys(candidate.content.parts[0])[0] : 'none',
        textLength: candidate.content?.parts?.[0]?.text?.length || 0,
        textPreview: candidate.content?.parts?.[0]?.text?.substring(0, 200) || 'no text'
      });
    }

    // Log the complete response from Google's Gemini API
    console.log('🔍 Complete Google Gemini API Response:', JSON.stringify(data, null, 2));

    res.status(200).json(data);
  } catch (error) {
    console.error('💥 Server error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      type: error.name
    });
  }
}