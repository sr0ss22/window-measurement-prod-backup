import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { v4 as uuidv4 } from "https://deno.land/std@0.177.0/uuid/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Define TypeScript types for the AI to understand the form structure
const FORM_CONFIG_TYPES = `
type FieldType = "text" | "number" | "picklist" | "checkbox" | "textarea" | "date" | "toggle" | "radio" | "slider" | "spacer" | "combobox" | "windowTag" | "signature" | "fileUpload" | "voiceNote";

interface FormFieldOption {
  value: string;
  label: string;
  conditions?: FormFieldCondition[];
  customLogicFormula?: string;
}

interface FormField {
  id: string; // A unique, camelCase identifier (e.g., 'customerName', 'jobAddress').
  name: string; // The human-readable label for the field.
  type: FieldType;
  placeholder?: string;
  options?: FormFieldOption[];
  conditions?: FormFieldCondition[];
  customLogicFormula?: string;
  required?: boolean;
  isDefault?: boolean;
  min?: number;
  max?: number;
  step?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  allowMultiple?: boolean;
  allowedFileTypes?: string[];
  aiSummarization?: boolean;
  aiSummarizationRules?: string;
  aiTask?: 'summarize' | 'extract_measurements' | 'summarize_and_extract';
}

interface FieldLayoutRow {
  id: string; // A unique UUID.
  fields: FormField[]; // An array of fields in this row. Can contain 1 to 4 fields.
}

interface FormSection {
  id: string; // A unique UUID.
  label?: string; // A descriptive label for the section (e.g., "Customer Information", "Job Details").
  conditions?: FormFieldCondition[];
  customLogicFormula?: string;
  rows: FieldLayoutRow[]; // A section now contains layout rows
  isLineItemSection?: boolean; // true for fields repeated per window, false for global fields
  isCollapsible?: boolean; // true if the section can be collapsed
  enableSectionVoice?: boolean;
  sectionVoiceLabel?: string;
  sectionVoiceTooltip?: string;
}

interface FormConfig {
  sections: FormSection[];
}
`;

// Function to construct the AI prompt
function constructAIPrompt(
  userPrompt: string,
  currentFormConfig: any,
  conversationHistory: any[]
): string {
  const history = conversationHistory
    .map((msg) => `${msg.type === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  return `You are an expert form designer AI. Your goal is to help the user modify an existing form configuration.
You will receive the current form configuration as a JSON object, and a user's request (prompt).

**Your Task:**
1.  Analyze the user's prompt and the current form configuration.
2.  **Crucially, your entire response MUST be a single, valid JSON object. Do not include any explanatory text, markdown formatting, or anything outside of the JSON object.**
3.  **If the user's request is clear and you can make the changes:** Return the complete, updated \`FormConfig\` object.
    *   **When modifying an existing field or section, you MUST include ALL existing properties of that field/section in your response, in addition to the changes you are making. Do NOT omit any properties. For example, if you are asked to make a field required, you must return the field object with its original 'id', 'name', 'type', 'options' (if any), 'placeholder', etc., plus 'required: true'.**
    *   **Specifically, for fields of type 'picklist', 'radio', or 'combobox', always include the full 'options' array in your response if the field is being modified, even if the options themselves are not changing.**
4.  **If the user's request is ambiguous or you need more information:** Return a JSON object with a single key "clarification_needed" and the value being your question to the user. For example: \`{ "clarification_needed": "Which field should I make required?" }\`.
5.  **Maintain Existing Structure:** Preserve all existing sections, rows, and fields unless explicitly asked to remove or modify them.
6.  **Generate Unique IDs:** For any *new* fields you add, generate descriptive camelCase IDs (e.g., \`newFieldName\`) that are unique within the entire form. If a field ID is provided in the prompt, use that. You do not need to generate UUIDs for new sections or rows; I will handle that.
7.  **Conditional Logic:** If the user asks for show/hide logic (e.g., "show field X if field Y is 'value'"), translate it into \`conditions\` and \`customLogicFormula\` properties. This logic can be applied to a \`FormSection\`, a \`FormField\`, or a specific \`FormFieldOption\` within a picklist/radio/combobox field. Use existing field IDs for conditions. For complex logic involving AND/OR, construct a \`customLogicFormula\` string (e.g., "(1 AND 2) OR 3").
8.  **Handling Impossible Requests:** If the user asks to modify a field or option that does not exist, you MUST ask for clarification. For example, if they say 'change the clutch option' and there is no 'clutch' option, you must respond with \`{ "clarification_needed": "I could not find an option named 'Clutch'. Would you like me to add it?" }\`.

**TypeScript Type Definitions for FormConfig:**
\`\`\`typescript
${FORM_CONFIG_TYPES}
\`\`\`

**Current Form Configuration:**
\`\`\`json
${JSON.stringify(currentFormConfig, null, 2)}
\`\`\`

**Conversation History:**
${history}

**User's Request:**
"${userPrompt}"

**JSON Output (must be ONLY a JSON object - either the full FormConfig or a clarification request):**
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt: userPrompt, currentFormConfig, conversationHistory } = await req.json();

    if (!userPrompt || !currentFormConfig) {
      return new Response(
        JSON.stringify({ error: "Prompt and current form config are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("AI service is not configured. Missing API Key.");
    }

    const fullPrompt = constructAIPrompt(
      userPrompt,
      currentFormConfig,
      conversationHistory
    );

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] }),
      }
    );

    if (!geminiResponse.ok) {
      let errorBody;
      try {
        errorBody = await geminiResponse.json();
      } catch {
        errorBody = await geminiResponse.text();
      }
      console.error("Gemini API Error:", errorBody);
      const errorMessage = errorBody?.error?.message || (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody));
      throw new Error(`AI service request failed: ${errorMessage}`);
    }

    const responseData = await geminiResponse.json();
    
    if (!responseData.candidates || !responseData.candidates[0]?.content?.parts[0]?.text) {
      console.error("Invalid Gemini response structure:", responseData);
      throw new Error("AI returned an unexpected response structure.");
    }
    const generatedText = responseData.candidates[0].content.parts[0].text;

    let aiOutput;
    try {
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        aiOutput = JSON.parse(jsonMatch[1]);
      } else {
        aiOutput = JSON.parse(generatedText);
      }
    } catch (e) {
      console.warn("Could not parse AI response as JSON. Treating as clarification.", e.message);
      return new Response(
        JSON.stringify({
          status: "clarification_needed",
          message: generatedText,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (aiOutput.clarification_needed && typeof aiOutput.clarification_needed === 'string') {
      return new Response(
        JSON.stringify({
          status: "clarification_needed",
          message: aiOutput.clarification_needed,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (aiOutput.sections && Array.isArray(aiOutput.sections)) {
      const proposedConfig = aiOutput;
      proposedConfig.sections = proposedConfig.sections.map((section: any) => {
        if (!section.id) section.id = uuidv4();
        if (section.rows && Array.isArray(section.rows)) {
            section.rows = section.rows.map((row: any) => {
                if (!row.id) row.id = uuidv4();
                return row;
            });
        } else {
            section.rows = [];
        }
        return section;
      });

      const successResponse = {
        status: "success",
        message: "I've updated the form configuration based on your request.",
        proposedConfig: proposedConfig,
      };

      return new Response(JSON.stringify(successResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.warn("AI returned valid JSON but in an unknown format:", aiOutput);
    return new Response(
      JSON.stringify({
        status: "clarification_needed",
        message: "I'm not sure how to apply the changes. Could you please rephrase your request?",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("AI Form Updater Edge Function Error:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        message: error.message || "An unknown error occurred during AI processing.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});