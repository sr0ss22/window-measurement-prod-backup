"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, X, Loader2, AlertCircle } from "lucide-react";
import type { FormConfig } from "@/types/form-config";
import { useAuth } from "@/context/auth-context";

interface TemplateAiAgentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onTemplateGenerated: (config: FormConfig) => void;
}

export function TemplateAiAgentDialog({
  isOpen,
  onOpenChange,
  onTemplateGenerated,
}: TemplateAiAgentDialogProps) {
  const { supabase } = useAuth();
  const [activeTab, setActiveTab] = useState("prompt");
  const [prompt, setPrompt] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError("PDF file size cannot exceed 10MB.");
        setPdfFile(null);
      } else {
        setPdfFile(file);
        setError(null);
      }
    } else if (file) {
      setPdfFile(null);
      setError("Please upload a valid PDF file.");
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (prompt.trim()) {
        formData.append("prompt", prompt);
      }
      if (pdfFile) {
        formData.append("pdf", pdfFile);
      }

      const { data, error: functionError } = await supabase.functions.invoke("template-generator", {
        body: formData,
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      onTemplateGenerated(data as FormConfig);
      handleClose();

    } catch (err: any) {
      console.error("Error generating template:", err);
      setError(err.message || "An unknown error occurred. Please check the function logs.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };
  
  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTimeout(() => {
        setPrompt("");
        setPdfFile(null);
        setError(null);
        setIsLoading(false);
        setActiveTab("prompt");
      }, 300);
    }
    onOpenChange(open);
  };

  const isGenerateDisabled =
    isLoading ||
    (activeTab === "prompt" && !prompt.trim()) ||
    (activeTab === "pdf" && !pdfFile) ||
    (activeTab === "pdf_prompt" && (!prompt.trim() || !pdfFile));

  const PdfInput = () => (
    <div className="space-y-2">
      <Label htmlFor="pdf-upload">Upload PDF</Label>
      <div className="relative flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
        <Input
          id="pdf-upload"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="absolute w-full h-full opacity-0 cursor-pointer"
        />
        {pdfFile ? (
          <div className="flex items-center space-x-2 text-gray-700">
            <FileText className="h-6 w-6" />
            <span className="font-medium">{pdfFile.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.preventDefault();
                setPdfFile(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-1 text-gray-500">
            <Upload className="h-6 w-6" />
            <span>Click to upload or drag & drop</span>
            <span className="text-xs">PDF only (max 10MB)</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Template AI Agent</DialogTitle>
          <DialogDescription>
            Generate a new form template using AI. Choose your input method below.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="prompt">Prompt Only</TabsTrigger>
            <TabsTrigger value="pdf">PDF Only</TabsTrigger>
            <TabsTrigger value="pdf_prompt">PDF + Prompt</TabsTrigger>
          </TabsList>
          <div className="py-4">
            <TabsContent value="prompt">
              <Textarea
                placeholder="Describe the form you want to create. For example: 'Create a work order form with fields for customer name, address, job description, and a signature field for approval.'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
              />
            </TabsContent>
            <TabsContent value="pdf">
              <PdfInput />
            </TabsContent>
            <TabsContent value="pdf_prompt" className="space-y-4">
              <PdfInput />
              <Textarea
                placeholder="Provide additional instructions or context for the AI based on the uploaded PDF."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
            </TabsContent>
          </div>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleGenerate} disabled={isGenerateDisabled}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}