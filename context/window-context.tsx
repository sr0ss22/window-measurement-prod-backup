"use client"

import { createContext, useContext, useReducer, type ReactNode, type Dispatch, useCallback, useEffect, useState, useRef } from "react"
import type { WindowItem, UploadedFile, GlobalFormData } from "@/types/window-item"
import { useAuth } from "./auth-context"
import { toast } from "@/components/ui/use-toast"
import { uploadBase64File, downloadFileAsBase64, deleteFile } from "@/integrations/supabase/storage"
import { createClient } from "@/integrations/supabase/client"
import { v4 as uuidv4 } from 'uuid';

// Define the state shape
interface WindowState {
  windowItems: WindowItem[]
  activeWindowId: string | null
  isLoading: boolean
  defaultProjectId: string | null;
  globalFormData: GlobalFormData;
  copiedWindowConfig: Partial<WindowItem> | null;
  hasUnsavedChanges: boolean; // New state property
}

// Define action types
type WindowAction =
  | { type: "ADD_WINDOW"; payload: WindowItem }
  | { type: "UPDATE_WINDOW"; payload: WindowItem }
  | { type: "REMOVE_WINDOW"; payload: string }
  | { type: "DUPLICATE_WINDOW"; payload: { id: string; updates?: Record<string, any> } }
  | { type: "SET_ACTIVE_WINDOW"; payload: string | null }
  | { type: "TOGGLE_EXPAND"; payload: string }
  | { type: "SET_WINDOWS"; payload: WindowItem[] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_DEFAULT_PROJECT_ID"; payload: string | null }
  | { type: "SET_GLOBAL_FORM_DATA"; payload: GlobalFormData }
  | { type: "UPDATE_GLOBAL_FORM_DATA"; payload: { fieldId: string; value: any } }
  | { type: "COPY_CONFIG"; payload: string }
  | { type: "BULK_UPDATE_WINDOW"; payload: { id: string; updates: Record<string, any> } }
  | { type: "BULK_UPDATE_GLOBAL"; payload: Record<string, any> }
  | { type: "SET_UNSAVED_CHANGES"; payload: boolean }; // New action type

// Create context with initial state
const WindowContext = createContext<
  | {
      state: WindowState
      dispatch: Dispatch<WindowAction>
      addWindow: (window: WindowItem) => Promise<void>
      updateWindow: (window: WindowItem) => Promise<void>
      removeWindow: (id: string) => Promise<void>
      duplicateWindow: (id: string, updates?: Record<string, any>) => Promise<void>
      setActiveWindow: (id: string | null) => void
      toggleExpand: (id: string) => void
      setWindows: (windows: WindowItem[]) => void
      updateGlobalFormData: (fieldId: string, value: any) => void;
      copyWindowConfig: (id: string) => void;
      pasteWindowConfig: (id: string) => void;
      bulkUpdateWindow: (id: string, updates: Record<string, any>) => void;
      bulkUpdateGlobal: (updates: Record<string, any>) => void;
      saveChanges: () => Promise<void>; // Expose new functions
    }
  | undefined
>(undefined)

// Reducer function to handle state updates
function windowReducer(state: WindowState, action: WindowAction): WindowState {
  switch (action.type) {
    case "ADD_WINDOW":
      return {
        ...state,
        windowItems: [...state.windowItems, action.payload],
        hasUnsavedChanges: true,
      }
    case "UPDATE_WINDOW":
      return {
        ...state,
        windowItems: state.windowItems.map((item) => (item.id === action.payload.id ? action.payload : item)),
        hasUnsavedChanges: true,
      }
    case "REMOVE_WINDOW":
      return {
        ...state,
        windowItems: state.windowItems.filter((item) => item.id !== action.payload),
        activeWindowId: state.activeWindowId === action.payload ? null : state.activeWindowId,
        hasUnsavedChanges: true,
      }
    case "DUPLICATE_WINDOW": {
      const windowToDuplicate = state.windowItems.find((item) => item.id === action.payload.id)
      if (!windowToDuplicate) return state

      // Create a new copy with a new ID and lineNumber
      const newWindow = {
        ...windowToDuplicate,
        id: uuidv4(),
        lineNumber: Math.max(0, ...state.windowItems.map((item) => item.lineNumber)) + 1,
        isExpanded: true,
        // Clear paths and dirty flags for duplicated items, they will be re-uploaded if modified
        image_path: null,
        annotations_path: null,
        wizard_image_path: null,
        wizard_data_path: null,
        signature_path: null,
        uploaded_files_paths: [],
        isImageDirty: false, 
        isAnnotationsDirty: false,
        isSignatureDirty: false,
        isFilesDirty: false,
        // Apply updates if provided
        ...(action.payload.updates || {}),
      }

      return {
        ...state,
        windowItems: [...state.windowItems, newWindow],
        hasUnsavedChanges: true,
      }
    }
    case "SET_ACTIVE_WINDOW":
      return {
        ...state,
        activeWindowId: action.payload,
      }
    case "TOGGLE_EXPAND":
      return {
        ...state,
        windowItems: state.windowItems.map((item) =>
          item.id === action.payload ? { ...item, isExpanded: !item.isExpanded } : item,
        ),
      }
    case "SET_WINDOWS":
      return {
        ...state,
        windowItems: action.payload,
      }
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      }
    case "SET_DEFAULT_PROJECT_ID":
      return {
        ...state,
        defaultProjectId: action.payload,
      }
    case "SET_GLOBAL_FORM_DATA":
      return {
        ...state,
        globalFormData: action.payload,
      }
    case "UPDATE_GLOBAL_FORM_DATA": {
      const { fieldId, value } = action.payload;
      let updatedGlobalFormData = { ...state.globalFormData, [fieldId]: value };
      
      // Special handling for signature fields to mark them as dirty
      if (fieldId === 'installerSignature' || fieldId === 'customerSignature') {
        updatedGlobalFormData = { ...updatedGlobalFormData, [`is${fieldId}Dirty`]: true };
      }

      // If the value is 'reset', clear all global form data
      if (fieldId === 'reset') {
        updatedGlobalFormData = {};
      }

      return {
        ...state,
        globalFormData: updatedGlobalFormData,
        hasUnsavedChanges: true,
      };
    }
    case "COPY_CONFIG": {
      const windowToCopy = state.windowItems.find(item => item.id === action.payload);
      if (!windowToCopy) return state;

      const configToCopy: Partial<WindowItem> = {};
      // Exclude only unique identifiers and instance-specific data like images/files
      const excludedKeys = new Set([
        'id', 
        'lineNumber', 
        'isExpanded', 
        'project_id',
        'image', 
        'annotations', 
        'imageMetadata',
        'wizardImage', 
        'wizardMeasurements', 
        'wizardWindowBounds', 
        'image_path', 
        'annotations_path', 
        'wizard_image_path', 
        'wizard_data_path', 
        'signature', 
        'signature_path', 
        'isSignatureDirty', 
        'uploadedFiles', 
        'uploaded_files_paths', 
        'isFilesDirty'
      ]);

      Object.keys(windowToCopy).forEach(key => {
        if (!excludedKeys.has(key)) {
          (configToCopy as any)[key] = (windowToCopy as any)[key];
        }
      });

      return { ...state, copiedWindowConfig: configToCopy };
    }
    case "BULK_UPDATE_WINDOW":
      return {
        ...state,
        windowItems: state.windowItems.map((item) =>
          item.id === action.payload.id ? { ...item, ...action.payload.updates } : item
        ),
        hasUnsavedChanges: true,
      };
    case "BULK_UPDATE_GLOBAL":
      return {
        ...state,
        globalFormData: { ...state.globalFormData, ...action.payload },
        hasUnsavedChanges: true,
      };
    case "SET_UNSAVED_CHANGES":
      return { ...state, hasUnsavedChanges: action.payload };
    default:
      return state
  }
}

