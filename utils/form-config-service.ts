import type { FormConfig, FormField, FormSection, FieldLayoutRow, FormFieldCondition } from "@/types/form-config";
import type { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

// Conditional logic for fields
const productIsNotEmptyCondition: FormFieldCondition[] = [ // New condition for product not empty
  { fieldId: "product", operator: "isNotEmpty" },
];
const controlLengthConditions: FormFieldCondition[] = [
  { fieldId: "controlType", operator: "equals", value: "EasyRise" },
  { fieldId: "controlType", operator: "equals", value: "UltraGlide" },
];
const tiltConditions: FormFieldCondition[] = [
  { fieldId: "product", operator: "equals", value: "Silhouette" },
  { fieldId: "product", operator: "equals", value: "Pirouette" },
  { fieldId: "product", operator: "equals", value: "Wood Blinds" }, // Added Wood Blinds
];
const sbsConditions: FormFieldCondition[] = [
  { fieldId: "product", operator: "equals", value: "Silhouette" },
  { fieldId: "product", operator: "equals", value: "Pirouette" },
  { fieldId: "product", operator: "equals", value: "Vignette" },
];
const stackPositionConditions: FormFieldCondition[] = [
  { fieldId: "product", operator: "equals", value: "Silhouette" },
  { fieldId: "product", operator: "equals", value: "Pirouette" },
  { fieldId: "product", operator: "equals", value: "Vertical Blinds" }, // Added Vertical Blinds
];

const defaultFields: FormField[] = [
  { id: "location", name: "Location", type: "combobox", required: true, isDefault: true, placeholder: "e.g. Living Room", options: [
      { value: "Foyer / Entryway", label: "Foyer / Entryway" },
      { value: "Hallway", label: "Hallway" },
      { value: "Master Bedroom", label: "Master Bedroom" },
      { value: "Bedroom 1", label: "Bedroom 1" },
      { value: "Bedroom 2", label: "Bedroom 2" },
      { value: "Bedroom 3", label: "Bedroom 3" },
      { value: "Bedroom 4", label: "Bedroom 4" },
      { value: "Bedroom 5", label: "Bedroom 5" },
      { value: "Guest Bedroom", label: "Guest Bedroom" },
      { value: "Nursery", label: "Nursery" },
      { value: "Living Room", label: "Living Room" },
      { value: "Family Room", "label": "Family Room" },
      { value: "Great Room", label: "Great Room" },
      { value: "Den", label: "Den" },
      { value: "Study", label: "Study" },
      { value: "Office", label: "Office" },
      { value: "Dining Room", label: "Dining Room" },
      { value: "Breakfast Nook", label: "Breakfast Nook" },
      { value: "Sunroom", label: "Sunroom" },
      { value: "Kitchen", label: "Kitchen" },
      { value: "Pantry", label: "Pantry" },
      { value: "Laundry Room / Utility Room", label: "Laundry Room / Utility Room" },
      { value: "Mudroom", label: "Mudroom" },
      { value: "Garage", label: "Garage" },
      { value: "Master Bathroom", label: "Master Bathroom" },
      { value: "Bathroom", label: "Bathroom" },
      { value: "Guest Bathroom", label: "Guest Bathroom" },
      { value: "Powder Room", label: "Powder Room" },
      { value: "Home Theater", label: "Home Theater" },
      { value: "Game Room", label: "Game Room" },
      { value: "Gym", label: "Gym" },
  ]},
  { id: "windowNumber", name: "Window Tag", type: "windowTag", isDefault: true },
  { id: "product", name: "Product", type: "picklist", options: [
      { value: "Duette", label: "Duette" },
      { value: "Silhouette", label: "Silhouette" },
      { value: "Pirouette", label: "Pirouette" },
      { value: "Vignette", label: "Vignette" },
      { value: "Vertical Blinds", label: "Vertical Blinds" }, // Added
      { value: "Wood Blinds", label: "Wood Blinds" }, // Added
    ], isDefault: true },
  { id: "width", name: "Width (inches)", type: "number", required: true, isDefault: true, min: 0.125, step: 0.125 },
  { id: "height", name: "Height (inches)", type: "number", required: true, isDefault: true, min: 0.125, step: 0.125 },
  { id: "depth", name: "Depth (inches)", type: "number", required: false, isDefault: true, min: 0.125, step: 0.125 },
  { id: "mountType", name: "Mount Type", type: "radio", options: [{value: "inside", label: "Inside"}, {value: "outside", label: "Outside"}], isDefault: true },
  { id: "controlType", name: "Control Type", type: "picklist", options: [
      { value: "EasyRise", label: "EasyRise" }, // Renamed from Standard
      { value: "Cordless", label: "Cordless" },
      { value: "Motorized", label: "Motorized" },
      { value: "UltraGlide", label: "UltraGlide" },
      { value: "Wand Control", label: "Wand Control", conditions: [{ fieldId: "product", operator: "equals", value: "Vertical Blinds" }], customLogicFormula: "1" }, // Added with logic
  ], isDefault: true,
    conditions: productIsNotEmptyCondition, customLogicFormula: "1" },
  { id: "controlLength", name: "Control Length", type: "text", isDefault: true, placeholder: "e.g. 36",
    conditions: productIsNotEmptyCondition, customLogicFormula: "1" },
  { id: "tilt", name: "Tilt", type: "picklist", options: [
      { value: "Standard", label: "Standard" },
      { value: "Motorized", label: "Motorized" },
      { value: "None", label: "None" },
  ], isDefault: true,
    conditions: tiltConditions, customLogicFormula: "(1 OR 2 OR 3)" }, // Updated logic
  { id: "sbs", name: "SBS", type: "text", isDefault: true, placeholder: "SBS details",
    conditions: sbsConditions, customLogicFormula: "(1 OR 2 OR 3)" }, // Logic was already correct
  { id: "stackPosition", name: "Stack Position", type: "picklist", options: [
      { value: "Left", label: "Left" },
      { value: "Right", label: "Right" },
      { value: "Center", label: "Center" },
      { value: "Split", label: "Split" },
  ], isDefault: true,
    conditions: stackPositionConditions, customLogicFormula: "(1 OR 2 OR 3)" }, // Updated logic
  // Surcharge fields - changed to checkbox
  { id: "takeDown", name: "Take Down", type: "checkbox", isDefault: true },
  { id: "hardSurface", name: "Hard Surface", type: "checkbox", isDefault: true },
  { id: "holdDown", name: "Hold Down", type: "checkbox", isDefault: true },
  { id: "tallWindow12", name: "Tall Window 12'", type: "checkbox", isDefault: true },
  { id: "tallWindow16", name: "Tall Window 16'", type: "checkbox", isDefault: true },
  {
    id: "comments",
    name: "Comments",
    type: "voiceNote", // Changed from textarea to voiceNote
    isDefault: true,
    placeholder: "Additional notes or comments about this window",
    aiSummarization: true, // Enable AI summarization by default
    aiTask: 'summarize', // Changed to 'summarize'
    aiSummarizationRules: `You are an expert data entry assistant for Hunter Douglas window treatment installers. Summarize the voice transcript in a professional, matter-of-fact tone, following these rules:
Do not use first-person language (avoid “I”, “we”, etc.).
Group information by Room then Line numbers then topic (e.g., room, product, installation requirements).
Within each topic, use bullet points.
Use sub-bullets for details under each line item.
Reference line numbers if provided.
Prioritize accuracy and conciseness.
Exclude irrelevant conversation, filler words, or small talk.
**Crucially, do NOT include any numerical measurements (width, height, depth, etc.) in the summary. Focus only on descriptive comments, instructions, or non-numerical observations.**
Light rise should always be LiteRise.`,
  },
];

function ensureDefaultFieldsCorrect(config: FormConfig): FormConfig {
  let newConfig: FormConfig = JSON.parse(JSON.stringify(config));

  // 1. Ensure all sections have isLineItemSection and isCollapsible defined (default to true/false)
  newConfig.sections = newConfig.sections.map(section => ({
    ...section,
    isLineItemSection: section.isLineItemSection === undefined ? true : section.isLineItemSection,
    isCollapsible: section.isCollapsible === undefined ? false : section.isCollapsible // Default to false
  }));

  // 2. Find or create the primary line item section
  let primaryLineItemSection = newConfig.sections.find(s => s.isLineItemSection);
  if (!primaryLineItemSection) {
    primaryLineItemSection = { id: uuidv4(), label: "Window Details", rows: [], conditions: [], customLogicFormula: "", isLineItemSection: true, isCollapsible: false };
    newConfig.sections.unshift(primaryLineItemSection); // Add to beginning if not found
  }

  // Create a map of existing fields for quick lookup, including their section and row references
  const existingFieldsMap = new Map<string, { field: FormField, section: FormSection, row: FieldLayoutRow }>();
  newConfig.sections.forEach(section => {
    section.rows.forEach(row => {
      row.fields.forEach(field => {
        existingFieldsMap.set(field.id, { field, section, row });
      });
    });
  });

  // 3. Iterate through defaultFields and ensure their presence and correct properties
  defaultFields.forEach(defaultFieldDef => {
    const existingFieldEntry = existingFieldsMap.get(defaultFieldDef.id);

    if (!existingFieldEntry) {
      // Field is missing: Add it to the primary line item section in a new row.
      // Ensure primaryLineItemSection is not null before pushing
      if (primaryLineItemSection) {
        primaryLineItemSection.rows.push({ id: uuidv4(), fields: [{ ...defaultFieldDef, isDefault: true }] });
      } else {
        // This case should ideally not happen if primaryLineItemSection is always created/found
        console.error("Primary line item section not found or created, cannot add default field.");
      }
    } else {
      // Field exists: Update its `isDefault` and `type` properties.
      const fieldToUpdate = existingFieldEntry.field;
      fieldToUpdate.isDefault = true; // Ensure it's marked as default
      
      // Special handling for the 'comments' field to ensure its type and AI properties are always correct
      if (defaultFieldDef.id === 'comments') {
        fieldToUpdate.type = 'voiceNote'; // Force type to voiceNote
        // Only set AI properties if they are undefined or null, or if aiSummarization is not explicitly false
        if (fieldToUpdate.aiSummarization === undefined || fieldToUpdate.aiSummarization === null) {
          fieldToUpdate.aiSummarization = defaultFieldDef.aiSummarization;
        }
        if (fieldToUpdate.aiTask === undefined || fieldToUpdate.aiTask === null) {
          fieldToUpdate.aiTask = defaultFieldDef.aiTask;
        }
        if (fieldToUpdate.aiSummarizationRules === undefined || fieldToUpdate.aiSummarizationRules === null) {
          fieldToUpdate.aiSummarizationRules = defaultFieldDef.aiSummarizationRules;
        }
      } else {
        // For other default fields, just ensure type is correct
        fieldToUpdate.type = defaultFieldDef.type;
      }

      // NEW LOGIC: If it's a picklist/radio/combobox and its options are empty, re-populate with defaults
      if (
        (fieldToUpdate.type === "picklist" || fieldToUpdate.type === "radio" || fieldToUpdate.type === "combobox") &&
        (!fieldToUpdate.options || fieldToUpdate.options.length === 0) &&
        defaultFieldDef.options && defaultFieldDef.options.length > 0
      ) {
        fieldToUpdate.options = defaultFieldDef.options;
      }
    }
  });

  // NEW: Add global signature section if it doesn't exist or is empty
  let globalSignatureSection = newConfig.sections.find(s => s.id === 'projectSignatures' && s.isLineItemSection === false);
  if (!globalSignatureSection) {
    globalSignatureSection = {
      id: 'projectSignatures',
      label: 'Project Signatures',
      rows: [],
      isLineItemSection: false,
      isCollapsible: true,
      conditions: [],
      customLogicFormula: ""
    };
    newConfig.sections.push(globalSignatureSection);
  }

  // Ensure installerSignature and customerSignature fields are present in the global signature section
  const installerSignatureField: FormField = {
    id: "installerSignature",
    name: "Installer Signature",
    type: "signature",
    required: true,
    isDefault: true,
  };
  const customerSignatureField: FormField = {
    id: "customerSignature",
    name: "Customer Signature",
    type: "signature",
    required: false,
    isDefault: true,
  };

  // Check if installerSignature field exists in the global section
  let installerRow = globalSignatureSection.rows.find(row => row.fields.some(f => f.id === installerSignatureField.id));
  if (!installerRow) {
    installerRow = { id: uuidv4(), fields: [installerSignatureField] };
    globalSignatureSection.rows.push(installerRow);
  } else {
    // Ensure it's updated if it exists
    const existingInstallerField = installerRow.fields.find(f => f.id === installerSignatureField.id);
    if (existingInstallerField) {
      Object.assign(existingInstallerField, installerSignatureField);
    } else {
      installerRow.fields.push(installerSignatureField);
    }
  }

  // Check if customerSignature field exists in the global section
  let customerRow = globalSignatureSection.rows.find(row => row.fields.some(f => f.id === customerSignatureField.id));
  if (!customerRow) {
    customerRow = { id: uuidv4(), fields: [customerSignatureField] };
    globalSignatureSection.rows.push(customerRow);
  } else {
    // Ensure it's updated if it exists
    const existingCustomerField = customerRow.fields.find(f => f.id === customerSignatureField.id);
    if (existingCustomerField) {
      Object.assign(existingCustomerField, customerSignatureField);
    } else {
      customerRow.fields.push(customerSignatureField);
    }
  }

  // 4. Clean up any empty rows and sections that might have resulted from previous operations
  newConfig.sections.forEach(section => {
    section.rows = section.rows.filter(row => row.fields.length > 0);
  });
  // Only remove line item sections if they are truly empty. Non-line-item sections might be empty but still desired.
  newConfig.sections = newConfig.sections.filter(section => section.rows.length > 0 || section.isLineItemSection === false);

  return newConfig;
}

export async function loadFormConfigFromSupabase(supabase: SupabaseClient, userId: string): Promise<FormConfig> {
  // First, try to get the active form
  const { data: activeData, error: activeError } = await supabase
    .from('forms')
    .select('config')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (activeError) {
    console.error("Error loading active form config:", activeError);
  }

  if (activeData?.config) {
    return ensureDefaultFieldsCorrect(activeData.config as FormConfig);
  }

  // If no active form, try to get the most recently updated one as a fallback
  const { data: latestData, error: latestError } = await supabase
    .from('forms')
    .select('config')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (latestError) {
    console.error("Error loading latest form config:", latestError);
  }

  if (latestData?.config) {
    return ensureDefaultFieldsCorrect(latestData.config as FormConfig);
  }

  // If still no form, create and return a default one.
  console.log("No forms found for user, creating default config.");
  const initialLayoutRows: FieldLayoutRow[] = defaultFields.map(f => ({ id: uuidv4(), fields: [{ ...f, isDefault: true }] }));
  const defaultConfig = { sections: [{ id: uuidv4(), label: "Window Details", rows: initialLayoutRows, conditions: [], customLogicFormula: "", isLineItemSection: true, isCollapsible: false }] };
  return ensureDefaultFieldsCorrect(defaultConfig);
}

export async function saveFormConfigToSupabase(supabase: SupabaseClient, userId: string, formId: string, name: string, description: string, config: FormConfig): Promise<void> {
  const { error } = await supabase
    .from('forms')
    .update({
      name,
      description,
      config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', formId)
    .eq('user_id', userId);

  if (error) {
    console.error("Error updating form config:", error);
    throw new Error("Failed to update form configuration.");
  }
}