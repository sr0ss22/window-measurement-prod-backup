export type FieldType = "text" | "number" | "picklist" | "checkbox" | "textarea" | "date" | "toggle" | "radio" | "slider" | "spacer" | "combobox" | "windowTag" | "signature" | "fileUpload" | "voiceNote";

export interface FormFieldOption {
  value: string;
  label: string;
  conditions?: FormFieldCondition[];
  customLogicFormula?: string;
}

export interface FormFieldCondition {
  fieldId: string;
  operator: "equals" | "notEquals" | "greaterThan" | "lessThan" | "isEmpty" | "isNotEmpty";
  value?: string | number | boolean;
}

export interface FormField {
  id: string;
  name: string;
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
  // New properties for fileUpload type
  allowMultiple?: boolean;
  allowedFileTypes?: string[]; // e.g., ['image/*', 'application/pdf']
  // New properties for AI summarization on textareas and voice notes
  aiSummarization?: boolean; // Now applies to voiceNote type inherently
  aiSummarizationRules?: string;
  aiTask?: 'summarize' | 'extract_measurements' | 'summarize_and_extract';
}

// New: Represents a layout row within a section
export interface FieldLayoutRow {
  id: string;
  fields: FormField[];
}

// Renamed from FormRow to FormSection
export interface FormSection {
  id: string;
  label?: string;
  conditions?: FormFieldCondition[];
  customLogicFormula?: string;
  rows: FieldLayoutRow[]; // A section now contains layout rows
  isLineItemSection?: boolean; // New: true for fields repeated per window, false for global fields
  isCollapsible?: boolean; // New: true if the section can be collapsed
  enableSectionVoice?: boolean; // New: true to enable a section-level voice input button
  sectionVoiceLabel?: string; // New: Label for the voice button
  sectionVoiceTooltip?: string; // New: Tooltip for the voice button
}

export interface FormConfig {
  sections: FormSection[]; // Renamed from rows to sections
}