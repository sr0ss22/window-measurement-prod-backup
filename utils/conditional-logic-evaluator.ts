import type { FormFieldCondition } from "@/types/form-config";
import type { WindowItem } from "@/types/window-item";

/**
 * Evaluates a single conditional logic rule against a window item's data.
 * @param condition The FormFieldCondition to evaluate.
 * @param windowItem The window item data.
 * @returns True if the condition is met, false otherwise.
 */
export function evaluateSingleCondition(condition: FormFieldCondition, windowItem: WindowItem): boolean {
  const fieldValue = windowItem[condition.fieldId];
  let result: boolean;
  
  switch (condition.operator) {
    case "equals":
      // Handle boolean values correctly for 'equals'
      if (typeof condition.value === 'boolean') {
        result = fieldValue === condition.value;
      } else {
        // Convert both to string for comparison to handle numbers/strings consistently
        result = String(fieldValue) === String(condition.value);
      }
      break;
    case "notEquals":
      if (typeof condition.value === 'boolean') {
        result = fieldValue !== condition.value;
      } else {
        result = String(fieldValue) !== String(condition.value);
      }
      break;
    case "greaterThan":
      result = typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue > condition.value;
      break;
    case "lessThan":
      result = typeof fieldValue === 'number' && typeof condition.value === 'number' && fieldValue < condition.value;
      break;
    case "isEmpty":
      result = fieldValue === null || fieldValue === undefined || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
      break;
    case "isNotEmpty":
      result = fieldValue !== null && fieldValue !== undefined && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0);
      break;
    default:
      result = true; // Unknown operator, default to true
  }
  return result;
}

/**
 * Validates the syntax of a custom boolean logic formula.
 * Enforces strict bracketing for mixed AND/OR operations.
 * @param formula The formula string to validate.
 * @returns True if the syntax is valid, false otherwise (with console errors).
 */
function validateFormulaSyntax(formula: string): boolean {
  const trimmedFormula = formula.trim();

  if (trimmedFormula === "") {
    console.error("Formula validation error: Formula cannot be empty.");
    return false;
  }

  // Normalize operators for consistent checking
  const normalizedFormula = trimmedFormula.replace(/or/gi, 'OR').replace(/and/gi, 'AND');

  // 1. Check for balanced parentheses
  let openParenCount = 0;
  for (const char of normalizedFormula) {
    if (char === '(') openParenCount++;
    else if (char === ')') openParenCount--;
    if (openParenCount < 0) {
      console.error("Formula validation error: Unmatched closing parenthesis.");
      return false;
    }
  }
  if (openParenCount !== 0) {
    console.error("Formula validation error: Unmatched opening parenthesis.");
    return false;
  }

  // 2. Check for invalid characters (anything not a digit, space, '(', ')', 'AND', 'OR')
  if (/[^0-9()ANDOR\s]/.test(normalizedFormula)) {
    console.error("Formula validation error: Contains invalid characters. Only numbers, '(', ')', 'AND', 'OR', and spaces are allowed.");
    return false;
  }

  // 3. Check for consecutive operators or numbers without operators
  // e.g., "1 AND AND 2", "1 2", "(AND 1)"
  if (/\b(AND|OR)\s+(AND|OR)\b/.test(normalizedFormula) || /\d+\s+\d+/.test(normalizedFormula)) {
    console.error("Formula validation error: Consecutive operators or numbers without operators (e.g., '1 AND AND 2', '1 2').");
    return false;
  }

  // 4. Check for operators at the start or end of the formula
  if (/^\s*(AND|OR)\b|\b(AND|OR)\s*$/.test(normalizedFormula)) {
    console.error("Formula validation error: Formula cannot start or end with an operator.");
    return false;
  }

  // 5. Check for operators immediately after opening parenthesis or before closing parenthesis
  if (/\(\s*(AND|OR)\b|\b(AND|OR)\s*\)/.test(normalizedFormula)) {
    console.error("Formula validation error: Operator immediately inside or outside parenthesis (e.g., '(AND 1)', '1 AND)').");
    return false;
  }

  // 6. Check for empty parentheses
  if (/\(\s*\)/.test(normalizedFormula)) {
    console.error("Formula validation error: Empty parentheses are not allowed.");
    return false;
  }

  // 7. Strict check for mixed operators requiring explicit grouping
  const hasAnd = normalizedFormula.includes('AND');
  const hasOr = normalizedFormula.includes('OR');

  if (hasAnd && hasOr) {
    // If both AND and OR are present, enforce that all operations are explicitly grouped.
    // This is a heuristic: if we find an AND or OR that is not immediately preceded by ')'
    // and followed by '(', it's considered an unparenthesized mixed operation.
    // This regex looks for an operator (AND/OR) that is NOT preceded by ')' and NOT followed by '('.
    // It also handles cases like '1 AND 2 OR 3' where the middle operator is not grouped.
    const unparenthesizedMixedOpRegex = /(?<!\))\s*(AND|OR)\s*(?!\()/;
    
    // Remove all content within balanced parentheses to check for remaining unparenthesized operators
    let tempFormula = normalizedFormula;
    let prevTempFormula = '';
    while (tempFormula !== prevTempFormula) {
      prevTempFormula = tempFormula;
      tempFormula = tempFormula.replace(/\([^()]*\)/g, ''); // Remove innermost parentheses
    }

    // After removing all parenthesized expressions, if there are still AND/OR operators,
    // and both AND and OR were originally present, it means they are unparenthesized mixed ops.
    if (/(AND|OR)/.test(tempFormula)) {
      console.error("Formula validation error: Mixed 'AND' and 'OR' operators require explicit grouping with parentheses for all operations (e.g., '(1 AND 2) OR 3').");
      return false;
    }
  }

  return true;
}

