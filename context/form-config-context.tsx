"use client";

import { createContext, useContext, useReducer, type ReactNode, type Dispatch, useEffect, useCallback, useState, useRef } from "react";
import type { FormConfig, FormField, FormSection } from "@/types/form-config";
import { loadFormConfigFromSupabase, saveFormConfigToSupabase } from "@/utils/form-config-service";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "./auth-context";
import { v4 as uuidv4 } from 'uuid';

interface FormConfigState {
  config: FormConfig;
}

type FormConfigAction =
  | { type: "SET_CONFIG"; payload: FormConfig }
  | { type: "SET_SECTIONS"; payload: FormSection[] };

const FormConfigContext = createContext<{
  state: FormConfigState;
  dispatch: Dispatch<FormConfigAction>;
  setSections: (sections: FormSection[]) => void;
  addSection: () => void;
  addFieldToSection: (sectionId: string) => void;
  updateField: (field: FormField) => void;
  removeField: (id: string) => void;
  saveConfig: () => Promise<void>;
} | undefined>(undefined);

function formConfigReducer(state: FormConfigState, action: FormConfigAction): FormConfigState {
  switch (action.type) {
    case "SET_CONFIG":
      return { ...state, config: action.payload };
    case "SET_SECTIONS":
      return { ...state, config: { ...state.config, sections: action.payload } };
    default:
      return state;
  }
}

export function FormConfigProvider({ children }: { children: ReactNode }) {
  const { user, supabase } = useAuth();
  const [state, dispatch] = useReducer(formConfigReducer, {
    config: { sections: [] },
  });

  useEffect(() => {
    if (user) {
      const loadConfig = async () => {
        const loadedConfig = await loadFormConfigFromSupabase(supabase, user.id);
        dispatch({ type: "SET_CONFIG", payload: loadedConfig });
      };
      loadConfig();
    }
  }, [user, supabase]);

  const setSections = useCallback((sections: FormSection[]) => {
    dispatch({ type: "SET_SECTIONS", payload: sections });
  }, []);

  const addSection = useCallback(() => {
    const newSection: FormSection = {
      id: uuidv4(),
      label: "New Section",
      rows: [],
      conditions: [],
      customLogicFormula: ""
    };
    setSections([...state.config.sections, newSection]);
  }, [state.config.sections, setSections]);

  const addFieldToSection = useCallback((sectionId: string) => {
    const newField: FormField = {
      id: `custom_${Date.now()}`,
      name: "New Field",
      type: "text",
      placeholder: "",
      options: [],
      conditions: [],
      required: false,
    };

    const newSections = state.config.sections.map(section => {
      if (section.id === sectionId) {
        const updatedSection = { ...section, rows: [...section.rows] };
        const lastRow = updatedSection.rows[updatedSection.rows.length - 1];

        if (lastRow && lastRow.fields.length < 4) {
          // Add to the last row if it has space
          lastRow.fields.push(newField);
        } else {
          // Create a new row for the new field
          updatedSection.rows.push({ id: uuidv4(), fields: [newField] });
        }
        return updatedSection;
      }
      return section;
    });

    setSections(newSections);
  }, [state.config.sections, setSections]);

  const updateField = useCallback((field: FormField) => {
    const newSections = state.config.sections.map(section => ({
      ...section,
      rows: section.rows.map(row => ({
        ...row,
        fields: row.fields.map(f => f.id === field.id ? field : f),
      })),
    }));
    setSections(newSections);
  }, [state.config.sections, setSections]);

  const removeField = useCallback((id: string) => {
    const newSections = state.config.sections.map(section => ({
      ...section,
      rows: section.rows
        .map(row => ({ ...row, fields: row.fields.filter(f => f.id !== id) }))
        .filter(row => row.fields.length > 0),
    })).filter(section => section.rows.length > 0 || section.isLineItemSection === false);
    setSections(newSections);
  }, [state.config.sections, setSections]);
  
  const saveConfig = async () => {
    if (!user) {
      toast({ title: "Save Failed", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    const allFieldIds = state.config.sections.flatMap(s => s.rows.flatMap(r => r.fields.map(f => f.id)));
    if (new Set(allFieldIds).size !== allFieldIds.length) {
      toast({ title: "Save Failed", description: "Duplicate field IDs found.", variant: "destructive" });
      return;
    }
    try {
      await saveFormConfigToSupabase(supabase, user.id, state.config);
      toast({ title: "Form Configuration Saved" });
    } catch (error) {
      console.error("Error in saveConfig:", error);
      toast({
        title: "Save Failed",
        description: (error as Error).message || "An unknown error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <FormConfigContext.Provider value={{ state, dispatch, setSections, addSection, addFieldToSection, updateField, removeField, saveConfig }}>
      {children}
    </FormConfigContext.Provider>
  );
}

export function useFormConfig() {
  const context = useContext(FormConfigContext);
  if (context === undefined) {
    throw new Error("useFormConfig must be used within a FormConfigProvider");
  }
  return context;
}