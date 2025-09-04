import type { WindowItem, GlobalFormData } from "@/types/window-item"
import type { FormField } from "@/types/form-config"

// Validation function for individual window items
export function validateWindow(window: WindowItem, formFields: FormField[]): string[] {
  const errors: string[] = []

  formFields.forEach(field => {
    if (field.required) {
      const fieldValue = window[field.id];
      
      // General check for empty values
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        errors.push(`${field.name} is required`);
      }

      // Specific validation for numbers
      if (field.type === 'number' && typeof fieldValue === 'number') {
        if (field.min !== undefined && fieldValue < field.min) {
          errors.push(`${field.name} must be greater than or equal to ${field.min}`);
        }
        if (field.max !== undefined && fieldValue > field.max) {
          errors.push(`${field.name} must be less than or equal to ${field.max}`);
        }
      }
      // Specific validation for text/textarea length
      if ((field.type === 'text' || field.type === 'textarea' || field.type === 'voiceNote') && typeof fieldValue === 'string') {
        if (field.minLength !== undefined && fieldValue.length < field.minLength) {
          errors.push(`${field.name} must be at least ${field.minLength} characters long`);
        }
        if (field.maxLength !== undefined && fieldValue.length > field.maxLength) {
          errors.push(`${field.name} must be at most ${field.maxLength} characters long`);
        }
        if (field.pattern && !new RegExp(field.pattern).test(fieldValue)) {
          errors.push(`${field.name} format is invalid`);
        }
      }
      // Specific validation for signature
      if (field.type === 'signature' && !fieldValue) {
        errors.push(`${field.name} is required`);
      }
      // Specific validation for fileUpload
      if (field.type === 'fileUpload' && (!Array.isArray(fieldValue) || fieldValue.length === 0)) {
        errors.push(`${field.name} is required`);
      }
    }
  });

  return errors
}

// Validation function for global fields
export function validateGlobalData(data: GlobalFormData, formFields: FormField[]): string[] {
  const errors: string[] = [];
  formFields.forEach(field => {
    if (field.required) {
      const fieldValue = data[field.id];
      if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
        errors.push(`${field.name} is required`);
      }
      // Add more specific validations if needed, similar to validateWindow
    }
  });
  return errors;
}