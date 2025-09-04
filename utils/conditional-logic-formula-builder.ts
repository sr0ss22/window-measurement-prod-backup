import type { FormFieldCondition, FormField } from "@/types/form-config";

/**
 * Formats a list of conditions into a human-readable string for display,
 * numbering each condition. This is used when the user defines a custom logic formula.
 *
 * @param conditions An array of FormFieldCondition objects.
 * @param allFields An array of all FormField objects, used to resolve field names.
 * @returns A string listing the conditions (e.g., "1: Product equals 'Duette'").
 */
export function formatConditionListForDisplay(
  conditions: FormFieldCondition[],
  allFields: FormField[]
): string {
  if (!conditions || conditions.length === 0) {
    return "No conditions defined.";
  }

  return conditions.map((condition, index) => {
    const field = allFields.find(f => f.id === condition.fieldId);
    const fieldName = field ? field.name : condition.fieldId;
    let operatorText = "";
    let valueText = "";

    switch (condition.operator) {
      case "equals":
        operatorText = "equals";
        valueText = `'${condition.value}'`;
        break;
      case "notEquals":
        operatorText = "not equal";
        valueText = `'${condition.value}'`;
        break;
      case "greaterThan":
        operatorText = "greater than";
        valueText = `${condition.value}`;
        break;
      case "lessThan":
        operatorText = "less than";
        valueText = `${condition.value}`;
        break;
      case "isEmpty":
        operatorText = "is empty";
        valueText = "";
        break;
      case "isNotEmpty":
        operatorText = "is not empty";
        valueText = "";
        break;
      default:
        operatorText = "has unknown operator";
        valueText = "";
    }

    return `${index + 1}: ${fieldName} ${operatorText} ${valueText}`.trim();
  }).join(", ");
}