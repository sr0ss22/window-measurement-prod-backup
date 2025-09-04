"use client"

import React, { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Upload, FileText, XCircle, Image, File } from "lucide-react"
import type { UploadedFile } from "@/types/window-item"
import { useToast } from "@/components/ui/use-toast"

interface FileUploadInputProps {
  id: string
  label: string
  value: UploadedFile[] // Array of uploaded files
  onChange: (files: UploadedFile[]) => void
  required?: boolean
  error?: boolean
  labelColor?: string
  allowMultiple?: boolean
  allowedFileTypes?: string[] // e.g., ['image/*', 'application/pdf']
}

export function FileUploadInput({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
  allowMultiple = false,
  allowedFileTypes = ["*/*"], // Default to all file types
}: FileUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newFiles: UploadedFile[] = allowMultiple ? [...value] : []
    let hasError = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file type
      const isFileTypeAllowed = allowedFileTypes.some(type => {
        if (type.endsWith("/*")) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });

      if (!isFileTypeAllowed) {
        toast({
          title: "Invalid File Type",
          description: `File '${file.name}' is not an allowed type.`,
          variant: "destructive",
        });
        hasError = true;
        continue;
      }

      // Validate file size (e.g., max 5MB per file)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: `File '${file.name}' exceeds the 5MB limit.`,
          variant: "destructive",
        });
        hasError = true;
        continue;
      }

      const reader = new FileReader()
      const filePromise = new Promise<UploadedFile | null>((resolve) => {
        reader.onload = (e) => {
          if (e.target?.result) {
            newFiles.push({
              id: `${id}-${Date.now()}-${i}`, // Unique ID for this file instance
              name: file.name,
              type: file.type,
              data: e.target.result.toString(),
            })
            resolve(newFiles[newFiles.length - 1]);
          } else {
            resolve(null);
          }
        }
        reader.onerror = () => {
          toast({
            title: "File Read Error",
            description: `Could not read file '${file.name}'.`,
            variant: "destructive",
          });
          resolve(null);
        }
        reader.readAsDataURL(file)
      })
      await filePromise; // Wait for each file to be read
    }

    onChange(newFiles);
    setIsUploading(false);
    // Clear the input value to allow re-uploading the same file if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const handleRemoveFile = (fileId: string) => {
    const updatedFiles = value.filter((file) => file.id !== fileId)
    onChange(updatedFiles)
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image className="h-4 w-4 text-gray-500" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div
        className={cn(
          "border rounded-md p-4 space-y-4",
          error ? "border-rose-500" : "border-gray-300"
        )}
      >
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {value.length > 0 ? "Add More Files" : "Upload Files"}
              </>
            )}
          </Button>
          <input
            id={id}
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple={allowMultiple}
            accept={allowedFileTypes.join(",")}
          />
        </div>

        {value.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Uploaded Files:</p>
            {value.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 border rounded-md bg-white text-sm"
              >
                <div className="flex items-center space-x-2">
                  {getFileIcon(file.type)}
                  <span className="truncate max-w-[150px] sm:max-w-none">{file.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveFile(file.id)}
                  className="h-6 w-6 text-red-500"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {required && error && value.length === 0 && (
          <p className="text-sm text-rose-500">At least one file is required.</p>
        )}
      </div>
    </div>
  )
}