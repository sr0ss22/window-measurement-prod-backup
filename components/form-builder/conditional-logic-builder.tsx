"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormField, FormFieldCondition, FormFieldOption } from "@/types/form-config";
import { formatConditionListForDisplay } from "@/utils/conditional-logic-formula-builder";

interface ConditionalLogicBuilderProps {
  conditions: FormFieldCondition[];
  customLogicFormula: string | undefined;
  onConditionsChange: (conditions: FormFieldCondition[]) => void;
  onCustomLogicFormulaChange: (formula: string | undefined) => void;
  availableFields: FormField[];
}

export function ConditionalLogicBuilder({
  conditions,
  customLogicFormula,
  onConditionsChange,
  onCustomLogicFormulaChange,
  availableFields,
}: ConditionalLogicBuilderProps) {
  const [logicType, setLogicType] = useState<"AND" | "OR">(customLogicFormula?.includes("OR") ? "OR" : "AND");

  // Sync internal state with props
  useEffect(() => {
    setLogicType(customLogicFormula?.includes("OR") ? "OR" : "AND");
  }, [customLogicFormula]);

  const generateFormula = useCallback((currentConditions: FormFieldCondition[], currentLogicType: "AND" | "OR") => {
    if (currentConditions.length === 0) {
      return undefined;
    }
    if (currentConditions.length === 1) {
      return "1"; // Single condition, no operator needed
    }
    const conditionNumbers = currentConditions.map((_, index) => index + 1);
    const operator = currentLogicType === "AND" ? "AND" : "OR";
    return `(${conditionNumbers.join(` ${operator} `)})`;
  }, []);

  useEffect(() => {
    const generatedFormula = generateFormula(conditions, logicType);
    if (generatedFormula !== customLogicFormula) {
      onCustomLogicFormulaChange(generatedFormula);
    }
  }, [conditions, logicType, generateFormula, onCustomLogicFormulaChange, customLogicFormula]);

  const handleConditionChange = useCallback(
    (index: number, key: keyof FormFieldCondition, value: any) => {
      const newConditions = [...conditions];
      if (key === "operator") {
        newConditions[index] = { ...newConditions[index], [key]: value as FormFieldCondition['operator'] };
      } else {
        newConditions[index] = { ...newConditions[index], [key]: value };
      }
      onConditionsChange(newConditions);
    },
    [conditions, onConditionsChange]
  );

  const addCondition = useCallback(() => {
    const newCondition: FormFieldCondition = { fieldId: "", operator: "equals", value: "" };
    onConditionsChange([...conditions, newCondition]);
  }, [conditions, onConditionsChange]);

  const removeCondition = useCallback(
    (index: number) => {
      const newConditions = [...conditions];
      newConditions.splice(index, 1);
      onConditionsChange(newConditions);
    },
    [conditions, onConditionsChange]
  );

  const handleLogicTypeChange = useCallback((value: string) => {
    setLogicType(value as "AND" | "OR");
  }, []);

  const conditionListString = formatConditionListForDisplay(conditions, availableFields);
  const displayFormula = customLogicFormula || "No custom logic defined";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        This element will only be shown if the following conditions are met.
      </p>
      
      <div className="p-2 border rounded-md bg-blue-50 text-blue-800 text-sm font-mono">
        Conditions: {conditionListString}
      </div>

      <div className="space-y-2">
        {conditions.map((condition, index) => {
          const targetField = availableFields.find(f => f.id === condition.fieldId);
          const isPicklistOrRadioOrComboboxTarget = targetField && (targetField.type === "picklist" || targetField.type === "radio" || targetField.type === "combobox");

          return (
            <div key={index} className="flex flex-col gap-2 p-2 border rounded-md bg-gray-50">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-gray-700">{index + 1}:</span>
                <Select
                  value={condition.fieldId}
                  onValueChange={(val) => handleConditionChange(index, "fieldId", val)}
                >
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select Field..." /></SelectTrigger>
                  <SelectContent>
                    {availableFields.map(f => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(val) => handleConditionChange(index, "operator", val)}
                >
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Operator" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="notEquals">Not Equal</SelectItem>
                    <SelectItem value="greaterThan">Greater Than</SelectItem>
                    <SelectItem value="lessThan">Less Than</SelectItem>
                    <SelectItem value="isEmpty">Is Empty</SelectItem>
                    <SelectItem value="isNotEmpty">Is Not Empty</SelectItem>
                  </SelectContent>
                </Select>
                {(condition.operator !== "isEmpty" && condition.operator !== "isNotEmpty") && (
                  isPicklistOrRadioOrComboboxTarget ? (
                    <Select
                      value={condition.value?.toString() || ""}
                      onValueChange={(val) => handleConditionChange(index, "value", val)}
                    >
                      <SelectTrigger className="w-[150px]"><SelectValue placeholder="Select Value" /></SelectTrigger>
                      <SelectContent>
                        {targetField?.options?.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Value"
                      value={condition.value?.toString() || ""}
                      onChange={(e) => handleConditionChange(index, "value", e.target.value)}
                      className="w-[150px]"
                    />
                  )
                )}
                <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={addCondition}>
          <Plus className="mr-2 h-4 w-4" /> Add Condition
        </Button>
      </div>

      {conditions.length > 1 && (
        <div className="mt-4 space-y-2">
          <Label>Combine Conditions Using:</Label>
          <RadioGroup
            value={logicType}
            onValueChange={handleLogicTypeChange}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="AND" id="logic-and" />
              <Label htmlFor="logic-and">ALL (AND)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="OR" id="logic-or" />
              <Label htmlFor="logic-or">ANY (OR)</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <Label>Generated Logic Formula</Label>
        <Textarea
          value={displayFormula}
          readOnly
          className="font-mono bg-gray-100 cursor-not-allowed"
          rows={3}
        />
      </div>
    </div>
  );
}