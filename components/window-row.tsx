"use client"

import React, { useState, useCallback } from "react" // Import React
import type { WindowItem, WindowBounds, UploadedFile } from "@/types/window-item"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ChevronDown, ChevronUp, Copy, GripVertical, Trash2, Ruler, ClipboardPaste, PlusSquare, AlertTriangle, CheckCircle2, MoreVertical } from "lucide-react"
import { AnnotationCanvas } from "./annotation-canvas"
import { useWindowContext } from "@/context/window-context"
import { formatMeasurement } from "@/utils/measurements"
import { useToast } from "@/components/ui/use-toast"
import { MeasureWizard } from "./measure-wizard/measure-wizard"
import { Badge } from "@/components/ui/badge"
import { useFormConfig } from "@/context/form-config-context"
import type { FormField, FormFieldOption, FormSection, FieldLayoutRow } from "@/types/form-config"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { Slider } from "@/components/ui/slider"
import { MeasurementInput } from "./measurement-input"
import { evaluateCustomLogicFormula } from "@/utils/conditional-logic-evaluator";
import { Combobox } from "./combobox";
import { Separator } from "@/components/ui/separator"
import { WindowTagButtonGroup } from "./window-tag-button-group";
import { SignaturePad } from "./signature-pad"; // New import
import { FileUploadInput } from "./file-upload-input"; // New import
import { FormFieldRenderer } from "./form-field-renderer"; // New import
import { cn } from "@/lib/utils" // Import cn utility
import { useMobile } from "@/hooks/use-mobile" // Import useMobile hook
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion" // Import Accordion components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SectionVoiceButton } from "./section-voice-button"

interface WindowRowProps {
  window: WindowItem
  validationErrors: string[]
  isActive: boolean
}

// Helper to determine if a field is "compact" (suitable for inline display)
const isCompactField = (field: FormField) => {
  return field.type === 'checkbox' || field.type === 'toggle';
};

// Helper function to get static grid column classes for desktop
const getGridColsClass = (count: number): string => {
  const numCols = Math.min(count, 4);
  switch (numCols) {
    case 1:
      return "md:grid-cols-1";
    case 2:
      return "md:grid-cols-2";
    case 3:
      return "md:grid-cols-3";
    case 4:
      return "md:grid-cols-4";
    default:
      return "md:grid-cols-1";
  }
};

// Helper function to get static grid column classes for compact rows (surcharges)
const getCompactGridClass = (count: number): string => {
  switch (count) {
    case 1: return "grid-cols-1";
    case 2: return "grid-cols-2";
    case 3: return "grid-cols-3";
    case 4: return "grid-cols-4";
    default: return "grid-cols-1"; // Fallback for > 4 items, will wrap
  }
};

