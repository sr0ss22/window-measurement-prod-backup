import { NextResponse } from 'next/server';
import axios from 'axios';
import { model } from '@/integrations/gemini/client'; // Import the Gemini model
import type { FormField } from '@/types/form-config';

// Helper function to clean the transcript
function cleanTranscript(text: string): string {
  let cleanedText = text
    .replace(/\b(um|uh|er|ah)\b/g, '') // Remove common filler words
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim(); // Trim whitespace
  
  // Remove consecutive duplicate words (e.g., "the the" -> "the")
  const words = cleanedText.split(' ');
  const uniqueWords = words.filter((word, index) => word !== words[index - 1]);
  return uniqueWords.join(' ');
}

async function transcribe(audioBlob: Blob, token: string) {
  const transcriptionModel = 'openai/whisper-large-v3';
  let contentType = audioBlob.type;
  if (contentType.includes(';')) {
    contentType = contentType.split(';')[0];
  }

  try {
    const whisperResponse = await axios.post(
      `https://api-inference.huggingface.co/models/${transcriptionModel}`,
      audioBlob,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': contentType,
          'Accept': 'application/json',
        },
        timeout: 60000,
      }
    );
    return whisperResponse.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Transcribe: Axios error during transcription:', {
        status: error.response?.status,
        data: error.response?.data, // Log full response data
        headers: error.response?.headers,
      });
      if (error.response?.data?.error?.includes('is currently loading')) {
        throw new Error('AI model is loading, please try again in a few moments.');
      }
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Hugging Face authentication failed. Please check your HUGGINGFACE_TOKEN and permissions.');
      }
      // Catch any other Axios errors and re-throw with more context
      throw new Error(`Transcription service error: ${error.message} (Status: ${error.response?.status || 'N/A'})`);
    }
    // Re-throw other unexpected errors
    throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function extractData(transcript: string, fields: FormField[], currentData: Record<string, any>, customRules: string | null, aiTask: string | null) {
  if (!model) {
    throw new Error("Gemini model is not initialized. Please check server logs for API key issues.");
  }

  const fieldDescriptions = fields.map(field => {
    // Only include fields relevant for extraction in the description
    if (field.id === 'comments' && aiTask === 'extract_measurements') {
      return null; // Don't describe comments field if only extracting measurements
    }
    const currentValue = currentData[field.id];
    const valueInfo = currentValue !== undefined && currentValue !== null && currentValue !== '' ? `Current Value: "${currentValue}"` : "Current Value: (empty)";
    let description = `- Field Name: "${field.name}", ID: "${field.id}", Type: "${field.type}". ${valueInfo}`;
    if (field.type === 'picklist' || field.type === 'radio' || field.type === 'combobox') {
      description += `, Options: [${field.options?.map(opt => `'${opt.value}' (label: '${opt.label}')`).join(', ')}]`;
    }
    return description;
  }).filter(Boolean).join('\n'); // Filter out nulls

  let taskInstruction = "";
  let outputFormatInstruction = "";
  let commentsFieldInstruction = "";

  if (aiTask === 'summarize') {
    taskInstruction = "Your primary task is to summarize the voice transcript into a concise text. You should only output the 'comments' field.";
    outputFormatInstruction = "Return ONLY a single, valid JSON object with a single key 'comments' containing the summarized text.";
    commentsFieldInstruction = "The 'comments' field should contain the summary of the transcript.";
  } else if (aiTask === 'extract_measurements') {
    taskInstruction = "Your primary task is to extract only numerical measurements and related data from the voice transcript for the specified fields. Do not summarize or include other text. Do not output the 'comments' field.";
    outputFormatInstruction = "Return ONLY a single, valid JSON object with the extracted values. The keys must exactly match the provided Field IDs. Only include fields for which you found a clear numerical value.";
    commentsFieldInstruction = "Do NOT include the 'comments' field in your output.";
  } else { // Default or 'summarize_and_extract'
    taskInstruction = "Your primary task is to summarize the voice transcript and extract specific field values. If a new value is clearly mentioned for a field, use that new value. If no new value is mentioned for a field, retain its 'Current Value'.";
    outputFormatInstruction = "Return ONLY a single, valid JSON object with the updated values. The keys must exactly match the provided Field IDs. Only include fields for which you found a clear value.";
    commentsFieldInstruction = "The 'comments' field should contain the summary of the transcript. For other fields, if a new value is mentioned, use it; otherwise, retain the 'Current Value'.";
  }

  const prompt = `You are an expert data entry assistant for window treatment installers.
${taskInstruction}

**Instructions:**
1.  Carefully read the transcript.
2.  For number fields (like 'width', 'height', 'depth'): Extract numerical values. If a fraction is mentioned (e.g., "half", "quarter", "three-eighths"), convert it to a decimal (e.g., 0.5, 0.25, 0.375). Round all measurements to the nearest 0.125 (1/8th of an inch).
3.  For picklist/radio/combobox fields (like 'location', 'mountType', 'controlType', 'product'): Extract values that closely match one of the provided 'value' options. Prioritize exact matches or very close phonetic matches.
4.  For text fields (like 'comments'): Extract relevant text.
5.  ${commentsFieldInstruction}
6.  ${outputFormatInstruction}

${customRules ? `**Custom Rules/Context:**
${customRules}
` : ''}

**Fields to Update:**
${fieldDescriptions}

**Transcript:**
"${transcript}"

**JSON Output:**
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    
    return generatedText;
  } catch (error: any) {
    if (error.message && error.message.includes('503 Service Unavailable')) {
      throw new Error('AI_OVERLOADED'); 
    }
    console.error('ExtractData: Error during Gemini processing: ', error);
    // Catch any other Gemini errors and re-throw with more context
    throw new Error(`AI data extraction failed: ${error.message || String(error)}`);
  }
}

export async function POST(request: Request) {
  console.log('--- Voice Comment API: Request received ---'); // NEW LOG: Confirm route hit
  const HUGGING_FACE_TOKEN = process.env.HUGGINGFACE_TOKEN;

  if (!HUGGING_FACE_TOKEN) {
    console.error('API Route: HUGGINGFACE_TOKEN is missing.');
    return NextResponse.json({ error: 'Server configuration error: Hugging Face token is missing.' }, { status: 500 });
  }
  if (!model) {
    console.error('API Route: Gemini AI model is not available (GEMINI_API_KEY might be missing or invalid).');
    return NextResponse.json({ error: 'Server configuration error: Gemini AI model not available.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob | null;
    const fieldsString = formData.get('fields') as string | null;
    const currentDataString = formData.get('currentData') as string | null;
    const rules = formData.get('rules') as string | null;

    if (!audioBlob || !fieldsString || !currentDataString) {
      console.error('API Route: Missing audio blob, fields, or current data.');
      return NextResponse.json({ error: 'Audio blob, fields, or current data is missing.' }, { status: 400 });
    }
    
    const fields: FormField[] = JSON.parse(fieldsString);
    const currentData: Record<string, any> = JSON.parse(currentDataString);
    console.log('API Route: Parsed fields:', fields); // NEW LOG: Log parsed fields
    console.log('API Route: Parsed currentData:', currentData); // NEW LOG: Log parsed currentData
    
    // Determine AI task based on fields in the section
    const hasCommentsField = fields.some(field => field.id === 'comments' || field.type === 'textarea' || field.type === 'voiceNote');
    const determinedAiTask = hasCommentsField ? 'summarize_and_extract' : 'extract_measurements';
    console.log(`API Route: Determined AI Task based on section fields: ${determinedAiTask}`);

    console.log('API Route: Starting transcription...');
    const whisperData = await transcribe(audioBlob, HUGGING_FACE_TOKEN);
    console.log('API Route: Transcription complete.', whisperData);
    
    if (whisperData.error) {
      console.error('API Route: Transcription returned an error:', whisperData.error);
      throw new Error(whisperData.error);
    }
    if (!whisperData.text) {
      console.error('API Route: Transcription returned empty text.');
      throw new Error('Transcription returned empty text.');
    }
    const originalTranscript = cleanTranscript(whisperData.text.trim());
    console.log('API Route: Original transcript:', originalTranscript);

    console.log('API Route: Starting data extraction...');
    const extractedJsonString = await extractData(originalTranscript, fields, currentData, rules, determinedAiTask);
    console.log('API Route: Data extraction complete.', extractedJsonString);

    let extractedData;
    try {
        console.log('API Route: Parsing extracted JSON...');
        const jsonMatch = extractedJsonString.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
            extractedData = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        } else {
            extractedData = JSON.parse(extractedJsonString);
        }
        console.log('API Route: Parsed extracted data:', extractedData);
    } catch (e) {
        console.error("API Route: Failed to parse JSON from Gemini response:", extractedJsonString, e);
        throw new Error("AI returned an invalid data format. Could not parse JSON.");
    }

    console.log('API Route: Merging updates...');
    // For now, directly use extractedData as the update, without complex appending logic
    // This is part of the temporary simplification for debugging.
    const finalUpdates = { ...currentData, ...extractedData };

    console.log('API Route: Final updates:', finalUpdates);

    return NextResponse.json({ updates: finalUpdates });

  } catch (error: any) {
    console.error('API Route: Uncaught error in POST handler: ', error);
    let errorMessage = 'An unknown error occurred during processing.';
    let statusCode = 500;

    if (error.message === 'AI_OVERLOADED') {
      errorMessage = 'AI service is currently overloaded. Please try again in a few moments.';
      statusCode = 503;
    } else if (error.message.includes('Hugging Face authentication failed')) {
      errorMessage = 'Authentication with transcription service failed. Please contact support.';
      statusCode = 500;
    } else if (error.message.includes('Transcription service error')) {
      errorMessage = 'Transcription service encountered an error. Please try again.';
      statusCode = 500;
    } else if (error.message.includes('AI data extraction failed')) {
      errorMessage = 'AI could not extract data. Please try again or rephrase your input.';
      statusCode = 500;
    } else if (error.message.includes('AI returned an invalid data format')) {
      errorMessage = 'AI returned an unexpected response. Please try again or simplify your input.';
      statusCode = 500;
    } else if (error.message.includes('Transcription returned empty text')) {
      errorMessage = 'Could not understand your voice. Please try again and speak clearly.';
      statusCode = 400;
    } else if (error.message.includes('Your browser does not support a compatible audio recording format')) {
      errorMessage = 'Your device does not support the required audio format for recording.';
      statusCode = 400;
    } else if (error.message.includes('Could not start recording')) {
      errorMessage = 'Microphone access denied or device issue. Please check permissions.';
      statusCode = 400;
    } else if (error.message.includes('Server configuration error')) {
      errorMessage = 'Server is not configured correctly. Please contact support.';
      statusCode = 500;
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}