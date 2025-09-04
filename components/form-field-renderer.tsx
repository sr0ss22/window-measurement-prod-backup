"use client"

import * as React from "react"
import type { FormField, FormFieldOption } from "@/types/form-config"
import type { UploadedFile } from "@/types/window-item"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { Slider } from "@/components/ui/slider"
import { MeasurementInput } from "@/components/measurement-input"
import { Combobox } from "@/components/combobox"
import { WindowTagButtonGroup } from "@/components/window-tag-button-group"
import { SignaturePad } from "@/components/signature-pad"
import { FileUploadInput } from "@/components/file-upload-input"
import { cn } from "@/lib/utils"
import { evaluateCustomLogicFormula } from "@/utils/conditional-logic-evaluator"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleButtonGroup } from "./toggle-button-group"
import { useMobile } from "@/hooks/use-mobile"
import { VisualSelectGroup } from "./visual-select-group"
import { MobileCheckboxButton } from "./mobile-checkbox-button"
import { VoiceComment } from "./voice-comment"

interface FormFieldRendererProps {
  field: FormField
  data: Record<string, any> // Can be WindowItem or GlobalFormData
  onChange: (fieldId: string, value: any) => void
  validationErrors: string[]
  allFieldsForConditions: FormField[] // All fields in the form for conditional logic evaluation
}