export function WindowRow({ window, validationErrors, isActive }: WindowRowProps) {
  const { updateWindow, removeWindow, duplicateWindow, toggleExpand, copyWindowConfig, pasteWindowConfig, state: { copiedWindowConfig }, bulkUpdateWindow } = useWindowContext()
  const { state: formConfigState } = useFormConfig()
  const { toast } = useToast()
  const isMobile = useMobile(); // Use useMobile hook

  const [isMeasureWizardOpen, setIsMeasureWizardOpen] = useState(false)
  const [isPasteConfirmOpen, setIsPasteConfirmOpen] = useState(false);

  const onOpenMeasureWizard = () => setIsMeasureWizardOpen(true)

  const handleChange = (fieldId: string, value: any) => {
    // Special handling for signature and file upload to mark as dirty
    if (fieldId === 'signature') {
      updateWindow({ ...window, [fieldId]: value, isSignatureDirty: true });
    } else if (fieldId === 'uploadedFiles') {
      updateWindow({ ...window, [fieldId]: value, isFilesDirty: true });
    } else {
      updateWindow({ ...window, [fieldId]: value });
    }
  }

  const handleRemove = async () => {
    await removeWindow(window.id)
    toast({ title: "Window Removed" })
  }

  const handleDuplicate = async () => {
    await duplicateWindow(window.id)
    toast({ title: "Window Duplicated" })
  }

  const handleCopy = () => {
    copyWindowConfig(window.id);
    toast({
      title: "Configuration Copied",
      description: `Configuration from Line #${window.lineNumber} is ready to be pasted.`,
    });
  };

  const handlePaste = () => {
    pasteWindowConfig(window.id);
    setIsPasteConfirmOpen(false);
    toast({
      title: "Configuration Pasted",
      description: `Configuration applied to Line #${window.lineNumber}.`,
    });
  };

  const handleWizardSave = async (wizardData: {
    wizardImage: string | null
    wizardWindowBounds: WindowBounds | null
    wizardMeasurements: { widths: { T: number; M: number; B: number }; heights: { L: number; C: number; R: number }; } | null
  }) => {
    const updatedWindow = { ...window };
    updatedWindow.wizardImage = wizardData.wizardImage;
    updatedWindow.wizardWindowBounds = wizardData.wizardWindowBounds;
    updatedWindow.wizardMeasurements = wizardData.wizardMeasurements;

    if (wizardData.wizardImage && !window.image) {
      updatedWindow.image = wizardData.wizardImage;
      updatedWindow.imageMetadata = { uploadedAt: new Date().toISOString(), modifiedAt: new Date().toISOString(), uploadedBy: "Measure Wizard" };
      updatedWindow.isImageDirty = true;
    }

    if (updatedWindow.imageMetadata) {
      updatedWindow.imageMetadata.modifiedAt = new Date().toISOString();
    }

    if (wizardData.wizardMeasurements) {
      const { widths, heights } = wizardData.wizardMeasurements;
      
      const validWidths = [widths.T, widths.M, widths.B]
        .filter(val => typeof val === 'number' && isFinite(val) && val > 0);
      if (validWidths.length > 0) {
        updatedWindow.width = Math.min(...validWidths);
      } else {
        updatedWindow.width = 0;
      }

      const validHeights = [heights.L, heights.C, heights.R]
        .filter(val => typeof val === 'number' && isFinite(val) && val > 0);
      if (validHeights.length > 0) {
        updatedWindow.height = Math.min(...validHeights);
      } else {
        updatedWindow.height = 0;
      }
    }

    updatedWindow.wizard_image_path = undefined;
    updatedWindow.wizard_data_path = undefined;

    await updateWindow(updatedWindow);
    toast({ title: "Measurements Saved" });
  }

  const handleImageUpdate = useCallback(async (imageData: string | null, metadata?: { uploadedAt: string; modifiedAt: string; uploadedBy: string }) => {
    const updatedWindow = { ...window, image: imageData ?? null, isImageDirty: true };
    if (metadata) updatedWindow.imageMetadata = metadata;
    else if (imageData && !updatedWindow.imageMetadata) {
      const now = new Date().toISOString();
      updatedWindow.imageMetadata = { uploadedAt: now, modifiedAt: now, uploadedBy: "Field Installer" };
    }
    if (!imageData) updatedWindow.imageMetadata = undefined;
    await updateWindow(updatedWindow);
  }, [window, updateWindow]);

  const handleAnnotationsUpdate = useCallback(async (annotationData: string | null) => {
    const updatedWindow = { ...window, annotations: annotationData ?? null, isAnnotationsDirty: true };
    if (updatedWindow.imageMetadata) updatedWindow.imageMetadata.modifiedAt = new Date().toISOString();
    await updateWindow(updatedWindow);
  }, [window, updateWindow]);

  const evaluateSectionVisibility = (conditions: FormField['conditions'], customLogic: FormField['customLogicFormula']): boolean => {
    if (!conditions || conditions.length === 0) return true;
    return evaluateCustomLogicFormula(customLogic, conditions, window);
  };

  const totalMeasurements = Object.values(window.wizardMeasurements?.widths || {}).filter(v => v > 0).length + Object.values(window.wizardMeasurements?.heights || {}).filter(v => v > 0).length;

  // Get all fields from all sections for conditional logic dropdowns
  const allFieldsForConditions = React.useMemo(() => 
    formConfigState.config.sections.flatMap(s => s.rows.flatMap(r => r.fields))
  , [formConfigState.config.sections]);

  return (
    <Card id={`window-${window.id}`} className={`border-2 transition-all duration-200 ${isActive ? "border-primary ring-2 ring-primary/20" : "border-border"}`}>
      <CardHeader className="p-4 bg-secondary flex flex-row items-center justify-between">
        <div className="flex items-center space-x-2 cursor-pointer flex-grow" onClick={() => toggleExpand(window.id)}>
          {validationErrors.length > 0 ? (
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
          )}
          <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
          <span className="font-semibold text-lg text-foreground">Line #{window.lineNumber}</span>
          {window.location && <span className="text-foreground hidden sm:inline">{window.location}</span>}
          {!isMobile && window.width > 0 && window.height > 0 && (
            <span className="text-sm text-muted-foreground">
              {formatMeasurement(window.width)}" × {formatMeasurement(window.height)}"
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {isMobile ? (
            <>
              <Button variant="ghost" size="icon" onClick={() => setIsMeasureWizardOpen(true)} className="h-8 w-8 text-foreground relative" data-window-id={window.id}>
                <Ruler className="h-4 w-4" />
                {totalMeasurements > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-success text-success-foreground text-[10px]">{totalMeasurements}</Badge>}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    <span>Copy Config</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPasteConfirmOpen(true)} disabled={!copiedWindowConfig}>
                    <ClipboardPaste className="mr-2 h-4 w-4" />
                    <span>Paste Config</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate}>
                    <PlusSquare className="mr-2 h-4 w-4" />
                    <span>Duplicate Line</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span>Delete Line</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setIsMeasureWizardOpen(true)} className="h-8 text-foreground ml-2 relative" data-window-id={window.id}>
                <span className="hidden sm:inline mr-1">Measure Wizard</span>
                <Ruler className="h-4 w-4" />
                {totalMeasurements > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-success text-success-foreground text-[10px]">{totalMeasurements}</Badge>}
              </Button>
              <Button variant="ghost" size="icon" title="Copy Configuration" onClick={handleCopy} className="h-8 w-8 text-foreground">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Paste Configuration" onClick={() => setIsPasteConfirmOpen(true)} disabled={!copiedWindowConfig} className="h-8 w-8 text-foreground disabled:opacity-50">
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Duplicate Line" onClick={handleDuplicate} className="h-8 w-8 text-foreground">
                <PlusSquare className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Remove Line" onClick={handleRemove} className="h-8 w-8 text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          <div onClick={() => toggleExpand(window.id)} className="cursor-pointer p-2">
            {window.isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </div>
      </CardHeader>

      {window.isExpanded && (
        <CardContent className="p-4 space-y-4">
          {formConfigState.config.sections.map((section) => {
            if (section.isLineItemSection === false) return null;
            if (!evaluateSectionVisibility(section.conditions, section.customLogicFormula)) return null;
            
            const fieldsToRenderInThisSection = section.rows.flatMap(r => r.fields).filter(f =>
              evaluateCustomLogicFormula(f.customLogicFormula, f.conditions, window)
            );

            if (fieldsToRenderInThisSection.length === 0 && !section.label && !section.isCollapsible) return null;

            const sectionContent = (
              <div className="space-y-6">
                {section.rows.map(row => {
                  const fieldsToRenderInRow = row.fields.filter(f =>
                    evaluateCustomLogicFormula(f.customLogicFormula, f.conditions, window)
                  );

                  if (fieldsToRenderInRow.length === 0) return null;

                  const isThisRowCompact = fieldsToRenderInRow.every(isCompactField);
                  
                  const rowLayoutClass = isThisRowCompact
                    ? `grid ${getCompactGridClass(fieldsToRenderInRow.length)} gap-2`
                    : cn("grid grid-cols-1 gap-6", getGridColsClass(fieldsToRenderInRow.length));

                  return (
                    <div
                      key={row.id}
                      className={rowLayoutClass}
                    >
                      {fieldsToRenderInRow.map(field => (
                        <FormFieldRenderer
                          key={field.id}
                          field={field}
                          data={window}
                          onChange={handleChange}
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
              <div className="flex items-center justify-between pt-4 mb-4 gap-4">
                <h3 className="text-lg font-semibold text-foreground whitespace-nowrap">{section.label}</h3>
                <div className="flex-1 ml-4"><Separator /></div>
                {section.enableSectionVoice && (
                  <div className="flex-shrink-0">
                    <SectionVoiceButton
                      sectionFields={fieldsToRenderInThisSection}
                      currentData={window}
                      onBulkUpdate={(updates) => bulkUpdateWindow(window.id, updates)}
                      label={section.sectionVoiceLabel}
                      tooltip={section.sectionVoiceTooltip}
                    />
                  </div>
                )}
              </div>
            );

            if (section.isCollapsible) {
              return (
                <Accordion type="single" collapsible key={section.id} className="w-full border rounded-lg">
                  <AccordionItem value={section.id} className="border-b-0">
                    <AccordionTrigger className="p-4 hover:no-underline">
                      <h3 className="text-base font-semibold text-foreground">{section.label || "Section"}</h3>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border-t">
                      {sectionContent}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            } else {
              return (
                <div key={section.id}>
                  {section.label && sectionHeader}
                  {sectionContent}
                </div>
              );
            }
          })}
          
          <div className="col-span-full">
            <AnnotationCanvas imageData={window.image} annotationData={window.annotations} onImageUpdate={handleImageUpdate} onAnnotationUpdate={handleAnnotationsUpdate} imageMetadata={window.imageMetadata} wizardImage={window.wizardImage} wizardMeasurements={window.wizardMeasurements} wizardWindowBounds={window.wizardWindowBounds} onOpenMeasureWizard={onOpenMeasureWizard} location={window.location} windowNumber={window.windowNumber} product={window.product} controlType={window.controlType} />
          </div>
        </CardContent>
      )}

      <MeasureWizard isOpen={isMeasureWizardOpen} onClose={() => setIsMeasureWizardOpen(false)} window={window} onSave={handleWizardSave} />

      <AlertDialog open={isPasteConfirmOpen} onOpenChange={setIsPasteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Paste Configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the current configuration for Line #{window.lineNumber} with the copied settings. Measurements, notes, and images will not be affected. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePaste}>
              Paste
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}