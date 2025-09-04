"use client"

import { useEffect, useState } from "react"
import { WindowSummary } from "@/components/window-summary"
import { WindowRow } from "@/components/window-row"
import { useWindowContext } from "@/context/window-context"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Mic, Save, LayoutGrid, List, Download, FileText, CheckCircle2, Loader2, Ruler, ClipboardList, ArrowLeft } from "lucide-react"
import { DataExportImport } from "@/components/data-export-import"
import { HelpGuide } from "@/components/help-guide"
import type { WindowItem } from "@/types/window-item"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useFormConfig } from "@/context/form-config-context"
import { useAuth } from "@/context/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { useMobile } from "@/hooks/use-mobile"
import { v4 as uuidv4 } from 'uuid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { VoiceCaptureDialog } from "@/components/voice-capture-dialog"
import { validateWindow } from "@/utils/validation"
import { UserNav } from "@/components/user-nav"
import { toast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMeasurement } from "@/utils/measurements"
import { generatePDF } from "@/utils/pdf-generator"
import type { ProjectRecord } from "@/app/projects/page" // Import ProjectRecord
import { cn } from "@/lib/utils"

export default function HomeContent() {
  const { state, addWindow, setWindows, updateGlobalFormData, duplicateWindow, dispatch, saveChanges, setActiveWindow, updateWindow } = useWindowContext();
  const { state: formConfigState } = useFormConfig()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const { user, supabase, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("measurements");
  const isMobile = useMobile();
  const [isVoiceCaptureDialogOpen, setIsVoiceCaptureDialogOpen] = useState(false);
  const [voiceCaptureMode, setVoiceCaptureMode] = useState<'single' | 'multi'>('single');
  const [viewMode, setViewMode] = useState<'detail' | 'compact'>('detail');
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isSubmittingMeasure, setIsSubmittingMeasure] = useState(false);
  const [project, setProject] = useState<ProjectRecord | null>(null); // State for project details

  const projectId = searchParams.get('projectId');

  // Effect to set the defaultProjectId in context based on URL param
  useEffect(() => {
    if (projectId) {
      dispatch({ type: "SET_DEFAULT_PROJECT_ID", payload: projectId });
    } else if (!isAuthLoading && user) {
      // If no projectId in URL and user is logged in, redirect to projects page
      router.push('/projects');
    }
  }, [projectId, dispatch, isAuthLoading, user, router]);

  // Effect to fetch project details when defaultProjectId changes
  useEffect(() => {
    const fetchProjectDetails = async () => {
      if (!state.defaultProjectId || !user) {
        setProject(null);
        return;
      }
      const { data, error } = await supabase
        .from('projects')
        .select('work_order_number, customer_name, name')
        .eq('id', state.defaultProjectId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error("Error fetching project details for header:", error);
        setProject(null);
      } else {
        setProject(data as ProjectRecord);
      }
    };

    if (!isAuthLoading && user && state.defaultProjectId) {
      fetchProjectDetails();
    }
  }, [state.defaultProjectId, user, isAuthLoading, supabase]);

  // Add a sample window if no data is loaded and not loading
  useEffect(() => {
    if (!state.isLoading && state.windowItems.length === 0 && user && state.defaultProjectId) {
      handleAddWindow();
    }
  }, [state.isLoading, state.windowItems.length, user, state.defaultProjectId]);

  const handleAddWindow = async (initialData: Partial<WindowItem> = {}, sourceWindowId?: string, updates?: Record<string, any>) => {
    if (!state.defaultProjectId) {
      toast({
        title: "No Project Selected",
        description: "Please select or create a project first.",
        variant: "destructive",
      });
      router.push('/projects');
      return;
    }

    if (sourceWindowId) {
      await duplicateWindow(sourceWindowId, updates);
    } else {
      const newWindowId = uuidv4();
      const newWindowLineNumber = state.windowItems.length > 0 ? Math.max(...state.windowItems.map(w => w.lineNumber)) + 1 : 1;

      const initialFieldValues: { [key: string]: any } = {
        id: newWindowId,
        lineNumber: newWindowLineNumber,
        image: null,
        image_path: null,
        annotations: null,
        annotations_path: null,
        isExpanded: true,
        wizardImage: null,
        wizard_image_path: null,
        wizardWindowBounds: null,
        wizardMeasurements: null,
        wizard_data_path: null,
        windowNumber: "",
        signature: null,
        signature_path: null,
        isSignatureDirty: false,
        uploadedFiles: [],
        uploaded_files_paths: [],
        isFilesDirty: false,
        project_id: state.defaultProjectId,
        ...initialData,
      };

      const lineItemFields = formConfigState.config.sections
        .filter(section => section.isLineItemSection !== false)
        .flatMap(section => section.rows.flatMap(row => row.fields));

      lineItemFields.forEach((field) => {
        if (initialFieldValues[field.id] === undefined) {
          let defaultValue: any;
          switch (field.type) {
            case "number": defaultValue = 0; break;
            case "checkbox": case "toggle": defaultValue = false; break;
            case "date": defaultValue = null; break;
            case "picklist": case "radio":
              defaultValue = (field.id === 'tilt' || field.id === 'stackPosition') ? null : "";
              break;
            case "slider": defaultValue = field.min || 0; break;
            case "signature": defaultValue = null; break;
            case "fileUpload": defaultValue = []; break;
            case "spacer": defaultValue = null; break;
            default: defaultValue = "";
          }
          initialFieldValues[field.id] = defaultValue;
        }
      });

      const newWindow: WindowItem = initialFieldValues as WindowItem;
      await addWindow(newWindow);
    }
  };

  const handleClearAllData = () => {
    setIsDeleteDialogOpen(true)
  }

  const confirmClearAllData = async () => {
    await setWindows([])
    updateGlobalFormData('reset', {});
    setIsDeleteDialogOpen(false)
  }

  const handleVoiceCaptureSuccess = (result: any) => {
    if (result.type === 'multi-line' && Array.isArray(result.commands)) {
      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      
      let currentNewLineNumber = state.windowItems.length > 0 ? Math.max(...state.windowItems.map(w => w.lineNumber)) + 1 : 1;

      const commands = result.commands;

      for (const command of commands) {
        if (command.type === 'new-line') {
          handleAddWindow({ ...command.data, lineNumber: currentNewLineNumber });
          currentNewLineNumber++;
          addedCount++;
        } else if (command.type === 'update-line') {
          const windowToUpdate = state.windowItems.find(w => w.lineNumber === command.lineNumber);
          if (windowToUpdate) {
            updateWindow({ ...windowToUpdate, ...command.updates });
            updatedCount++;
          } else {
            console.warn(`Skipped update: Line number ${command.lineNumber} not found.`);
            skippedCount++;
          }
        } else if (command.type === 'copy-and-modify') {
          let sourceWindowId: string | undefined;
          if (command.sourceLineNumber === 'last') {
            if (state.windowItems.length > 0) {
                const lastWindow = state.windowItems.reduce((prev, current) => (prev.lineNumber > current.lineNumber) ? prev : current);
                sourceWindowId = lastWindow.id;
            }
          } else {
            sourceWindowId = state.windowItems.find(w => w.lineNumber === command.sourceLineNumber)?.id;
          }

          if (sourceWindowId) {
            duplicateWindow(sourceWindowId, { ...command.updates, lineNumber: currentNewLineNumber });
            currentNewLineNumber++;
            addedCount++;
          } else {
            console.warn(`Skipped copy: Source line number ${command.sourceLineNumber} not found.`);
            skippedCount++;
          }
        } else if (command.type === 'batch-new-line') {
          for (let i = 0; i < (command.count || 1); i++) {
            handleAddWindow({ ...command.data, lineNumber: currentNewLineNumber });
            currentNewLineNumber++;
          }
          addedCount += command.count || 1;
        } else {
          skippedCount++;
        }
      }

      let description = `${addedCount} lines added, ${updatedCount} lines updated.`;
      if (skippedCount > 0) {
        description += ` ${skippedCount} commands were skipped.`;
      }
      toast({ title: "Multi-line entry processed", description });

    } else if (result.type === 'new-line') {
      handleAddWindow(result.data);
    } else if (result.type === 'copy-and-modify') {
      let sourceWindowId: string | undefined;
      if (result.command.sourceLineNumber === 'last') {
        if (state.windowItems.length > 0) {
            const lastWindow = state.windowItems.reduce((prev, current) => (prev.lineNumber > current.lineNumber) ? prev : current);
            sourceWindowId = lastWindow.id;
        }
      } else {
        sourceWindowId = state.windowItems.find(w => w.lineNumber === result.command.sourceLineNumber)?.id;
      }

      if (sourceWindowId) {
        handleAddWindow({}, sourceWindowId, result.command.updates);
      } else {
        console.error("Source window not found for copy command.");
        toast({ title: "Error", description: `Source line number ${result.command.sourceLineNumber} not found.`, variant: "destructive" });
      }
    }
    setIsVoiceCaptureDialogOpen(false);
  };

  const handleSaveClick = async () => {
    await saveChanges();
  };

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (state.hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.hasUnsavedChanges]);

  const handleExportCSV = () => {
    const headers = [
      "Line #", "Location", "Window Tag", "Product", "Width", "Height", "Depth",
      "Mount Type", "Control Type", "Control Length", "Tilt", "Stack Position",
      "Take Down", "Hard Surface", "Hold Down", "Tall Window 12'", "Tall Window 16'",
      "Comments", "Wizard Width T", "Wizard Width M", "Wizard Width B",
      "Wizard Height L", "Wizard Height C", "Wizard Height R",
    ];
    const rows = state.windowItems.map((w) => [
      w.lineNumber, w.location, w.windowNumber.toString(), w.product, w.width, w.height, w.depth,
      w.mountType, w.controlType, w.controlLength, w.tilt, w.stackPosition,
      w.takeDown ? "Yes" : "No", w.hardSurface ? "Yes" : "No", w.holdDown ? "Yes" : "No",
      w.tallWindow12 ? "Yes" : "No", w.tallWindow16 ? "Yes" : "No", w.comments,
      w.wizardMeasurements?.widths?.T || 0, w.wizardMeasurements?.widths?.M || 0, w.wizardMeasurements?.widths?.B || 0,
      w.wizardMeasurements?.heights?.L || 0, w.wizardMeasurements?.heights?.C || 0, w.wizardMeasurements?.heights?.R || 0,
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "window-measurements.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = async () => {
    setIsPdfLoading(true);
    await generatePDF(state.windowItems, state.globalFormData, formConfigState.config);
    setIsPdfLoading(false);
  };

  const handleSubmitMeasure = async () => {
    if (!state.defaultProjectId) {
      toast({ title: "Error", description: "No project selected.", variant: "destructive" });
      return;
    }
    setIsSubmittingMeasure(true);
    try {
      const { data, error } = await supabase.functions.invoke('submit-measure', { body: { projectId: state.defaultProjectId } });
      if (error || data.error) throw new Error(error?.message || data.error);
      toast({ title: "Measure Submitted", description: `Project "${data.project.name}" marked as measured.` });
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmittingMeasure(false);
    }
  };

  if (isAuthLoading || !user || state.isLoading || !state.defaultProjectId) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const allLineItemFields = formConfigState.config.sections
    .filter(section => section.isLineItemSection !== false)
    .flatMap(section => section.rows.flatMap(row => row.fields));

  const voiceCaptureFields = allLineItemFields.filter(field => 
    ['location', 'controlType', 'width', 'height', 'depth', 'mountType', 'product', 'comments'].includes(field.id)
  );

  const handleRowClick = (windowId: string) => {
    setActiveWindow(windowId);
    setViewMode('detail');
    setTimeout(() => {
      document.getElementById(`window-${windowId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  return (
    <div className="relative min-h-screen bg-black">
      <main className="relative z-10">
        <div className="h-[150px] md:h-[120px]">
          <div className="ios:pt-[env(safe-area-inset-top)] h-full">
            <div className="container mx-auto px-4 text-white flex justify-between items-center h-full">
              <Button variant="ghost" size="icon" onClick={() => router.push(`/work-order?id=${projectId}`)}>
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <div className="text-center">
                <h1 className="text-xl font-bold truncate">
                  WO#: {project?.work_order_number || 'N/A'}
                </h1>
                <p className="text-white/80 truncate">{project?.customer_name || project?.name}</p>
              </div>
              <div className="flex items-center space-x-2">
                {!isMobile && <HelpGuide />}
                <UserNav />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[32px] shadow-lg border-t-4 border-[#F08200] -mt-8 min-h-[calc(100vh-118px)] md:min-h-[calc(100vh-88px)]">
          <Tabs defaultValue="measurements" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-t-xl border-b-0 bg-transparent p-0 container mx-auto px-4">
              <TabsTrigger 
                value="measurements" 
                className="text-lg py-3 rounded-t-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-0 data-[state=active]:border-primary relative z-10 data-[state=active]:underline data-[state=active]:underline-offset-4"
              >
                <Ruler className="mr-2 h-5 w-5" />
                Measure
              </TabsTrigger>
              <TabsTrigger 
                value="summary" 
                className="text-lg py-3 rounded-t-xl data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:border-b-0 data-[state=active]:border-primary relative z-10 data-[state=active]:underline data-[state=active]:underline-offset-4"
              >
                <ClipboardList className="mr-2 h-5 w-5" />
                Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="measurements" className="border-t bg-white">
              <div className="container mx-auto px-4 pt-4 pb-24 space-y-6">
                {viewMode === 'detail' ? (
                  <div className="space-y-6">
                    {state.windowItems.map((window) => (
                      <WindowRow
                        key={window.id}
                        window={window}
                        validationErrors={validateWindow(window, allLineItemFields)}
                        isActive={state.activeWindowId === window.id}
                      />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Line #</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>W x H</TableHead>
                        <TableHead>Wizard</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {state.windowItems.map((window) => (
                        <TableRow key={window.id} onClick={() => handleRowClick(window.id)} className="cursor-pointer">
                          <TableCell className="font-medium">{window.lineNumber}</TableCell>
                          <TableCell>{window.location}</TableCell>
                          <TableCell>{formatMeasurement(window.width)}" x {formatMeasurement(window.height)}"</TableCell>
                          <TableCell>
                            {window.wizardMeasurements && (Object.values(window.wizardMeasurements.widths).some(v => v > 0) || Object.values(window.wizardMeasurements.heights).some(v => v > 0)) ? (
                              <Ruler className="h-5 w-5 text-green-500" />
                            ) : (
                              <Ruler className="h-5 w-5 text-gray-300" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {state.windowItems.length === 0 && (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-dashed border-gray-300">
                    <p className="text-gray-500">No windows added yet. Click "Add Window" to get started.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="summary" className="border-t bg-white">
              <div className="container mx-auto px-4 pt-4 pb-24">
                <WindowSummary />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Data</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clear all window measurement data for this project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClearAllData} className="bg-destructive hover:bg-destructive/90">
              Clear All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="fixed bottom-0 left-0 right-0 bg-white/30 backdrop-blur-lg p-4 border-t border-gray-200/50 z-50 shadow-lg pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className={cn(
          "container mx-auto flex items-center gap-4",
          activeTab === 'summary' ? "justify-center" : "justify-between"
        )}>
          <div className="flex items-center gap-2">
            {activeTab === 'measurements' && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode(prev => prev === 'detail' ? 'compact' : 'detail')}
                title={viewMode === 'detail' ? "Switch to Compact View" : "Switch to Detail View"}
              >
                {viewMode === 'detail' ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSaveClick}
              className="bg-green-600 hover:bg-green-700"
              disabled={!state.hasUnsavedChanges || state.isLoading}
              size={isMobile ? "icon" : "default"}
            >
              <Save className={cn(!isMobile && "mr-2", "h-4 w-4")} />
              {!isMobile && "Save"}
            </Button>

            {activeTab === 'measurements' && (
              <>
                <DataExportImport />
                <Button
                  onClick={handleClearAllData}
                  variant="outline"
                  size={isMobile ? "icon" : "default"}
                  className="text-destructive border-destructive hover:bg-destructive/5"
                >
                  <Trash2 className="h-4 w-4" />
                  {!isMobile && <span className="ml-2">Clear All</span>}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90" size={isMobile ? "icon" : "default"}>
                      <Plus className="h-4 w-4" />
                      {!isMobile && <span className="ml-2">Add Window</span>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleAddWindow()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Blank Line
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setVoiceCaptureMode('single'); setIsVoiceCaptureDialogOpen(true); }}>
                      <Mic className="mr-2 h-4 w-4" />
                      Single Line Entry
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setVoiceCaptureMode('multi'); setIsVoiceCaptureDialogOpen(true); }}>
                      <Mic className="mr-2 h-4 w-4" />
                      Multi Line Entry
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}

            {activeTab === 'summary' && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size={isMobile ? "icon" : "default"}>
                      <Download className="h-4 w-4" />
                      {!isMobile && <span className="ml-2">Export</span>}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportCSV}>
                      <Download className="mr-2 h-4 w-4" />
                      <span>Export as CSV</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF} disabled={isPdfLoading}>
                      {isPdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      <span>Export as PDF</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={handleSubmitMeasure} disabled={isSubmittingMeasure} size={isMobile ? "icon" : "default"}>
                  {isSubmittingMeasure ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {!isMobile && <span className="ml-2">Submit Measure</span>}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <VoiceCaptureDialog
        isOpen={isVoiceCaptureDialogOpen}
        onOpenChange={setIsVoiceCaptureDialogOpen}
        onCaptureSuccess={handleVoiceCaptureSuccess}
        targetFields={voiceCaptureFields}
        windowItems={state.windowItems}
        mode={voiceCaptureMode}
      />
    </div>
  )
}