export function FormFieldRenderer({
  field,
  data,
  onChange,
  validationErrors,
  allFieldsForConditions,
}: FormFieldRendererProps) {
  const isMobile = useMobile()
  const fieldError = validationErrors.find(err => err.toLowerCase().includes(field.name.toLowerCase()))
  
  const evaluateVisibility = (conditions: FormField['conditions'], customLogic: FormField['customLogicFormula']): boolean => {
    if (!conditions || conditions.length === 0) return true;
    return evaluateCustomLogicFormula(customLogic, conditions, data);
  };

  const getVisibleOptions = (options: FormFieldOption[] | undefined): FormFieldOption[] => {
    if (!options) return [];
    return options.filter(option => evaluateVisibility(option.conditions, option.customLogicFormula));
  };

  // If the field itself is not visible, return null
  if (!evaluateVisibility(field.conditions, field.customLogicFormula)) {
    return null;
  }

  const labelColor = "text-foreground"; // Use the main foreground color for labels
  const requiredIndicator = <span className="text-destructive">*</span>;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name} {field.required && requiredIndicator}
          </Label>
          <Input
            id={`${field.id}-${data.id}`}
            value={data[field.id] || ""}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={fieldError ? "border-destructive" : ""}
            placeholder={field.placeholder}
            minLength={field.minLength}
            maxLength={field.maxLength}
            pattern={field.pattern}
          />
        </div>
      )
    case "combobox":
      return (
        <Combobox
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || ""}
          onChange={(value: string) => onChange(field.id, value)}
          options={field.options || []}
          placeholder={field.placeholder}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "windowTag":
      return (
        <WindowTagButtonGroup
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || ""}
          onChange={(value: string) => onChange(field.id, value)}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "number":
      return (
        <MeasurementInput
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || 0}
          onChange={(value: number) => onChange(field.id, value)}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "picklist": {
      const visibleOptions = getVisibleOptions(field.options);
      const isYesNo = React.useMemo(() => 
        visibleOptions.length === 2 && 
        visibleOptions.some(o => o.value.toLowerCase() === 'yes') && 
        visibleOptions.some(o => o.value.toLowerCase() === 'no'),
      [visibleOptions]);

      if (isMobile && (visibleOptions.length <= 4 || isYesNo)) {
        return (
          <VisualSelectGroup
            id={`${field.id}-${data.id}`}
            label={field.name}
            value={data[field.id] || ""}
            onChange={(value) => onChange(field.id, value)}
            options={visibleOptions}
            required={field.required}
            error={!!fieldError}
            labelColor={labelColor}
          />
        );
      }

      return (
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name} {field.required && requiredIndicator}
          </Label>
          <Select value={data[field.id] || ""} onValueChange={(value) => onChange(field.id, value)}>
            <SelectTrigger id={`${field.id}-${data.id}`} className={fieldError ? "border-destructive" : ""}>
              <SelectValue placeholder={field.placeholder || `Select...`} />
            </SelectTrigger>
            <SelectContent position="popper">
              {visibleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }
    case "radio":
      return (
        <ToggleButtonGroup
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || ""}
          onChange={(value) => onChange(field.id, value)}
          options={getVisibleOptions(field.options) || []}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "slider":
      return (
        <div className="space-y-2">
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name} {field.required && requiredIndicator}
          </Label>
          <div className="flex items-center space-x-4">
            <Slider
              id={`${field.id}-${data.id}`}
              min={field.min || 0}
              max={field.max || 100}
              step={field.step || 1}
              value={[data[field.id] || field.min || 0]}
              onValueChange={(val) => onChange(field.id, val[0])}
              className="flex-1"
            />
            <Input
              type="number"
              value={data[field.id] || field.min || 0}
              onChange={(e) => onChange(field.id, Number(e.target.value))}
              className="w-20 text-center"
            />
          </div>
        </div>
      )
    case "toggle":
      return (
        <div className="flex items-center space-x-2 flex-grow">
          <Switch id={`${field.id}-${data.id}`} checked={!!data[field.id]} onCheckedChange={(checked) => onChange(field.id, checked)} />
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name}
          </Label>
        </div>
      )
    case "checkbox": {
      const surchargeFieldIds = ["takeDown", "hardSurface", "holdDown", "tallWindow12", "tallWindow16"];
      const isSurchargeCheckbox = surchargeFieldIds.includes(field.id);

      if (isMobile || isSurchargeCheckbox) {
        return (
          <MobileCheckboxButton
            id={`${field.id}-${data.id}`}
            label={field.name}
            checked={!!data[field.id]}
            onCheckedChange={(checked: boolean) => onChange(field.id, checked)}
            required={field.required}
            error={!!fieldError}
          />
        );
      }
      return (
        <div className="flex items-center space-x-2 flex-grow">
          <Checkbox
            id={`${field.id}-${data.id}`}
            checked={!!data[field.id]}
            onCheckedChange={(checked: boolean) => onChange(field.id, checked)}
          />
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name}
          </Label>
        </div>
      )
    }
    case "textarea":
      return (
        <div className="space-y-2 col-span-full">
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name} {field.required && requiredIndicator}
          </Label>
          <div className="relative">
            <Textarea
              id={`${field.id}-${data.id}`}
              value={data[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={cn(
                "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                fieldError ? "border-destructive" : "",
              )}
              minLength={field.minLength}
              maxLength={field.maxLength}
            />
          </div>
        </div>
      );
    case "voiceNote":
      return (
        <div className="space-y-2 col-span-full">
          <Label htmlFor={`${field.id}-${data.id}`} className={labelColor}>
            {field.name} {field.required && requiredIndicator}
          </Label>
          <div className="relative">
            <Textarea
              id={`${field.id}-${data.id}`}
              value={data[field.id] || ""}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className={cn(
                "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
                fieldError ? "border-destructive" : "",
                "pr-10 pb-8"
              )}
              minLength={field.minLength}
              maxLength={field.maxLength}
            />
            <VoiceComment
              fieldId={field.id}
              currentValue={data[field.id] || ''}
              onUpdate={onChange}
              aiSummarizationEnabled={field.aiSummarization}
              aiSummarizationRules={field.aiSummarizationRules}
              aiTask={field.aiTask}
            />
          </div>
        </div>
      );
    case "date":
      return (
        <DatePicker
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] ? new Date(data[field.id]) : undefined}
          onChange={(date) => onChange(field.id, date?.toISOString())}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "signature":
      return (
        <SignaturePad
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || null}
          onChange={(value) => onChange(field.id, value)}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
        />
      )
    case "fileUpload":
      return (
        <FileUploadInput
          id={`${field.id}-${data.id}`}
          label={field.name}
          value={data[field.id] || []}
          onChange={(files) => onChange(field.id, files)}
          required={field.required}
          error={!!fieldError}
          labelColor={labelColor}
          allowMultiple={field.allowMultiple}
          allowedFileTypes={field.allowedFileTypes}
        />
      )
    case "spacer":
      return <div />
    default:
      return null
  }
}