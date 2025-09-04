import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { v4 as uuidv4 } from "https://deno.land/std@0.177.0/uuid/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert a file Blob to a base64 string
async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

// Function to construct the detailed prompt for the AI
function constructAIPrompt(userPrompt: string): string {
  const formStructureInstructions = `
You are an expert form designer tasked with creating a JSON configuration for a dynamic form builder. Your output MUST be a single, valid JSON object that adheres to the TypeScript types provided below. Do not include any explanatory text, markdown formatting, or anything outside of the JSON object.

**TypeScript Type Definitions:**

\`\`\`typescript
type FieldType = "text" | "number" | "picklist" | "checkbox" | "textarea" | "date" | "toggle" | "radio" | "slider" | "spacer" | "combobox" | "windowTag" | "signature" | "fileUpload";

interface FormFieldOption {
  value: string;
  label: string;
}

interface FormField {
  id: string; // A unique, camelCase identifier (e.g., 'customerName', 'jobAddress').
  name: string; // The human-readable label for the field.
  type: FieldType;
  placeholder?: string;
  options?: FormFieldOption[];
  required?: boolean;
  isDefault?: boolean; // You should always set this to false for generated fields.
  min?: number;
  max?: number;
  step?: number;
}

interface FieldLayoutRow {
  id: string; // A unique UUID.
  fields: FormField[]; // An array of fields in this row. Can contain 1 to 4 fields.
}

interface FormSection {
  id: string; // A unique UUID.
  label: string; // A descriptive label for the section (e.g., "Customer Information", "Job Details").
  rows: FieldLayoutRow[];
  isLineItemSection?: boolean; // Set to 'true' for sections repeated per item, 'false' for global sections.
  isCollapsible?: boolean; // Set to 'true' if the section should be collapsible.
}

interface FormConfig {
  sections: FormSection[];
}
\`\`\`

**Your Task:**

Based on the user's request and any provided document, generate the complete \`FormConfig\` JSON object.

**Key Rules:**
1.  **JSON Only:** Your entire response must be only the JSON object.
2.  **Unique IDs:** All \`id\` properties for sections, rows, and fields must be unique. Use descriptive camelCase strings for field IDs. You do not need to generate UUIDs for section/row IDs; I will add them later.
3.  **Layout:** Group related fields into logical sections. Arrange fields within a section into rows. A row can have 1 to 4 fields.
4.  **Field Types:** Intelligently choose the best \`FieldType\` for each piece of information requested.
5.  **Global vs. Line Item:** If the user's request implies a form for a single entity (like a work order), make most sections global (\`isLineItemSection: false\`). If it implies items in a list (like products in an order), create a line item section (\`isLineItemSection: true\`). If unsure, assume global.

**User's Request:**
${userPrompt}
`;
  return formStructureInstructions;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const userPrompt = formData.get("prompt") as string | null;
    const pdfFile = formData.get("pdf") as File | null;

    if (!userPrompt && !pdfFile) {
      return new Response(JSON.stringify({ error: "Prompt or PDF file is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("AI service is not configured. Missing API Key.");
    }

    const parts = [];
    
    const systemPrompt = constructAIPrompt(userPrompt || "Analyze the provided document and create a form based on its content.");
    parts.push({ text: systemPrompt });

    if (pdfFile) {
      const base64pdf = await blobToBase64(pdfFile);
      parts.push({
        inline_data: {
          mime_type: "application/pdf",
          data: base64pdf,
        },
      });
    }

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Gemini API Error:", errorBody);
      throw new Error(`AI service request failed with status ${geminiResponse.status}.`);
    }

    const responseData = await geminiResponse.json();
    const generatedText = responseData.candidates[0]?.content.parts[0]?.text;

    if (!generatedText) {
      throw new Error("AI did not return any content.");
    }

    const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```|({[\s\S]*})/);
    if (!jsonMatch || !(jsonMatch[1] || jsonMatch[2])) {
      throw new Error("AI returned an invalid data format. Could not find the JSON object.");
    }
    const jsonString = jsonMatch[1] || jsonMatch[2];

    const generatedConfig = JSON.parse(jsonString);
    if (!generatedConfig.sections || !Array.isArray(generatedConfig.sections)) {
        throw new Error("Generated JSON is not a valid FormConfig object.");
    }

    generatedConfig.sections.forEach((section: any) => {
        section.id = uuidv4();
        section.rows.forEach((row: any) => {
            row.id = uuidv4();
        });
    });

    return new Response(JSON.stringify(generatedConfig), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Template Generator Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});