"use client";

import type { FormField, FormFieldOption, FormFieldCondition } from "@/types/form-config";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ConditionalLogicBuilder } from "./conditional-logic-builder";
import { Switch } from "@/components/ui/switch";

interface FieldEditorProps {
  field: FormField;
  updateField: (field: FormField) => void;
  removeField: (id: string) => void;
  cloneField: (id: string) => void;
  allFieldsForConditions: FormField[];
  isIdUnique: (id: string) => boolean;
}

export function FieldEditor({ field, updateField, removeField, cloneField, allFieldsForConditions, isIdUnique }: FieldEditorProps) {
  const [idError, setIdError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { type: "FIELD", field },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const handleIdChange = (newId: string) => {
    if (!field.isDefault && newId !== field.id) {
      if (!isIdUnique(newId)) {
        setIdError("Field ID must be unique.");
      } else {
        setIdError(null);
      }
    } else {
      setIdError(null);
    }
    handleFieldChange("id", newId);
  };

  const handleFieldChange = (key: keyof FormField, value: any) => {
    updateField({ ...field, [key]: value });
  };

  const handleOptionChange = (index: number, key: keyof FormFieldOption, value: any) => {
    const newOptions = [...(field.options || [])];
    newOptions[index] = { ...newOptions[index], [key]: value };
    handleFieldChange("options", newOptions);
  };

  const addOption = () => {
    const newOptions = [...(field.options || []), { value: "", label: "", conditions: [], customLogicFormula: "" }];
    handleFieldChange("options", newOptions);
  };

  const removeOption = (index: number) => {
    const newOptions = [...(field.options || [])];
    newOptions.splice(index, 1);
    handleFieldChange("options", newOptions);
  };

  const handleOptionConditionsChange = (optionIndex: number, newConditions: FormFieldCondition[]) => {
    const newOptions = [...(field.options || [])];
    newOptions[optionIndex] = { ...newOptions[optionIndex], conditions: newConditions };
    handleFieldChange("options", newOptions);
  };

  const handleOptionCustomLogicFormulaChange = (optionIndex: number, newFormula: string | undefined) => {
    const newOptions = [...(field.options || [])];
    newOptions[optionIndex] = { ...newOptions[optionIndex], customLogicFormula: newFormula };
    handleFieldChange("options", newOptions);
  };

  const handleFieldConditionsChange = (newConditions: FormFieldCondition[]) => {
    updateField({ ...field, conditions: newConditions });
  };

  const handleFieldCustomLogicFormulaChange = (newFormula: string | undefined) => {
    updateField({ ...field, customLogicFormula: newFormula });
  };

  const handleDeleteField = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteField = () => {
    removeField(field.id);
    setIsDeleteDialogOpen(false);
  };

  const isSpacer = field.type === "spacer";
  const isTextOrTextarea = field.type === "text" || field.type === "textarea";
  const isNumberOrSlider = field.type === "number" || field.type === "slider";
  const isPicklistOrRadioOrCombobox = field.type === "picklist" || field.type === "radio" || field.type === "combobox";
  const isWindowTag = field.type === "windowTag";
  const isFileUpload = field.type === "fileUpload";
  const canHaveAI = field.type === "textarea" || field.type === "voiceNote"; // Updated to include voiceNote

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Accordion type="single" collapsible className="w-full bg-white rounded-lg border">
        <AccordionItem value={field.id} className="border-b-0">
          <AccordionTrigger className="p-4 hover:no-underline">
            <div className="flex items-center space-x-4 w-full">
              <div {...attributes} {...listeners} className="cursor-grab text-gray-400">
                <GripVertical className="h-5 w-5" />
              </div>
              <span className="font-medium text-lg truncate">{field.name}</span>
              <span className="text-sm text-gray-500 capitalize">({field.type})</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`name-${field.id}`}>Field Name / Label</Label>
                <Input
                  id={`name-${field.id}`}
                  value={field.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  disabled={isSpacer}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`id-${field.id}`}>Field ID (Backend Name)</Label>
                <Input
                  id={`id-${field.id}`}
                  value={field.id}
                  onChange={(e) => handleIdChange(e.target.value)}
                  disabled={field.isDefault || isSpacer}
                  className={idError ? "border-red-500" : ""}
                />
                {idError && <p className="text-sm text-red-500">{idError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`type-${field.id}`}>Field Type</Label>
                <Select
                  value={field.type}
                  onValueChange={(value) => handleFieldChange("type", value)}
                  disabled={field.isDefault}
                >
                  <SelectTrigger id={`type-${field.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="picklist">Dropdown / Select</SelectItem>
                    <SelectItem value="radio">Radio Buttons</SelectItem>
                    <SelectItem value="slider">Slider / Range</SelectItem>
                    <SelectItem value="toggle">Toggle (Yes/No)</SelectItem>
                    <SelectItem value="textarea">Text Area</SelectItem>
                    <SelectItem value="voiceNote">Voice Note</SelectItem> {/* Added Voice Note */}
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="combobox">Combobox</SelectItem>
                    <SelectItem value="windowTag">Window Tag (L-C-R / 1-5)</SelectItem>
                    <SelectItem value="signature">Signature</SelectItem>
                    <SelectItem value="fileUpload">File Upload</SelectItem>
                    <SelectItem value="spacer">Spacer (Blank Field)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!isSpacer && (
                <div className="space-y-2">
                  <Label htmlFor={`placeholder-${field.id}`}>Placeholder</Label>
                  <Input
                    id={`placeholder-${field.id}`}
                    value={field.placeholder || ""}
                    onChange={(e) => handleFieldChange("placeholder", e.target.value)}
                  />
                </div>
              )}
              {!isSpacer && (
                <div className="flex items-center space-x-2 pt-8">
                    <Checkbox
                        id={`required-${field.id}`}
                        checked={field.required}
                        onCheckedChange={(checked: boolean) => handleFieldChange("required", !!checked)}
                        disabled={field.isDefault}
                    />
                    <Label htmlFor={`required-${field.id}`}>Required Field</Label>
                </div>
              )}
            </div>

            {isTextOrTextarea && (
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <div className="space-y-2">
                  <Label htmlFor={`minLength-${field.id}`}>Min Length</Label>
                  <Input
                    id={`minLength-${field.id}`}
                    type="number"
                    value={field.minLength || ""}
                    onChange={(e) => handleFieldChange("minLength", Number(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`maxLength-${field.id}`}>Max Length</Label>
                  <Input
                    id={`maxLength-${field.id}`}
                    type="number"
                    value={field.maxLength || ""}
                    onChange={(e) => handleFieldChange("maxLength", Number(e.target.value) || undefined)}
                  />
                </div>
                {field.type === "text" && (
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`pattern-${field.id}`}>Regex Pattern (e.g., for Email, URL)</Label>
                    <Input
                      id={`pattern-${field.id}`}
                      value={field.pattern || ""}
                      onChange={(e) => handleFieldChange("pattern", e.target.value)}
                      placeholder="e.g., ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
                    />
                  </div>
                )}
              </div>
            )}

            {canHaveAI && (
              <div className="mt-6 border-t pt-4 md:col-span-2">
                <h4 className="font-medium mb-2">AI Processing</h4>
                <div className="flex items-center space-x-2 mb-4">
                  <Switch
                    id={`aiSummarization-${field.id}`}
                    checked={!!field.aiSummarization}
                    onCheckedChange={(checked) => handleFieldChange("aiSummarization", checked)}
                  />
                  <Label htmlFor={`aiSummarization-${field.id}`}>Enable AI for this Text Area</Label>
                </div>
                {field.aiSummarization && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`aiTask-${field.id}`}>AI Task</Label>
                      <Select
                        value={field.aiTask || 'summarize_and_extract'}
                        onValueChange={(value) => handleFieldChange("aiTask", value)}
                      >
                        <SelectTrigger id={`aiTask-${field.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="summarize_and_extract">Summarize and Extract Measurements</SelectItem>
                          <SelectItem value="summarize">Summarize Text Only</SelectItem>
                          <SelectItem value="extract_measurements">Extract Measurements Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`aiRules-${field.id}`}>Custom Rules/Context</Label>
                      <Textarea
                        id={`aiRules-${field.id}`}
                        value={field.aiSummarizationRules || ""}
                        onChange={(e) => handleFieldChange("aiSummarizationRules", e.target.value)}
                        placeholder="e.g., Summarize in a professional, matter-of-fact tone. Do not use 'I'. Group information by line number if mentioned."
                        rows={4}
                      />
                      <p className="text-xs text-gray-500">Provide additional instructions for the AI to follow.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isNumberOrSlider && (
              <div className="grid gap-6 md:grid-cols-3 mt-6">
                <div className="space-y-2">
                  <Label htmlFor={`min-${field.id}`}>Min Value</Label>
                  <Input
                    id={`min-${field.id}`}
                    type="number"
                    step="any"
                    value={field.min || ""}
                    onChange={(e) => handleFieldChange("min", Number(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`max-${field.id}`}>Max Value</Label>
                  <Input
                    id={`max-${field.id}`}
                    type="number"
                    step="any"
                    value={field.max || ""}
                    onChange={(e) => handleFieldChange("max", Number(e.target.value) || undefined)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`step-${field.id}`}>Step Value</Label>
                  <Input
                    id={`step-${field.id}`}
                    type="number"
                    step="any"
                    value={field.step || ""}
                    onChange={(e) => handleFieldChange("step", Number(e.target.value) || undefined)}
                  />
                </div>
              </div>
            )}

            {isPicklistOrRadioOrCombobox && (
              <div className="mt-6">
                <h4 className="font-medium mb-2">Options</h4>
                <div className="space-y-2">
                  {field.options?.map((option, optionIndex) => {
                    return (
                      <Accordion type="single" collapsible key={optionIndex} className="w-full border rounded-md">
                        <AccordionItem value={`option-${optionIndex}`} className="border-b-0">
                          <AccordionTrigger className="p-3 hover:no-underline">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{option.label || `Option ${optionIndex + 1}`}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="p-3 border-t bg-gray-50">
                            <div className="grid gap-4">
                              <div className="space-y-2">
                                <Label htmlFor={`option-value-${field.id}-${optionIndex}`}>Option Value</Label>
                                <Input
                                  id={`option-value-${field.id}-${optionIndex}`}
                                  placeholder="Value"
                                  value={option.value}
                                  onChange={(e) => handleOptionChange(optionIndex, "value", e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`option-label-${field.id}-${optionIndex}`}>Option Label</Label>
                                <Input
                                  id={`option-label-${field.id}-${optionIndex}`}
                                  placeholder="Label"
                                  value={option.label}
                                  onChange={(e) => handleOptionChange(optionIndex, "label", e.target.value)}
                                />
                              </div>

                              <div className="mt-4 border-t pt-4">
                                <h5 className="font-medium mb-2">Option Visibility Logic</h5>
                                <ConditionalLogicBuilder
                                  conditions={option.conditions || []}
                                  customLogicFormula={option.customLogicFormula}
                                  onConditionsChange={(newConditions) => handleOptionConditionsChange(optionIndex, newConditions)}
                                  onCustomLogicFormulaChange={(newFormula) => handleOptionCustomLogicFormulaChange(optionIndex, newFormula)}
                                  availableFields={allFieldsForConditions}
                                />
                              </div>

                              <div className="flex justify-end mt-4">
                                <Button variant="ghost" size="icon" onClick={() => removeOption(optionIndex)}>
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    );
                  })}
                </div>
                <Button variant="outline" size="sm" onClick={addOption} className="mt-2">
                    <Plus className="mr-2 h-4 w-4" /> Add Option
                </Button>
              </div>
            )}

            {isFileUpload && (
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="flex items-center space-x-2 pt-8">
                  <Checkbox
                    id={`allowMultiple-${field.id}`}
                    checked={field.allowMultiple}
                    onCheckedChange={(checked: boolean) => handleFieldChange("allowMultiple", !!checked)}
                  />
                  <Label htmlFor={`allowMultiple-${field.id}`}>Allow Multiple Files</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`allowedFileTypes-${field.id}`}>Allowed File Types (comma-separated MIME types)</Label>
                  <Input
                    id={`allowedFileTypes-${field.id}`}
                    value={field.allowedFileTypes?.join(", ") || ""}
                    onChange={(e) => handleFieldChange("allowedFileTypes", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                    placeholder="e.g., image/*, application/pdf"
                  />
                  <p className="text-xs text-gray-500">Use `image/*` for all image types, `application/pdf` for PDFs.</p>
                </div>
              </div>
            )}

            {!isSpacer && !isWindowTag && (
              <div className="mt-6 border-t pt-4">
                <h4 className="font-medium mb-2">Field Visibility Logic</h4>
                <ConditionalLogicBuilder
                  conditions={field.conditions || []}
                  customLogicFormula={field.customLogicFormula}
                  onConditionsChange={handleFieldConditionsChange}
                  onCustomLogicFormulaChange={handleFieldCustomLogicFormulaChange}
                  availableFields={allFieldsForConditions}
                />
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t flex justify-end space-x-2">
              <Button variant="outline" onClick={() => cloneField(field.id)}>
                  <Copy className="mr-2 h-4 w-4" /> Clone Field
              </Button>
              {!field.isDefault && (
                  <Button variant="destructive" onClick={handleDeleteField}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete Field
                  </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this field?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The field "{field.name}" will be permanently removed from your form configuration.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteField} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}