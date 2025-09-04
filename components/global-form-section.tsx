"use client"

import React from "react" // Import React
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { FormSection, FormField, FieldLayoutRow } from "@/types/form-config"
import type { GlobalFormData } from "@/types/window-item"
import { FormFieldRenderer } from "./form-field-renderer"
import { evaluateCustomLogicFormula } from "@/utils/conditional-logic-evaluator"
import { useFormConfig } from "@/context/form-config-context"
import { cn } from "@/lib/utils" // Import cn utility
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion" // Import Accordion components
import { SectionVoiceButton } from "./section-voice-button"
import { useWindowContext } from "@/context/window-context"

interface GlobalFormSectionProps {
  section: FormSection
  globalFormData: GlobalFormData
  updateGlobalFormData: (fieldId: string, value: any) => void
  validationErrors: string[]
}

// Helper to determine if a field is "compact" (suitable for inline display)
const isCompactField = (field: FormField) => {
  return field.type === 'checkbox' || field.type === 'toggle';
};

export function GlobalFormSection({
  section,
  globalFormData,
  updateGlobalFormData,
  validationErrors,
}: GlobalFormSectionProps) {
  const { state: formConfigState } = useFormConfig();
  const { bulkUpdateGlobal } = useWindowContext();

  const evaluateVisibility = (conditions: FormField['conditions'], customLogic: FormField['customLogicFormula']): boolean => {
    if (!conditions || conditions.length === 0) return true;
    return evaluateCustomLogicFormula(customLogic, conditions, globalFormData);
  };

  // Get all fields from all sections for conditional logic dropdowns
  const allFieldsForConditions = React.useMemo(() => 
    formConfigState.config.sections.flatMap(s => s.rows.flatMap(r => r.fields))
  , [formConfigState.config.sections]);

  if (!evaluateVisibility(section.conditions, section.customLogicFormula)) {
    return null;
  }

  // Filter fields that are actually visible based on their own conditions
  const fieldsToRenderInThisSection = section.rows.flatMap(r => r.fields).filter(f =>
    evaluateVisibility(f.conditions, f.customLogicFormula)
  );

  if (fieldsToRenderInThisSection.length === 0 && !section.label && !section.isCollapsible) {
    return null;
  }

  const sectionContent = (
    <div className="space-y-6">
      {section.rows.map((row) => {
        const fieldsToRenderInRow = row.fields.filter(f => evaluateVisibility(f.conditions, f.customLogicFormula));
        if (fieldsToRenderInRow.length === 0) return null;

        const isThisRowCompact = fieldsToRenderInRow.every(isCompactField);

        return (
          <div
            key={row.id}
            className={cn(
              "gap-6", // Common gap for both grid and flex
              isThisRowCompact
                ? "flex flex-wrap gap-y-2" // Flex layout for compact rows
                : `grid grid-cols-1 md:grid-cols-${Math.min(fieldsToRenderInRow.length, 4)}` // Grid for regular rows, max 4 columns
            )}
          >
            {fieldsToRenderInRow.map((field) => (
              <FormFieldRenderer
                key={field.id}
                field={field}
                data={globalFormData}
                onChange={updateGlobalFormData}
                validationErrors={validationErrors}
                allFieldsForConditions={allFieldsForConditions}
              />
            ))}
          </div>
        );
      })}
    </div>
  );

  const sectionHeader = (
    <div className="flex items-center justify-between pt-4 mb-4">
      <div className="flex items-center">
        <h3 className="text-lg font-semibold text-gray-800 whitespace-nowrap">{section.label}</h3>
        {section.enableSectionVoice && (
          <div className="ml-4">
            <SectionVoiceButton
              sectionFields={fieldsToRenderInThisSection}
              currentData={globalFormData}
              onBulkUpdate={bulkUpdateGlobal}
              label={section.sectionVoiceLabel}
              tooltip={section.sectionVoiceTooltip}
            />
          </div>
        )}
      </div>
      <div className="flex-1 ml-4"><Separator /></div>
    </div>
  );

  if (section.isCollapsible) {
    return (
      <Card className="border-2 border-gray-200">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value={section.id} className="border-b-0">
            <AccordionTrigger className="p-4 hover:no-underline">
              <h3 className="text-lg font-semibold text-gray-800">{section.label || "Section"}</h3>
            </AccordionTrigger>
            <AccordionContent className="p-4 border-t">
              {sectionContent}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
    );
  } else {
    return (
      <Card className="border-2 border-gray-200">
        <CardContent className="p-4 space-y-4">
          {section.label && sectionHeader}
          {sectionContent}
        </CardContent>
      </Card>
    );
  }
}