/**
 * Safely evaluates a custom Boolean logic formula string (e.g., "(1 AND 2) OR 3").
 * It replaces condition numbers with their evaluated boolean results and then
 * processes the expression respecting operator precedence and parentheses.
 *
 * @param formula The custom logic formula string.
 * @param allConditions An array of all FormFieldCondition objects for the field.
 * @param windowItem The window item data to evaluate conditions against.
 * @returns The boolean result of the formula evaluation.
 */
export function evaluateCustomLogicFormula(
  formula: string | undefined,
  allConditions: FormFieldCondition[] | undefined, // Changed to allow undefined
  windowItem: WindowItem
): boolean {
  // Ensure allConditions is an array, even if undefined
  const conditionsToEvaluate = allConditions ?? [];

  // If no formula is provided, default to all conditions being ANDed together
  if (!formula || formula.trim() === "") {
    return conditionsToEvaluate.every(cond => evaluateSingleCondition(cond, windowItem));
  }

  // Validate formula syntax first
  if (!validateFormulaSyntax(formula)) {
    console.error(`  Formula: Syntax error in formula '${formula}'. Evaluation aborted.`);
    return false; // Abort evaluation if syntax is invalid
  }

  // Create a map of condition number to its boolean result
  const conditionResults: Record<string, boolean> = {};
  conditionsToEvaluate.forEach((cond, index) => {
    conditionResults[`${index + 1}`] = evaluateSingleCondition(cond, windowItem);
  });

  // Replace condition numbers with their boolean values in the formula
  let evaluatedFormula = formula;
  for (const num in conditionResults) {
    const regex = new RegExp(`\\b${num}\\b`, 'g'); // Use word boundary to match whole numbers
    evaluatedFormula = evaluatedFormula.replace(regex, conditionResults[num].toString());
  }

  // Replace logical operators with JavaScript equivalents (case-insensitive)
  evaluatedFormula = evaluatedFormula.replace(/AND/gi, '&&').replace(/OR/gi, '||');

  try {
    // Recursive function to evaluate expressions with parentheses
    const evaluateExpression = (expr: string): boolean => {
      // First, resolve inner parentheses
      while (expr.includes('(')) {
        const match = expr.match(/\(([^()]+)\)/); // Find innermost parentheses
        if (!match) break; // Should not happen if loop condition is correct
        const innerResult = evaluateExpression(match[1]); // Recursively evaluate inner part
        expr = expr.replace(match[0], innerResult.toString());
      }

      // Now, evaluate the expression without parentheses, respecting AND before OR
      // Split by '||' first
      const orParts = expr.split('||');
      let overallOrResult = false;

      for (const orPart of orParts) {
        // For each 'OR' part, split by '&&'
        const andParts = orPart.split('&&');
        let currentAndResult = true;
        for (const andPart of andParts) {
          const trimmedPart = andPart.trim();
          // Explicitly check for 'true' and 'false' strings
          if (trimmedPart === 'false') {
            currentAndResult = false;
            break; // Short-circuit AND
          } else if (trimmedPart === 'true') {
            // If it's 'true', keep currentAndResult as true (unless it was already false)
            // No change needed here, as currentAndResult starts as true
          } else {
            // If it's not 'true' or 'false', it's an invalid part, treat as false
            currentAndResult = false;
            break;
          }
        }
        if (currentAndResult === true) {
          overallOrResult = true;
          // No short-circuit for OR here, as we need to process all parts to ensure no 'false' is missed
          // if the expression was like 'true || (false && true)'
        }
      }
      return overallOrResult;
    };

    const finalResult = evaluateExpression(evaluatedFormula);
    return finalResult;

  } catch (e) {
    console.error("Error evaluating custom logic formula:", e);
    return false; // Default to false if evaluation fails
  }
}