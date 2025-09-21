const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const pdf = require('pdf-parse');
require('dotenv').config();

const app = express();

const cors = require('cors');
app.use(cors({ origin: "https://legaldocument.vercel.app" }));

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and text files are allowed'));
    }
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Validate environment variables
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

/**
 * Builds a comprehensive prompt for Gemini to analyze legal documents
 */
function buildLegalAnalysisPrompt(text, query = null) {
  const basePrompt = `You are an expert legal document analyst. Analyze the following legal text and provide a comprehensive breakdown.

LEGAL TEXT:
"${text}"

${query ? `SPECIFIC QUESTION: "${query}"` : ''}

Please provide a detailed analysis in the following JSON format:

{
  "simplified": "A clear, plain English explanation of the document's main points, preserving all important details and legal implications. Break down complex clauses into understandable language.",
  "riskAssessment": {
    "overallRisk": "low/medium/high",
    "riskFactors": [
      {
        "clause": "Specific clause or section",
        "risk": "high/medium/low",
        "explanation": "Why this is risky and what it means for the user",
        "impact": "Financial/Legal/Operational impact description"
      }
    ]
  },
  "keyTerms": [
    {
      "term": "Legal term or phrase",
      "definition": "Simple explanation of what this means",
      "importance": "Why this term matters"
    }
  ],
  "actionItems": [
    {
      "action": "What the user should do",
      "priority": "high/medium/low",
      "deadline": "When this should be done (if applicable)"
    }
  ],
  "warnings": [
    "Important warnings or red flags the user should be aware of"
  ]
}

Important guidelines:
1. Focus on making complex legal language accessible to non-lawyers
2. Highlight potential risks and their real-world implications
3. Identify terms that could be problematic or unfair
4. Provide actionable advice where appropriate
5. Be objective but help users understand what they're agreeing to
6. If analyzing a specific question, prioritize that in your response

Respond ONLY with valid JSON - no additional text or formatting.`;

  return basePrompt;
}

// Serve the main HTML file at root
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Backend is running ✅' });
});

/**
 * POST /analyze - Analyze legal documents (text input)
 */
app.post('/analyze', async (req, res) => {
  try {
    const { text, query } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Text content is required'
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Text must be less than 10,000 characters'
      });
    }

    console.log(`🔍 Analyzing legal text (${text.length} characters)`);

    const prompt = buildLegalAnalysisPrompt(text, query);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    console.log('📥 Gemini analysis response received');

    // Parse JSON response
    let analysisData;
    try {
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(500).json({
        error: 'API Processing Error',
        message: 'Failed to parse analysis from AI service'
      });
    }

    // Validate response structure
    if (!analysisData.simplified || !analysisData.riskAssessment) {
      return res.status(500).json({
        error: 'API Processing Error',
        message: 'Invalid analysis response structure'
      });
    }

    const responseData = {
      ...analysisData,
      metadata: {
        timestamp: new Date().toISOString(),
        textLength: text.length,
        hasQuery: !!query
      }
    };

    console.log('✅ Legal analysis completed successfully');
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error in /analyze:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while analyzing the document'
    });
  }
});

/**
 * POST /upload - Analyze uploaded legal documents
 */
app.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'No file uploaded'
      });
    }

    console.log(`📄 Processing uploaded file: ${req.file.originalname}`);

    let extractedText = '';

    // Extract text based on file type
    if (req.file.mimetype === 'application/pdf') {
      const pdfBuffer = fs.readFileSync(req.file.path);
      const pdfData = await pdf(pdfBuffer);
      extractedText = pdfData.text;
    } else if (req.file.mimetype === 'text/plain') {
      extractedText = fs.readFileSync(req.file.path, 'utf8');
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    if (!extractedText.trim()) {
      return res.status(400).json({
        error: 'Processing Error',
        message: 'Could not extract text from the uploaded file'
      });
    }

    // Truncate if too long
    if (extractedText.length > 10000) {
      extractedText = extractedText.substring(0, 10000) + '...';
    }

    // Analyze the extracted text
    const prompt = buildLegalAnalysisPrompt(extractedText, req.body.query);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    let analysisData;
    try {
      const cleanText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('❌ JSON parsing error:', parseError);
      return res.status(500).json({
        error: 'API Processing Error',
        message: 'Failed to parse analysis from AI service'
      });
    }

    const responseData = {
      ...analysisData,
      metadata: {
        timestamp: new Date().toISOString(),
        fileName: req.file.originalname,
        fileSize: req.file.size,
        textLength: extractedText.length
      }
    };

    console.log('✅ File analysis completed successfully');
    res.json(responseData);

  } catch (error) {
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('❌ Error in /upload:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing the file'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Legal Document Simplifier',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File Error',
        message: 'File size too large. Maximum size is 10MB.'
      });
    }
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/analyze') || req.path.startsWith('/upload')) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} not found`
    });
  }

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Legal Document Simplifier running on http://localhost:${PORT}`);
});