// Provider component
export function WindowProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: isAuthLoading } = useAuth()
  const supabase = createClient()
  const [state, dispatch] = useReducer(windowReducer, {
    windowItems: [],
    activeWindowId: null,
    isLoading: true,
    defaultProjectId: null,
    globalFormData: {},
    copiedWindowConfig: null,
    hasUnsavedChanges: false, // Initialize
  })

  // useRef to hold the latest windowItems state without triggering useEffect
  const latestWindowItems = useRef<WindowItem[]>([]);
  useEffect(() => {
    latestWindowItems.current = state.windowItems;
  }, [state.windowItems]);

  // useRef to hold the latest globalFormData state
  const latestGlobalFormData = useRef<GlobalFormData>({});
  useEffect(() => {
    latestGlobalFormData.current = state.globalFormData;
  }, [state.globalFormData]);

  // NEW: Create a ref for copiedWindowConfig
  const latestCopiedConfig = useRef<Partial<WindowItem> | null>(null);
  useEffect(() => {
    latestCopiedConfig.current = state.copiedWindowConfig;
  }, [state.copiedWindowConfig]);

  // Effect to load or create a default project for the user
  // This effect is now primarily for ensuring defaultProjectId is set if not from URL
  useEffect(() => {
    const loadOrCreateProject = async () => {
      if (!user) {
        dispatch({ type: "SET_DEFAULT_PROJECT_ID", payload: null });
        return;
      }

      // If defaultProjectId is already set (e.g., from URL), don't try to create/find
      if (state.defaultProjectId) {
        return;
      }

      let projectIdToUse: string | null = null;
      // Try to find an existing project for the user
      const { data: existingProjects, error: fetchProjectsError } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

      if (fetchProjectsError) {
          console.error("WindowContext: Error fetching user projects:", fetchProjectsError);
      } else if (existingProjects && existingProjects.length > 0) {
          projectIdToUse = existingProjects[0].id;
      } else {
          // No project found, create a default one
          const newProjectId = uuidv4();
          const today = new Date().toLocaleDateString('en-US');
          const defaultProjectName = `Customer: New Project | Date: ${today} | Seller: Default | WO#: ${Date.now().toString().slice(-6)}`;

          // Fetch the user's company_id from their profile
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();

          if (profileError || !profileData?.company_id) {
            console.error("WindowContext: Error fetching user's company ID for new project:", profileError);
            toast({ title: "Error", description: "Could not retrieve your company information to create a new project.", variant: "destructive" });
            projectIdToUse = null;
            return;
          }
          const userCompanyId = profileData.company_id;

          const { error: insertProjectError } = await supabase
              .from('projects')
              .insert({ id: newProjectId, user_id: user.id, name: defaultProjectName, company_id: userCompanyId }); // Include company_id

          if (insertProjectError) {
              console.error("WindowContext: Error creating default project:", insertProjectError);
              projectIdToUse = null;
          } else {
              projectIdToUse = newProjectId;
          }
      }
      dispatch({ type: "SET_DEFAULT_PROJECT_ID", payload: projectIdToUse });
    };

    if (!isAuthLoading) {
      loadOrCreateProject();
    }
  }, [user, isAuthLoading, supabase, state.defaultProjectId]);


  // Load windows and global form data from Supabase on user change or defaultProjectId change
  const loadData = useCallback(async () => {
    if (isAuthLoading || !user || state.defaultProjectId === null) {
      dispatch({ type: "SET_LOADING", payload: true })
      return
    }

    dispatch({ type: "SET_LOADING", payload: true })
    try {
      // Load window measurements for the current project
      const { data: windowData, error: windowError } = await supabase
        .from("window_measurements")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", state.defaultProjectId) // Filter by project_id
        .order("line_number", { ascending: true })

      if (windowError) {
        console.error("WindowContext: Error loading window measurements:", windowError.message, windowError.details); // Improved logging
        toast({
          title: "Error",
          description: "Failed to load window measurements.",
          variant: "destructive",
        })
        dispatch({ type: "SET_WINDOWS", payload: [] })
      } else {
        const loadedWindows: WindowItem[] = await Promise.all(
          windowData.map(async (dbItem) => {
            const windowItem: WindowItem = {
              id: dbItem.id,
              lineNumber: dbItem.line_number,
              location: dbItem.data?.location || "",
              windowNumber: dbItem.data?.windowNumber || "",
              product: dbItem.data?.product || "",
              width: dbItem.data?.width || 0,
              height: dbItem.data?.height || 0,
              depth: dbItem.data?.depth || 0,
              mountType: dbItem.data?.mountType || "inside",
              controlType: dbItem.data?.controlType || "",
              controlLength: dbItem.data?.controlLength || "",
              tilt: dbItem.data?.tilt || "",
              sbs: dbItem.data?.sbs || "",
              stackPosition: dbItem.data?.stackPosition || "",
              takeDown: dbItem.data?.takeDown === true,
              hardSurface: dbItem.data?.hardSurface || false,
              holdDown: dbItem.data?.holdDown || false,
              tallWindow12: dbItem.data?.tallWindow12 || false,
              tallWindow16: dbItem.data?.tallWindow16 || false,
              comments: dbItem.data?.comments || "",
              notes: dbItem.data?.notes || "",
              isExpanded: dbItem.data?.isExpanded || false,
              imageMetadata: dbItem.data?.imageMetadata || undefined,
              
              image_path: dbItem.image_path ?? null,
              annotations_path: dbItem.annotations_path ?? null,
              wizard_image_path: dbItem.wizard_image_path ?? null,
              wizard_data_path: dbItem.wizard_data_path ?? null,
              signature_path: dbItem.signature_path ?? null,
              uploaded_files_paths: dbItem.uploaded_files_paths ?? [],

              project_id: dbItem.project_id ?? null,

              image: null,
              annotations: null,
              wizardImage: null,
              wizardMeasurements: null,
              wizardWindowBounds: null,
              signature: null,
              uploadedFiles: [],

              isImageDirty: false,
              isAnnotationsDirty: false,
              isSignatureDirty: false,
              isFilesDirty: false,
            }

            if (windowItem.image_path) {
              windowItem.image = (await downloadFileAsBase64(windowItem.image_path)) ?? null;
            }
            if (windowItem.annotations_path) {
              windowItem.annotations = (await downloadFileAsBase64(windowItem.annotations_path)) ?? null;
            }
            if (windowItem.wizard_image_path) {
              windowItem.wizardImage = (await downloadFileAsBase64(windowItem.wizard_image_path)) ?? null;
            }
            if (windowItem.wizard_data_path) {
              const wizardDataString = await downloadFileAsBase64(windowItem.wizard_data_path)
              if (wizardDataString) {
                try {
                  const parsedWizardData = JSON.parse(wizardDataString.split(',')[1] ? atob(wizardDataString.split(',')[1]) : wizardDataString)
                  windowItem.wizardMeasurements = parsedWizardData.measurements ?? null;
                  windowItem.wizardWindowBounds = parsedWizardData.windowBounds ?? null;
                } catch (parseError) {
                  console.error("WindowContext: Error parsing wizard data:", parseError)
                }
              }
            }
            if (windowItem.signature_path) {
              windowItem.signature = (await downloadFileAsBase64(windowItem.signature_path)) ?? null;
            }
            if (windowItem.uploaded_files_paths && windowItem.uploaded_files_paths.length > 0) {
              windowItem.uploadedFiles = await Promise.all(
                windowItem.uploaded_files_paths.map(async (fileMeta) => {
                  const fileData = (await downloadFileAsBase64(fileMeta.path)) ?? '';
                  const mimeType = fileData.split(',')[0].split(':')[1].split(';')[0] || 'application/octet-stream';
                  return { id: fileMeta.id, name: fileMeta.name, type: mimeType, data: fileData };
                })
              );
            }

            return windowItem
          }),
        )
        dispatch({ type: "SET_WINDOWS", payload: loadedWindows })
      }

      // Load global form data for the current project
      const { data: globalData, error: globalError } = await supabase
        .from("global_form_data")
        .select("id, data, installer_signature_path, customer_signature_path") // Select signature paths
        .eq("user_id", user.id)
        .eq("project_id", state.defaultProjectId)
        .maybeSingle();

      if (globalError) {
        console.error("WindowContext: Error loading global form data:", globalError.message, globalError.details); // Improved logging
        toast({
          title: "Error",
          description: "Failed to load global form data.",
          variant: "destructive",
        });
        dispatch({ type: "SET_GLOBAL_FORM_DATA", payload: {} });
      } else {
        const loadedGlobalFormData: GlobalFormData = globalData?.data || {};
        if (globalData?.installer_signature_path) {
          loadedGlobalFormData.installerSignature = (await downloadFileAsBase64(globalData.installer_signature_path)) ?? null;
        }
        if (globalData?.customer_signature_path) {
          loadedGlobalFormData.customerSignature = (await downloadFileAsBase64(globalData.customer_signature_path)) ?? null;
        }
        dispatch({ type: "SET_GLOBAL_FORM_DATA", payload: loadedGlobalFormData });
      }

    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
      dispatch({ type: "SET_UNSAVED_CHANGES", payload: false }); // Reset dirty flag after loading
    }
  }, [user, isAuthLoading, supabase, state.defaultProjectId]); // Dependencies for loadData

  // Call loadData on mount/project change
  useEffect(() => {
    if (user && state.defaultProjectId !== null) {
      loadData();
    } else if (!isAuthLoading && !user) {
      dispatch({ type: "SET_WINDOWS", payload: [] })
      dispatch({ type: "SET_GLOBAL_FORM_DATA", payload: {} });
      dispatch({ type: "SET_LOADING", payload: false })
      dispatch({ type: "SET_UNSAVED_CHANGES", payload: false }); // Reset on logout
    }
  }, [user, isAuthLoading, state.defaultProjectId, loadData]);

  // New explicit save function
  const saveChanges = useCallback(async () => {
    if (state.isLoading || isAuthLoading || !user || !state.defaultProjectId) {
      toast({ title: "Save Failed", description: "Cannot save: Not logged in or project not loaded.", variant: "destructive" });
      return;
    }

    try {
      const currentWindowIds = new Set(latestWindowItems.current.map(w => w.id));

      // Fetch existing IDs and paths from DB for the current project
      const { data: existingDbItems, error: fetchError } = await supabase
        .from('window_measurements')
        .select('id, image_path, annotations_path, wizard_image_path, wizard_data_path, signature_path, uploaded_files_paths, data')
        .eq('user_id', user.id)
        .eq('project_id', state.defaultProjectId); // Filter by project_id

      if (fetchError) {
        console.error("WindowContext: Error fetching existing window IDs for save:", fetchError.message, fetchError.details); // Improved logging
        throw new Error("Failed to fetch existing data for save.");
      }

      const existingDbItemsMap = new Map(existingDbItems.map(item => [item.id, item]));
      const newWindowItemsState: WindowItem[] = [];

      const nonDataProperties = new Set([
        'id', 'lineNumber', 'image', 'annotations', 'isExpanded', 'imageMetadata',
        'wizardImage', 'wizardMeasurements', 'wizardWindowBounds',
        'image_path', 'annotations_path', 'wizard_image_path', 'wizard_data_path',
        'signature', 'signature_path', 'isSignatureDirty',
        'uploadedFiles', 'uploaded_files_paths', 'isFilesDirty',
        'project_id', 'isImageDirty', 'isAnnotationsDirty', 'notes'
      ]);

      for (const windowItem of latestWindowItems.current) {
        let itemForNextState: WindowItem = windowItem;
        let hasChangesForDb = false;

        let updatedItemData = { ...windowItem }; 
        const existingDbItem = existingDbItemsMap.get(updatedItemData.id);

        // Image
        if (updatedItemData.isImageDirty) {
          hasChangesForDb = true;
          if (updatedItemData.image) {
            const uploadedPath = await uploadBase64File(updatedItemData.image, 'images', user.id);
            updatedItemData.image_path = uploadedPath;
          } else if (existingDbItem?.image_path) {
            await deleteFile(existingDbItem.image_path);
            updatedItemData.image_path = null;
          }
          updatedItemData.isImageDirty = false;
        }

        // Annotations
        if (updatedItemData.isAnnotationsDirty) {
          hasChangesForDb = true;
          if (updatedItemData.annotations) {
            const jsonString = updatedItemData.annotations;
            const base64String = btoa(jsonString);
            const dataUrl = `data:application/json;base64,${base64String}`;
            
            const uploadedPath = await uploadBase64File(dataUrl, 'annotations', user.id);
            updatedItemData.annotations_path = uploadedPath;
          } else if (existingDbItem?.annotations_path) {
            await deleteFile(existingDbItem.annotations_path);
            updatedItemData.annotations_path = null;
          }
          updatedItemData.isAnnotationsDirty = false;
        }

        // Wizard Image
        const currentWizardImageContent = updatedItemData.wizardImage;
        const existingWizardImagePath = existingDbItem?.wizard_image_path;
        if (currentWizardImageContent && currentWizardImageContent !== existingWizardImagePath) {
            hasChangesForDb = true;
            const uploadedPath = await uploadBase64File(currentWizardImageContent, 'wizard-images', user.id);
            updatedItemData.wizard_image_path = uploadedPath;
        } else if (!currentWizardImageContent && existingWizardImagePath) {
            hasChangesForDb = true;
            await deleteFile(existingWizardImagePath);
            updatedItemData.wizard_image_path = null;
        }

        // Wizard Data
        const wizardDataToSave = (updatedItemData.wizardMeasurements || updatedItemData.wizardWindowBounds)
          ? { measurements: updatedItemData.wizardMeasurements, windowBounds: updatedItemData.wizardWindowBounds }
          : null;
        const wizardDataString = wizardDataToSave ? JSON.stringify(wizardDataToSave) : null;
        const existingWizardDataPath = existingDbItem?.wizard_data_path;
        if (wizardDataString && wizardDataString !== existingWizardDataPath) {
            hasChangesForDb = true;
            const uploadedPath = await uploadBase64File(`data:application/json;base64,${btoa(wizardDataString)}`, 'wizard-data', user.id);
            updatedItemData.wizard_data_path = uploadedPath;
        } else if (!wizardDataString && existingWizardDataPath) {
            hasChangesForDb = true;
            await deleteFile(existingWizardDataPath);
            updatedItemData.wizard_data_path = null;
        }

        // Signature
        if (updatedItemData.isSignatureDirty) {
          hasChangesForDb = true;
          if (updatedItemData.signature) {
            const uploadedPath = await uploadBase64File(updatedItemData.signature, 'signatures', user.id);
            updatedItemData.signature_path = uploadedPath;
          } else if (existingDbItem?.signature_path) {
            await deleteFile(existingDbItem.signature_path);
            updatedItemData.signature_path = null;
          }
          updatedItemData.isSignatureDirty = false;
        }

        // Uploaded Files
        if (updatedItemData.isFilesDirty) {
          hasChangesForDb = true;
          const newUploadedFilesPaths: { id: string; name: string; path: string; }[] = [];
          const existingFilePathsMap = new Map(existingDbItem?.uploaded_files_paths?.map(f => [f.id, f.path]) || []);

          if (updatedItemData.uploadedFiles) {
            for (const file of updatedItemData.uploadedFiles) {
              if (file.data && !file.path) {
                const uploadedPath = await uploadBase64File(file.data, 'uploaded-documents', user.id);
                if (uploadedPath) {
                  newUploadedFilesPaths.push({ id: file.id, name: file.name, path: uploadedPath });
                }
              } else if (file.path) {
                newUploadedFilesPaths.push({ id: file.id, name: file.name, path: file.path });
              }
            }
          }
          
          const currentFileIds = new Set(updatedItemData.uploadedFiles?.map(f => f.id) || []);
          for (const existingFileMeta of (existingDbItem?.uploaded_files_paths || [])) {
            if (!currentFileIds.has(existingFileMeta.id)) {
              await deleteFile(existingFileMeta.path);
            }
          }
          updatedItemData.uploaded_files_paths = newUploadedFilesPaths;
          updatedItemData.isFilesDirty = false;
        }

        const dataForJsonb: { [key: string]: any } = {};
        for (const key in updatedItemData) {
          if (Object.prototype.hasOwnProperty.call(updatedItemData, key) && !nonDataProperties.has(key)) {
            dataForJsonb[key] = updatedItemData[key];
          }
        }

        const dbData = existingDbItem?.data || {};
        const currentData = dataForJsonb;

        const dataFieldsChanged = JSON.stringify(currentData) !== JSON.stringify(dbData);
        if (dataFieldsChanged) {
          hasChangesForDb = true;
        }

        if (hasChangesForDb || !existingDbItemsMap.has(updatedItemData.id)) {
          const dataToSave = {
            user_id: user.id,
            line_number: updatedItemData.lineNumber,
            data: currentData,
            image_path: updatedItemData.image_path,
            annotations_path: updatedItemData.annotations_path,
            wizard_image_path: updatedItemData.wizard_image_path,
            wizard_data_path: updatedItemData.wizard_data_path,
            signature_path: updatedItemData.signature_path,
            uploaded_files_paths: updatedItemData.uploaded_files_paths,
            updated_at: new Date().toISOString(),
            project_id: state.defaultProjectId,
            notes: updatedItemData.notes,
          };

          if (existingDbItemsMap.has(updatedItemData.id)) {
            const { error: updateError } = await supabase
              .from('window_measurements')
              .update(dataToSave)
              .eq('id', updatedItemData.id);
            if (updateError) console.error(`WindowContext: Error updating window ${updatedItemData.id}:`, updateError.message, updateError.details); // Improved logging
          } else {
            const { error: insertError } = await supabase
              .from('window_measurements')
              .insert({ id: updatedItemData.id, ...dataToSave });
            if (insertError) console.error(`WindowContext: Error inserting window ${updatedItemData.id}:`, insertError.message, insertError.details); // Improved logging
          }
        }

        newWindowItemsState.push(hasChangesForDb ? updatedItemData : windowItem);
      }

      // Handle deletions (this part remains the same)
      const itemsToDelete = existingDbItems.filter(dbItem => !currentWindowIds.has(dbItem.id));
      for (const item of itemsToDelete) {
        if (item.image_path) await deleteFile(item.image_path);
        if (item.annotations_path) await deleteFile(item.annotations_path);
        if (item.wizard_image_path) await deleteFile(item.wizard_image_path);
        if (item.wizard_data_path) await deleteFile(item.wizard_data_path);
        if (item.signature_path) await deleteFile(item.signature_path);
        if (item.uploaded_files_paths && item.uploaded_files_paths.length > 0) {
          for (const fileMeta of item.uploaded_files_paths) {
            await deleteFile(fileMeta.path);
          }
        }

        const { error: deleteError } = await supabase
          .from('window_measurements')
          .delete()
          .eq('id', item.id);
        if (deleteError) console.error(`WindowContext: Error deleting window ${item.id}:`, deleteError.message, deleteError.details); // Improved logging
      }

      // Save Global Form Data for the current project
      const currentGlobalData = latestGlobalFormData.current;
      const { data: existingGlobalDbItem, error: fetchGlobalError } = await supabase
        .from('global_form_data')
        .select('id, data, installer_signature_path, customer_signature_path') // Select signature paths
        .eq('user_id', user.id)
        .eq('project_id', state.defaultProjectId)
        .maybeSingle();

      if (fetchGlobalError) {
        console.error("WindowContext: Error fetching existing global form data for save:", fetchGlobalError.message, fetchGlobalError.details); // Improved logging
      } else {
        let globalDataChanged = JSON.stringify(currentGlobalData) !== JSON.stringify(existingGlobalDbItem?.data || {});
        
        // Check if signatures are dirty and need re-uploading
        let installerSignaturePath = existingGlobalDbItem?.installer_signature_path || null;
        if (currentGlobalData.installerSignature && currentGlobalData.isinstallerSignatureDirty) {
          globalDataChanged = true;
          installerSignaturePath = await uploadBase64File(currentGlobalData.installerSignature, 'global-signatures', user.id);
          currentGlobalData.isinstallerSignatureDirty = false; // Reset dirty flag
        } else if (!currentGlobalData.installerSignature && existingGlobalDbItem?.installer_signature_path) {
          globalDataChanged = true;
          await deleteFile(existingGlobalDbItem.installer_signature_path);
          installerSignaturePath = null;
        }

        let customerSignaturePath = existingGlobalDbItem?.customer_signature_path || null;
        if (currentGlobalData.customerSignature && currentGlobalData.iscustomerSignatureDirty) {
          globalDataChanged = true;
          customerSignaturePath = await uploadBase64File(currentGlobalData.customerSignature, 'global-signatures', user.id);
          currentGlobalData.iscustomerSignatureDirty = false; // Reset dirty flag
        } else if (!currentGlobalData.customerSignature && existingGlobalDbItem?.customer_signature_path) {
          globalDataChanged = true;
          await deleteFile(existingGlobalDbItem.customer_signature_path);
          customerSignaturePath = null;
        }

        if (globalDataChanged) {
          const globalDataToSave = {
            user_id: user.id,
            project_id: state.defaultProjectId,
            data: currentGlobalData,
            installer_signature_path: installerSignaturePath,
            customer_signature_path: customerSignaturePath,
            updated_at: new Date().toISOString(),
          };

          if (existingGlobalDbItem) {
            const { error: updateGlobalError } = await supabase
              .from('global_form_data')
              .update(globalDataToSave)
              .eq('id', existingGlobalDbItem.id);
            if (updateGlobalError) console.error("WindowContext: Error updating global form data:", updateGlobalError.message, updateGlobalError.details); // Improved logging
          } else {
            const { error: insertGlobalError } = await supabase
              .from('global_form_data')
              .insert(globalDataToSave);
            if (insertGlobalError) console.error("WindowContext: Error inserting global form data:", insertGlobalError.message, insertGlobalError.details); // Improved logging
          }
        }
      }

      dispatch({ type: "SET_WINDOWS", payload: newWindowItemsState });
      dispatch({ type: "SET_UNSAVED_CHANGES", payload: false }); // Reset dirty flag on success
      toast({ title: "Data Saved", description: "Your changes have been committed." });
    } catch (e: any) {
      console.error("WindowContext: Uncaught error during saveChanges:", e.message || e);
      toast({
        title: "Save Failed",
        description: "An unexpected error occurred during data synchronization. Please try again.",
        variant: "destructive",
      });
      throw e; // Re-throw to allow UI to handle
    }
  }, [state.isLoading, isAuthLoading, user, supabase, state.defaultProjectId, state.windowItems, state.globalFormData]); // Dependencies for saveChanges

  // Action creators
  const addWindow = useCallback(async (window: WindowItem) => {
    dispatch({ type: "ADD_WINDOW", payload: window })
  }, [])

  const updateWindow = useCallback(async (window: WindowItem) => {
    dispatch({ type: "UPDATE_WINDOW", payload: window })
  }, [])

  const removeWindow = useCallback(async (id: string) => {
    dispatch({ type: "REMOVE_WINDOW", payload: id })
  }, [])

  const duplicateWindow = useCallback(async (id: string, updates?: Record<string, any>) => {
    dispatch({ type: "DUPLICATE_WINDOW", payload: { id, updates } })
  }, [])

  const setActiveWindow = useCallback((id: string | null) => {
    dispatch({ type: "SET_ACTIVE_WINDOW", payload: id })
  }, [])

  const toggleExpand = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_EXPAND", payload: id })
  }, [])

  const setWindows = useCallback((windows: WindowItem[]) => {
    dispatch({ type: "SET_WINDOWS", payload: windows })
  }, [])

  const updateGlobalFormData = useCallback((fieldId: string, value: any) => {
    dispatch({ type: "UPDATE_GLOBAL_FORM_DATA", payload: { fieldId, value } });
  }, []);

  const copyWindowConfig = useCallback((id: string) => {
    dispatch({ type: "COPY_CONFIG", payload: id });
  }, []);

  const pasteWindowConfig = useCallback((id: string) => {
    const configToPaste = latestCopiedConfig.current;
    if (!configToPaste) {
      console.warn("Paste attempted but no config was copied.");
      return;
    }

    const targetWindow = latestWindowItems.current.find(item => item.id === id);
    if (!targetWindow) {
      console.warn(`Paste attempted but target window with id ${id} was not found.`);
      return;
    }

    const updatedWindow = {
        ...targetWindow,
        ...configToPaste
    };
    
    dispatch({ type: "UPDATE_WINDOW", payload: updatedWindow });
  }, []);

  const bulkUpdateWindow = useCallback((id: string, updates: Record<string, any>) => {
    dispatch({ type: "BULK_UPDATE_WINDOW", payload: { id, updates } });
  }, []);

  const bulkUpdateGlobal = useCallback((updates: Record<string, any>) => {
    dispatch({ type: "BULK_UPDATE_GLOBAL", payload: updates });
  }, []);

  return (
    <WindowContext.Provider
      value={{
        state,
        dispatch,
        addWindow,
        updateWindow,
        removeWindow,
        duplicateWindow,
        setActiveWindow,
        toggleExpand,
        setWindows,
        updateGlobalFormData,
        copyWindowConfig,
        pasteWindowConfig,
        bulkUpdateWindow,
        bulkUpdateGlobal,
        saveChanges, // Expose new functions
      }}
    >
      {children}
    </WindowContext.Provider>
  )
}

// Custom hook to use the context
export function useWindowContext() {
  const context = useContext(WindowContext)
  if (context === undefined) {
    throw new Error("useWindowContext must be used within a WindowProvider")
  }
  return context;
}