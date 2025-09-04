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

  const MAX_TRANSCRIPTION_RETRIES = 3;
  const TRANSCRIPTION_RETRY_DELAY_MS = 3000; // 3 seconds

  for (let i = 0; i < MAX_TRANSCRIPTION_RETRIES; i++) {
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
        console.error(`Transcribe: Attempt ${i + 1} failed. Axios error during transcription:`, {
          status: error.response?.status,
          data: error.response?.data, // Log full response data
          headers: error.response?.headers,
        });

        if (error.response?.data?.error?.includes('is currently loading') || error.response?.status === 503) {
          if (i < MAX_TRANSCRIPTION_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, TRANSCRIPTION_RETRY_DELAY_MS));
            continue; // Retry
          } else {
            throw new Error('AI transcription service is overloaded and retries failed. Please try again later.');
          }
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw new Error('Hugging Face authentication failed. Please check your HUGGINGFACE_TOKEN and permissions.');
        }
        throw new Error(`Transcription service error: ${error.message} (Status: ${error.response?.status || 'N/A'})`);
      }
      // Re-throw other unexpected errors
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  // This line should ideally not be reached if MAX_TRANSCRIPTION_RETRIES > 0
  throw new Error('Transcription failed after multiple retries due to an unknown error.');
}

async function determineSingleLineCommandType(transcript: string): Promise<'new-line' | 'copy-and-modify'> {
  if (!model) {
    throw new Error("Gemini model is not initialized. Please check server logs for API key issues.");
  }

  const prompt = `Analyze the following transcript and determine if the user wants to:
  1. Create a NEW window line (e.g., "Add a window in the living room", "New line for bedroom 2").
  2. COPY an existing window line and potentially MODIFY it (e.g., "Copy line 3 and change width to 40", "Duplicate the last line and make it outside mount").

  Return ONLY "new-line" or "copy-and-modify".

  Transcript: "${transcript}"

  Command Type:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text().trim().toLowerCase();

    if (generatedText.includes('new-line')) {
      return 'new-line';
    } else if (generatedText.includes('copy-and-modify')) {
      return 'copy-and-modify';
    } else {
      return 'new-line';
    }
  } catch (error) {
    console.error('DetermineSingleLineCommandType: Error during Gemini processing: ', error);
    throw new Error(`AI command type determination failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function parseSingleNewLineCommand(transcript: string, targetFields: FormField[]) {
  if (!model) {
    throw new Error("Gemini model is not initialized. Please check server logs for API key issues.");
  }

  const filteredTargetFields = targetFields.filter(field => field.id !== 'comments');

  const fieldDescriptions = filteredTargetFields.map(field => {
    let description = `- Field Name: "${field.name}", ID: "${field.id}", Type: "${field.type}"`;
    if (field.type === 'picklist' || field.type === 'radio' || field.type === 'combobox') {
      description += `, Options: [${field.options?.map(opt => `'${opt.value}' (label: '${opt.label}')`).join(', ')}]`;
    }
    return description;
  }).join('\n');

  const prompt = `You are an expert data extraction assistant for window measurement forms.
Your task is to extract specific information from a voice transcript and format it into a JSON object.

**Instructions:**
1.  Carefully read the transcript.
2.  Identify values for the following target fields.
3.  **For number fields (like 'width', 'height', 'depth'):** Extract numerical values. If a fraction is mentioned (e.g., "half", "quarter", "three-eighths"), convert it to a decimal (e.g., 0.5, 0.25, 0.375). Round all measurements to the nearest 0.125 (1/8th of an inch). If no specific measurement is mentioned for a number field, omit it from the JSON.
4.  **For picklist/radio/combobox fields (like 'location', 'mountType', 'controlType', 'product'):** Extract values that closely match one of the provided 'value' options. Prioritize exact matches or very close phonetic matches. If a value is not clearly mentioned or doesn't match an option, omit it from the JSON.
5.  **Do NOT include any 'comments' or general text fields in the output JSON.** Only extract values for the explicitly listed target fields.
6.  Return ONLY a single, valid JSON object with the extracted values. The keys must exactly match the provided Field IDs. Only include fields for which you found a clear value.

**Target Fields:**
${fieldDescriptions}

**Transcript:**
"${transcript}"

**JSON Output:**
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    
    let extractedData;
    try {
        const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
            extractedData = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        } else {
            extractedData = JSON.parse(generatedText);
        }
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", generatedText);
        throw new Error("AI returned an invalid data format. Could not parse JSON.");
    }

    const processedData: Record<string, any> = {};
    filteredTargetFields.forEach(field => {
      if (extractedData[field.id] !== undefined) {
        if (field.type === 'number') {
          const numValue = parseFloat(extractedData[field.id]);
          if (!isNaN(numValue)) {
            processedData[field.id] = Math.round(numValue / 0.125) * 0.125;
          }
        } else {
          processedData[field.id] = extractedData[field.id];
        }
      }
    });
    delete processedData['comments'];
    return processedData;
  } catch (error: any) {
    if (error.message && error.message.includes('503 Service Unavailable')) {
      throw new Error('AI_OVERLOADED'); 
    }
    console.error('ParseSingleNewLineCommand: Error during Gemini processing: ', error);
    throw new Error(`AI new line data extraction failed: ${error.message || String(error)}`);
  }
}

async function parseSingleCopyCommand(transcript: string, targetFields: FormField[], windowItems: { id: string; lineNumber: number }[]) {
  if (!model) {
    throw new Error("Gemini model is not initialized. Please check server logs for API key issues.");
  }

  const filteredTargetFields = targetFields.filter(field => field.id !== 'comments');

  const fieldDescriptions = filteredTargetFields.map(field => {
    let description = `- Field Name: "${field.name}", ID: "${field.id}", Type: "${field.type}"`;
    if (field.type === 'picklist' || field.type === 'radio' || field.type === 'combobox') {
      description += `, Options: [${field.options?.map(opt => `'${opt.value}' (label: '${opt.label}')`).join(', ')}]`;
    }
    return description;
  }).join('\n');

  const prompt = `You are an expert assistant for a window measurement application.
Your task is to parse a voice command to copy an existing window line and apply specific modifications.

**Instructions:**
1.  Identify the source line number to copy. This can be a specific number (e.g., "line 5", "line three") or "last line" / "previous line".
2.  Identify any fields to change and their new values.
3.  **For number fields (like 'width', 'height', 'depth'):** Extract numerical values. If a fraction is mentioned (e.g., "half", "quarter", "three-eighths"), convert it to a decimal (e.g., 0.5, 0.25, 0.375). Round all measurements to the nearest 0.125 (1/8th of an inch).
4.  **For picklist/radio/combobox fields (like 'location', 'mountType', 'controlType', 'product'):** Extract values that closely match one of the provided 'value' options. Prioritize exact matches or very close phonetic matches.
5.  **Do NOT include any 'comments' or general text fields in the 'updates' object.** Only extract values for the explicitly listed target fields.
6.  Return ONLY a single, valid JSON object with the following structure:
    \`\`\`json
    {
      "sourceLineNumber": number | "last",
      "updates": {
        "fieldId1": "newValue1"
      }
    }
    \`\`\`
7.  If no specific line number is mentioned but a copy command is implied, assume "last line".
8.  If no changes are specified, the "updates" object should be empty.

**Available Fields for Updates:**
${fieldDescriptions}

**Current Window Line Numbers (for context, if needed):**
${windowItems.map(w => `Line ${w.lineNumber}`).join(', ')}

**Transcript:**
"${transcript}"

**JSON Output:**
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    
    let parsedCommand;
    try {
        const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
            parsedCommand = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        } else {
            parsedCommand = JSON.parse(generatedText);
        }
    } catch (e) {
        console.error("Failed to parse JSON from Gemini response:", generatedText);
        throw new Error("AI returned an invalid data format. Could not parse JSON.");
    }

    const processedUpdates: Record<string, any> = {};
    if (parsedCommand.updates) {
      filteredTargetFields.forEach(field => {
        if (parsedCommand.updates[field.id] !== undefined) {
          if (field.type === 'number') {
            const numValue = parseFloat(parsedCommand.updates[field.id]);
            if (!isNaN(numValue)) {
              processedUpdates[field.id] = Math.round(numValue / 0.125) * 0.125;
            }
          } else {
            processedUpdates[field.id] = parsedCommand.updates[field.id];
          }
        }
      });
    }
    parsedCommand.updates = processedUpdates;
    delete parsedCommand.updates['comments'];
    return parsedCommand;
  } catch (error: any) {
    if (error.message && error.message.includes('503 Service Unavailable')) {
      throw new Error('AI_OVERLOADED'); 
    }
    console.error('ParseSingleCopyCommand: Error during Gemini processing: ', error);
    throw new Error(`AI copy command parsing failed: ${error.message || String(error)}`);
  }
}

async function parseMultiLineCommand(transcript: string, targetFields: FormField[], windowItems: { id: string; lineNumber: number }[]) {
  if (!model) {
    throw new Error("Gemini model is not initialized.");
  }

  const fieldDescriptions = targetFields.map(field => {
    let description = `- Field Name: "${field.name}", ID: "${field.id}", Type: "${field.type}"`;
    if (field.type === 'picklist' || field.type === 'radio' || field.type === 'combobox') {
      description += `, Options: [${field.options?.map(opt => `'${opt.value}' (label: '${opt.label}')`).join(', ')}]`;
    }
    return description;
  }).join('\n');

  const prompt = `You are an expert data extraction assistant for a window measurement application.
Your task is to parse a voice transcript that may contain multiple commands for creating, updating, or copying window line items.

**Instructions:**
1.  Analyze the entire transcript to identify individual commands. Commands are often separated by phrases like "line one...", "next line...", "and then...", or pauses.
2.  For each command, determine its type: "new-line", "update-line", "copy-and-modify", or "batch-new-line".
3.  For each command, extract the relevant data.
4.  Return a JSON array of command objects. Each object in the array must have a "type" property.

**Command Types & Data Extraction Rules:**

*   **For "new-line" commands (e.g., "Line 1, Living Room, 36 by 60"):**
    *   Set \`type\` to \`"new-line"\`.
    *   Create a \`data\` object.
    *   Extract values for the available fields.
    *   **IMPORTANT**: Do NOT include a \`lineNumber\` in the \`data\` object for new lines. The frontend will assign it.
    *   For number fields (width, height, depth): Convert fractions to decimals and round to the nearest 0.125.
    *   For picklist/radio fields: Match the spoken value to one of the provided options' \`value\`.

*   **For "update-line" commands (e.g., "Line 3, update width to 55"):**
    *   Set \`type\` to \`"update-line"\`.
    *   You MUST extract the \`lineNumber\` the user is referring to.
    *   Create an \`updates\` object containing only the fields to be changed and their new values.

*   **For "copy-and-modify" commands (e.g., "Copy line 2 and change location to Guest Room"):**
    *   Set \`type\` to \`"copy-and-modify"\`.
    *   You MUST extract the \`sourceLineNumber\` (can be a number or the string "last").
    *   Create an \`updates\` object with the changes.

*   **For "batch-new-line" commands (e.g., "Add 5 windows, all 36 by 60"):**
    *   Set \`type\` to \`"batch-new-line"\`.
    *   Extract the \`count\` of windows to create.
    *   Create a \`data\` object with the common properties for all new windows.

**Output Format:**
Your entire response MUST be a single, valid JSON array of command objects. Do not include any explanatory text or markdown.

**Available Fields:**
${fieldDescriptions}

**Transcript to Process:**
"${transcript}"

**JSON Array Output:**
`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const generatedText = response.text();
    
    let parsedCommands;
    try {
        const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```|(\[[\s\S]*\])/);
        if (jsonMatch && (jsonMatch[1] || jsonMatch[2])) {
            parsedCommands = JSON.parse(jsonMatch[1] || jsonMatch[2]);
        } else {
            parsedCommands = JSON.parse(generatedText);
        }
    } catch (e) {
        console.error("Failed to parse JSON array from Gemini response:", generatedText);
        throw new Error("AI returned an invalid data format. Could not parse JSON array.");
    }

    // Post-process numerical values
    const processedCommands = parsedCommands.map((command: any) => {
        const updates = command.updates || command.data;
        if (updates) {
            const processedUpdates: Record<string, any> = {};
            targetFields.forEach(field => {
                if (updates[field.id] !== undefined) {
                    if (field.type === 'number') {
                        const numValue = parseFloat(updates[field.id]);
                        if (!isNaN(numValue)) {
                            processedUpdates[field.id] = Math.round(numValue / 0.125) * 0.125;
                        }
                    } else {
                        processedUpdates[field.id] = updates[field.id];
                    }
                }
            });
            if (command.updates) command.updates = processedUpdates;
            if (command.data) command.data = processedUpdates;
        }
        return command;
    });

    return processedCommands;
  } catch (error: any) {
    if (error.message && error.message.includes('503 Service Unavailable')) {
      throw new Error('AI_OVERLOADED'); 
    }
    console.error('ParseMultiLineCommand: Error during Gemini processing: ', error);
    throw new Error(`AI multi-line command parsing failed: ${error.message || String(error)}`);
  }
}

export async function POST(request: Request) {
  const HUGGING_FACE_TOKEN = process.env.HUGGINGFACE_TOKEN;

  if (!HUGGING_FACE_TOKEN) {
    return NextResponse.json({ error: 'Server configuration error: Hugging Face token is missing.' }, { status: 500 });
  }
  if (!model) {
    return NextResponse.json({ error: 'Server configuration error: Gemini AI model not available.' }, { status: 500 });
  }

  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob | null;
    const targetFieldsString = formData.get('targetFields') as string | null;
    const windowItemsString = formData.get('windowItems') as string | null;
    const mode = formData.get('mode') as 'single' | 'multi' | null;

    if (!audioBlob || !targetFieldsString) {
      return NextResponse.json({ error: 'Audio blob or target fields are missing.' }, { status: 400 });
    }
    
    const targetFields: FormField[] = JSON.parse(targetFieldsString);
    const windowItems: { id: string; lineNumber: number }[] = windowItemsString ? JSON.parse(windowItemsString) : [];
    
    const whisperData = await transcribe(audioBlob, HUGGING_FACE_TOKEN);
    if (whisperData.error) {
      throw new Error(whisperData.error);
    }
    if (!whisperData.text) {
      return NextResponse.json({ type: 'new-line', data: {} });
    }
    const transcript = cleanTranscript(whisperData.text.trim());

    if (mode === 'multi') {
      const commands = await parseMultiLineCommand(transcript, targetFields, windowItems);
      return NextResponse.json({ type: 'multi-line', transcript, commands });
    } else {
      const commandType = await determineSingleLineCommandType(transcript);
      if (commandType === 'copy-and-modify') {
        const command = await parseSingleCopyCommand(transcript, targetFields, windowItems);
        return NextResponse.json({ type: 'copy-and-modify', transcript, command });
      } else {
        const data = await parseSingleNewLineCommand(transcript, targetFields);
        return NextResponse.json({ type: 'new-line', transcript, data });
      }
    }

  } catch (error: any) {
    console.error('API Route: Error processing voice command: ', error);
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
    } else if (error.message.includes('AI command type determination failed')) {
      errorMessage = 'AI could not determine command type. Please try again or rephrase your input.';
      statusCode = 500;
    } else if (error.message.includes('AI new line data extraction failed')) {
      errorMessage = 'AI could not extract data for a new line. Please try again or rephrase your input.';
      statusCode = 500;
    } else if (error.message.includes('AI copy command parsing failed')) {
      errorMessage = 'AI could not parse the copy command. Please try again or rephrase your input.';
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