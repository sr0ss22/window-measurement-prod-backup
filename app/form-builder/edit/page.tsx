"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/context/unified-auth-context";
import { useRouter, useSearchParams } from "next/navigation"; // Changed useParams to useSearchParams
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Save, GripVertical, Trash2, PlusCircle, Mic, Bot, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, Active } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { v4 as uuidv4 } from 'uuid';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { ConditionalLogicBuilder } from "@/components/form-builder/conditional-logic-builder";
import { FieldEditor } from "@/components/form-builder/field-editor";
import { TemplateAiAgentDialog } from "@/components/form-builder/template-ai-agent-dialog";
import { saveFormConfigToSupabase } from "@/utils/form-config-service";
import type { FormConfig, FormSection, FieldLayoutRow, FormField, FormFieldCondition } from "@/types/form-config";
import { AiFormUpdater } from "@/components/form-builder/ai-form-updater";
import { UserNav } from "@/components/user-nav";
import { Capacitor } from '@capacitor/core'; // Import Capacitor

interface Message {
  type: "user" | "ai" | "system";
  content: string;
  isError?: boolean;
}

function SortableSection({ section, updateSection, deleteSection, addFieldToSection, allFieldsForConditions, updateField, removeField, cloneField, isIdUnique }: { 
  section: FormSection;
  updateSection: (section: FormSection) => void;
  deleteSection: (sectionId: string) => void;
  addFieldToSection: (sectionId: string) => void;
  allFieldsForConditions: FormField[];
  updateField: (field: FormField) => void;
  removeField: (id: string) => void;
  cloneField: (id: string) => void;
  isIdUnique: (id: string) => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "SECTION", section },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSectionChange = (key: keyof FormSection, value: any) => {
    updateSection({ ...section, [key]: value });
  };

  const handleAddFieldClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    addFieldToSection(section.id);
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-gray-100 p-4 rounded-lg border touch-manipulation">
      <Accordion type="single" defaultValue={section.id} collapsible className="w-full">
        <AccordionItem value={section.id} className="border-b-0">
          <AccordionTrigger className="p-2 hover:no-underline">
            <div className="flex items-center gap-2 flex-grow">
              <div {...attributes} {...listeners} className="cursor-grab p-2 text-gray-400">
                <GripVertical className="h-5 w-5" />
              </div>
              <Input
                value={section.label || ""}
                onChange={(e) => handleSectionChange("label", e.target.value)}
                placeholder="Section Label"
                className="text-lg font-medium border-none shadow-none focus-visible:ring-1 bg-transparent"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex items-center space-x-4 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" onClick={handleAddFieldClick} title="Add Field to Section">
                <PlusCircle className="h-5 w-5 text-blue-600" />
              </Button>
              <div className="flex items-center space-x-2">
                <Label htmlFor={`enableSectionVoice-${section.id}`} className="text-sm font-normal text-gray-700 whitespace-nowrap flex items-center">
                  <Mic className="mr-1 h-4 w-4" /> Voice
                </Label>
                <Switch
                  id={`enableSectionVoice-${section.id}`}
                  checked={!!section.enableSectionVoice}
                  onCheckedChange={(checked) => handleSectionChange("enableSectionVoice", checked)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor={`isCollapsible-${section.id}`} className="text-sm font-normal text-gray-700 whitespace-nowrap">
                  Collapsible
                </Label>
                <Switch
                  id={`isCollapsible-${section.id}`}
                  checked={!!section.isCollapsible}
                  onCheckedChange={(checked) => handleSectionChange("isCollapsible", checked)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteSection(section.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t bg-white rounded-md border-2 border-dashed">
            <div className="flex items-center space-x-6 mb-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`isLineItemSection-${section.id}`}
                  checked={section.isLineItemSection !== false}
                  onCheckedChange={(checked) => handleSectionChange("isLineItemSection", checked)}
                />
                <Label htmlFor={`isLineItemSection-${section.id}`}>
                  Repeat for each Window (Line Item Section)
                </Label>
              </div>
            </div>

            {section.enableSectionVoice && (
              <div className="mb-4 p-4 border rounded-md bg-gray-50">
                <h4 className="font-medium mb-2">Voice Button Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`voice-label-${section.id}`}>Button Label (optional)</Label>
                    <Input
                      id={`voice-label-${section.id}`}
                      value={section.sectionVoiceLabel || ""}
                      onChange={(e) => handleSectionChange("sectionVoiceLabel", e.target.value)}
                      placeholder="e.g., Voice Input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`voice-tooltip-${section.id}`}>Hover Tooltip (optional)</Label>
                    <Input
                      id={`voice-tooltip-${section.id}`}
                      value={section.sectionVoiceTooltip || ""}
                      onChange={(e) => handleSectionChange("sectionVoiceTooltip", e.target.value)}
                      placeholder="e.g., Click to record..."
                    />
                  </div>
                </div>
              </div>
            )}

            <Accordion type="single" collapsible>
              <AccordionItem value="section-logic" className="border-b-0">
                <AccordionTrigger className="p-0 hover:no-underline text-base font-medium">
                  Section Visibility Logic
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t bg-gray-50 rounded-md border">
                  <ConditionalLogicBuilder
                    conditions={section.conditions || []}
                    customLogicFormula={section.customLogicFormula}
                    onConditionsChange={(newConditions) => handleSectionChange("conditions", newConditions)}
                    onCustomLogicFormulaChange={(newFormula) => handleSectionChange("customLogicFormula", newFormula)}
                    availableFields={allFieldsForConditions}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            <div className="space-y-2 mt-4">
              <SortableContext items={section.rows.flatMap(r => r.fields).map(f => f.id)}>
                {section.rows.map(row => (
                  <div key={row.id} className={`grid gap-4 grid-cols-1 md:grid-cols-${row.fields.length || 1}`}>
                    {row.fields.map(field => (
                      <FieldEditor 
                        key={field.id} 
                        field={field} 
                        updateField={updateField}
                        removeField={removeField}
                        cloneField={cloneField}
                        allFieldsForConditions={allFieldsForConditions}
                        isIdUnique={isIdUnique}
                      />
                    ))}
                  </div>
                ))}
              </SortableContext>
              {section.rows.length === 0 && (
                <div className="text-center text-gray-400 py-8">Drop fields here to start building your section.</div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function FormBuilderContent() {
  const searchParams = useSearchParams(); // Changed useParams to useSearchParams
  const formId = searchParams.get('formId'); // Get formId from query parameter
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [sections, setSections] = useState<FormSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<Active | null>(null);
  const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
  const [isAiUpdaterOpen, setIsAiUpdaterOpen] = useState(false);
  const [aiConversationHistory, setAiConversationHistory] = useState<Message[]>([]);

  const isMobileApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  useEffect(() => {
    if (isMobileApp) {
      router.replace('/projects'); // Redirect to projects page if on mobile
      return;
    }

    if (!isAuthLoading && !user) {
      router.push('/login');
      return;
    }
    if (user && formId) {
      const fetchForm = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('forms')
          .select('name, description, config')
          .eq('id', formId)
          .eq('user_id', user.id)
          .single();

        if (error || !data) {
          console.error("Error fetching form:", error);
          toast({ title: "Error", description: "Could not load the form.", variant: "destructive" });
          router.push('/forms');
        } else {
          setFormName(data.name);
          setFormDescription(data.description || "");
          setSections((data.config as FormConfig)?.sections || []);
        }
        setIsLoading(false);
      };
      fetchForm();
    }
  }, [user, isAuthLoading, formId, router, supabase, toast, isMobileApp]);

  if (isMobileApp) {
    return null; // Render nothing while redirecting on mobile
  }

  const sensors = useSensors(useSensor(PointerSensor));

  const allFields = useMemo(() => sections.flatMap(s => s.rows.flatMap(r => r.fields)), [sections]);

  const isIdUnique = (id: string) => !allFields.some(f => f.id === id);

  const updateField = (updatedField: FormField) => {
    setSections(prevSections => prevSections.map(section => ({
      ...section,
      rows: section.rows.map(row => ({
        ...row,
        fields: row.fields.map(f => f.id === updatedField.id ? updatedField : f),
      })),
    })));
  };

  const removeField = (fieldId: string) => {
    setSections(prevSections => prevSections.map(section => ({
      ...section,
      rows: section.rows
        .map(row => ({ ...row, fields: row.fields.filter(f => f.id !== fieldId) }))
        .filter(row => row.fields.length > 0),
    })));
  };

  const cloneField = (fieldId: string) => {
    let fieldToClone: FormField | undefined;
    let targetSectionId: string | undefined;

    for (const section of sections) {
      for (const row of section.rows) {
        const foundField = row.fields.find(f => f.id === fieldId);
        if (foundField) {
          fieldToClone = foundField;
          targetSectionId = section.id;
          break;
        }
      }
      if (fieldToClone) break;
    }

    if (fieldToClone && targetSectionId) {
      const newId = `${fieldToClone.id}_copy_${Date.now()}`;
      const clonedField = { ...fieldToClone, id: newId, name: `${fieldToClone.name} (Copy)`, isDefault: false };
      
      setSections(prevSections => prevSections.map(section => {
        if (section.id === targetSectionId) {
          const newRows = [...section.rows];
          newRows.push({ id: uuidv4(), fields: [clonedField] });
          return { ...s, rows: newRows };
        }
        return section;
      }));
    }
  };

  const addSection = () => {
    const newSection: FormSection = { id: uuidv4(), label: "New Section", rows: [], isLineItemSection: true, isCollapsible: false, conditions: [], customLogicFormula: "" };
    setSections(prev => [...prev, newSection]);
  };

  const updateSection = (updatedSection: FormSection) => {
    setSections(prev => prev.map(s => s.id === updatedSection.id ? updatedSection : s));
  };

  const deleteSection = (sectionId: string) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  };

  const addFieldToSection = (sectionId: string) => {
    const newField: FormField = {
      id: `custom_${Date.now()}`,
      name: "New Field",
      type: "text",
      placeholder: "",
      options: [],
      conditions: [],
      required: false,
    };
    setSections(prev => prev.map(s => {
      if (s.id === sectionId) {
        const newRows = [...s.rows];
        newRows.push({ id: uuidv4(), fields: [newField] });
        return { ...s, rows: newRows };
      }
      return s;
    }));
  };

  const handleDragStart = (event: DragStartEvent) => setActiveItem(event.active);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || active.id === over.id) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === "SECTION" && overType === "SECTION") {
      const oldIndex = sections.findIndex(s => s.id === active.id);
      const newIndex = sections.findIndex(s => s.id === over.id);
      setSections(arrayMove(sections, oldIndex, newIndex));
    }
    // More complex field drag-and-drop logic would go here
  };

  const handleSave = async () => {
    if (!formId) {
      toast({ title: "Save Failed", description: "Form ID is missing.", variant: "destructive" });
      return;
    }
    await saveFormConfigToSupabase(supabase, user!.id, formId, formName, formDescription, { sections });
    toast({
      title: "Changes Saved!",
      description: "Your form configuration has been successfully updated.",
    });
  };

  const handleAiFormConfigUpdate = (newConfig: FormConfig) => {
    setSections(newConfig.sections);
    // Optionally, you might want to automatically save here or prompt the user to save
    // For now, we'll just update the state, and the user can manually save.
  };

  if (isLoading || isAuthLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full mt-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10">
        <div className="pt-[env(safe-area-inset-top)] h-[150px] md:h-[120px] flex items-center">
          <div className="container mx-auto px-4 text-white flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link href="/forms"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
              <h1 className="text-2xl font-bold">Form Builder</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700"><Save className="mr-2 h-4 w-4" />Save Changes</Button>
              <Button onClick={() => setIsAiUpdaterOpen(true)}><Bot className="mr-2 h-4 w-4" />AI Form Update</Button> {/* New AI Form Update button */}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 min-h-[calc(100vh-150px-80px)] md:min-h-[calc(100vh-120px-80px)]">
          <div className="container mx-auto px-4 pt-6 pb-20">
            <div className="bg-white p-6 rounded-lg border mb-6">
              <h2 className="text-xl font-semibold mb-4">Form Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="formName">Form Name</Label>
                  <Input id="formName" value={formName} onChange={(e) => setFormName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formDescription">Description</Label>
                  <Input id="formDescription" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end mb-4 space-x-2"> {/* Added space-x-2 for button spacing */}
              <Button onClick={addSection} variant="outline"><Plus className="mr-2 h-4 w-4" />Add New Section</Button>
              <Button onClick={() => setIsAiUpdaterOpen(true)}><Bot className="mr-2 h-4 w-4" />AI Form Update</Button> {/* New AI Form Update button */}
            </div>

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {sections.map(section => (
                    <SortableSection 
                      key={section.id} 
                      section={section}
                      updateSection={updateSection}
                      deleteSection={deleteSection}
                      addFieldToSection={addFieldToSection}
                      allFieldsForConditions={allFields}
                      updateField={updateField}
                      removeField={removeField}
                      cloneField={cloneField}
                      isIdUnique={isIdUnique}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeItem?.data.current?.type === "SECTION" && <SortableSection section={activeItem.data.current.section} updateSection={()=>{}} deleteSection={()=>{}} addFieldToSection={()=>{}} allFieldsForConditions={[]} updateField={()=>{}} removeField={()=>{}} cloneField={()=>{}} isIdUnique={() => true} />}
                {activeItem?.data.current?.type === "FIELD" && <FieldEditor field={activeItem.data.current.field} updateField={()=>{}} removeField={()=>{}} cloneField={()=>{}} allFieldsForConditions={[]} isIdUnique={() => true} />}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      </main>

      {/* AI Form Updater Component */}
      <AiFormUpdater
        isOpen={isAiUpdaterOpen}
        onOpenChange={setIsAiUpdaterOpen}
        currentFormConfig={{ sections }}
        allFieldsForConditions={allFields}
        onFormConfigUpdate={handleAiFormConfigUpdate}
        conversationHistory={aiConversationHistory}
        onConversationHistoryChange={setAiConversationHistory}
      />
    </div>
  );
}

export default function FormBuilderPage() {
  return (
    <Suspense fallback={
      <div className="p-4 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    }>
      <FormBuilderContent />
    </Suspense>
  );
}