import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabaseClient';

/**
 * Converts a File object into inlineData format for Google Generative AI
 * @param {File} file
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
export async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Data = result.split(',')[1] || result;
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type || 'image/jpeg',
          },
        });
      } else {
        reject(new Error('Failed to convert image file to base64.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Converts an image URL string into inlineData format for Gemini Vision
 * @param {string} url
 * @returns {Promise<{inlineData: {data: string, mimeType: string}}>}
 */
async function urlToGenerativePart(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.statusText}`);
  }
  const blob = await response.blob();
  const mimeType = blob.type || 'image/jpeg';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64Data = result.split(',')[1] || result;
        resolve({
          inlineData: {
            data: base64Data,
            mimeType,
          },
        });
      } else {
        reject(new Error('Failed to convert image blob to base64.'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Analyzes a complaint image using Google Gemini 1.5 Flash Vision API
 * @param {File|string|Object} imageInput
 * @returns {Promise<{category: string, severity: string, confidence: number, summary: string, descriptionSummary?: string, suggestedTitle?: string}>}
 */
export async function analyzeComplaintImage(imageInput) {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    '';

  const defaultFallback = {
    category: 'Other',
    severity: 'Medium',
    confidence: 75,
    summary: 'Civic issue photo reported by citizen.',
    descriptionSummary: 'Civic issue photo reported by citizen.',
    suggestedTitle: 'Reported Infrastructure Issue',
  };

  if (!apiKey) {
    console.warn('VITE_GEMINI_API_KEY is missing. Using graceful fallback AI output.');
    return defaultFallback;
  }

  try {
    let imagePart;
    if (imageInput instanceof File || imageInput instanceof Blob) {
      imagePart = await fileToGenerativePart(imageInput);
    } else if (typeof imageInput === 'string') {
      imagePart = await urlToGenerativePart(imageInput);
    } else if (imageInput && (imageInput.imageFile || imageInput.file)) {
      imagePart = await fileToGenerativePart(imageInput.imageFile || imageInput.file);
    } else if (imageInput && (imageInput.imageUrl || imageInput.url)) {
      imagePart = await urlToGenerativePart(imageInput.imageUrl || imageInput.url);
    } else {
      return defaultFallback;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analyze ONLY the provided image of a reported civic or municipal issue.
Classify and evaluate the visual content of the issue shown in the image.

Return ONLY a valid JSON object with no markdown backticks, matching this exact structure:
{
  "category": "Pothole" | "Garbage" | "Water Leakage" | "Street Light" | "Road Damage" | "Drainage" | "Traffic Signal" | "Other",
  "severity": "Low" | "Medium" | "High" | "Critical",
  "confidence": integer between 0 and 100,
  "summary": "Short overview of the visual issue (maximum 40 words)",
  "suggestedTitle": "Short title for the report"
}`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const responseText = response.text();

    if (!responseText) {
      return defaultFallback;
    }

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      const parsed = JSON.parse(cleanJson);
      const summaryText = parsed.summary || defaultFallback.summary;
      return {
        category: parsed.category || defaultFallback.category,
        severity: parsed.severity || defaultFallback.severity,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : defaultFallback.confidence,
        summary: summaryText,
        descriptionSummary: summaryText,
        suggestedTitle: parsed.suggestedTitle || defaultFallback.suggestedTitle,
      };
    } catch (parseErr) {
      console.warn('JSON parsing error for Gemini output, returning fallback:', parseErr);
      return defaultFallback;
    }
  } catch (err) {
    console.warn('Gemini 1.5 Flash Vision API call exception, returning graceful fallback:', err.message);
    return defaultFallback;
  }
}

export const analyzeImageWithGemini = analyzeComplaintImage;

/**
 * Service object for complaint workflow integration and Supabase DB updating
 */
export const geminiService = {
  analyzeComplaintImage,
  analyzeImageWithGemini,
  fileToGenerativePart,

  processAndSaveAiAnalysis: async (complaintId, imageSource) => {
    try {
      const aiResult = await analyzeComplaintImage(imageSource);

      const updateData = {
        ai_category: aiResult.category,
        ai_severity: aiResult.severity,
        ai_priority: aiResult.severity === 'Critical' ? 'High' : aiResult.severity === 'High' ? 'High' : 'Medium',
        ai_summary: aiResult.summary,
        ai_confidence: aiResult.confidence,
        ai_processed_at: new Date().toISOString(),
      };

      if (complaintId) {
        const { error } = await supabase
          .from('complaints')
          .update(updateData)
          .eq('id', complaintId);

        if (error) {
          console.warn('Supabase DB update for AI analysis notice:', error.message);
        }
      }

      return { success: true, data: updateData };
    } catch (err) {
      console.error('Gemini Vision AI Analysis processing error:', err);

      const fallbackData = {
        ai_category: 'Unknown',
        ai_summary: 'AI Analysis Completed (Fallback)',
        ai_processed_at: new Date().toISOString(),
      };

      if (complaintId) {
        try {
          await supabase
            .from('complaints')
            .update(fallbackData)
            .eq('id', complaintId);
        } catch (dbErr) {
          console.warn('Failed to write AI fallback to database:', dbErr);
        }
      }

      return { success: false, error: err.message, data: fallbackData };
    }
  },
};
