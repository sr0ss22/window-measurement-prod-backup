import { NextResponse } from 'next/server';
import { model } from '@/integrations/gemini/client';
import type { WindowItem } from '@/types/window-item';
import { formatMeasurement } from '@/utils/measurements';
import { createClient } from '@supabase/supabase-js';

// Helper to convert Blob to Base64
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

export async function POST(request: Request) {
  if (!model) {
    return NextResponse.json({ error: 'AI model not initialized. Check server configuration.' }, { status: 500 });
  }

  try {
    const { message, windowItem }: { message: string; windowItem: Partial<WindowItem> } = await request.json();

    if (!message || !windowItem) {
      return NextResponse.json({ error: 'Message and windowItem are required.' }, { status: 400 });
    }

    // Create a Supabase client with the public anon key.
    // This is sufficient for accessing public storage buckets.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. List files from the 'knowledge' bucket
    const { data: files, error: listError } = await supabase.storage.from('knowledge').list();

    if (listError) {
      console.error("Error listing files from knowledge bucket:", listError);
      throw new Error("Could not access the knowledge base files.");
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ reply: "I couldn't find any reference guides in the knowledge base. Please upload your PDF guides to the 'knowledge' storage bucket in Supabase." });
    }

    // 2. Download and prepare PDF files for the AI
    const pdfPartsPromises = files
      .filter(file => file.name.toLowerCase().endsWith('.pdf'))
      .map(async (file) => {
        const { data: blob, error: downloadError } = await supabase.storage.from('knowledge').download(file.name);
        if (downloadError || !blob) {
          console.warn(`Could not download file: ${file.name}`, downloadError);
          return null;
        }
        const base64Data = await blobToBase64(blob);
        return {
          inline_data: {
            mime_type: 'application/pdf',
            data: base64Data,
          },
        };
      });

    const pdfParts = (await Promise.all(pdfPartsPromises)).filter(part => part !== null);

    if (pdfParts.length === 0) {
        return NextResponse.json({ reply: "I found files in the knowledge base, but none of them were PDFs I could read. Please make sure you have uploaded your reference guides as PDF files." });
    }

    const windowContext = `
      **Current Window Context:**
      - Line #: ${windowItem.lineNumber || 'N/A'}
      - Location: ${windowItem.location || 'N/A'}
      - Product: ${windowItem.product || 'N/A'}
      - Control Type: ${windowItem.controlType || 'N/A'}
      - Width: ${formatMeasurement(windowItem.width)} inches
      - Height: ${formatMeasurement(windowItem.height)} inches
    `;

    const prompt = `
      **Your Persona and Rules:**
      You are an expert Hunter Douglas Support agent. You are friendly, helpful, and direct. You know everything from the Reference Guides provided below. You can read tables and provide exact information to help the user get a fast and accurate answer. You must not provide pricing information; if asked about price, direct them to the pages where pricing can be found in the reference guide.

      **Reference Guide Content (Knowledge Base):**
      You have been provided with one or more PDF reference guides. All the information you need is contained within these documents.

      **User's Situation:**
      The user is currently working on a specific window with the following details:
      ${windowContext}

      **Your Task (Perform in this order):**

      **1. Primary Task: Size Validation**
      Your first and most important task is to validate the dimensions ('Width' and 'Height') of the **Current Window Context** against the size limitation charts in the provided PDF **Reference Guide Content**. You must find the tables corresponding to the specified 'Product' and 'Control Type'. Check if the given 'Width' and 'Height' fall within the minimum and maximum allowed values shown in those tables.

      **2. Conditional Response Rules (Follow these strictly):**

      *   **If Dimensions are INVALID:** Your primary response **must** be an alert. Start your response with "⚠️ **Size Alert:**". Clearly state the issue, specify the exact minimum/maximum dimension that is not met, and if possible, cite the page number from the reference guide. After the alert, ask the user if they still want you to answer their original question.

      *   **If Dimensions are VALID:** Start your response by confirming this (e.g., "The dimensions are within the standard limits for this product."). Then, proceed to answer the **User's Original Question** based on the reference guides.

      **User's Original Question:**
      "${message}"
    `;

    // 3. Send request to Gemini with the text prompt and all PDF files
    const result = await model.generateContent({
      contents: [{ parts: [{ text: prompt }, ...pdfParts] }],
    });
    
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error("Error in product-helper API:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: `Failed to get AI response: ${errorMessage}` }, { status: 500 });
  }
}