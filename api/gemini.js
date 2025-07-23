export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  
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

    const url = `https://generativelanguage.googleapis.com/v1beta/${endpoint}?key=${API_KEY.substring(0, 10)}...`;
    console.log('🔗 Making request to:', url.replace(API_KEY.substring(0, 10), 'API_KEY'));
    
    // Log the size of the request
    const requestBody = JSON.stringify(body);
    console.log('📊 Request size:', Math.round(requestBody.length / 1024), 'KB');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${endpoint}?key=${API_KEY}`, {
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