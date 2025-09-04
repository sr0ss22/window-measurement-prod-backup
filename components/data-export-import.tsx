"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Upload, AlertCircle } from "lucide-react"
import { useWindowContext } from "@/context/window-context"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { WindowItem } from "@/types/window-item"
import { useMobile } from "@/hooks/use-mobile" // Import useMobile hook
import { cn } from "@/lib/utils"

export function DataExportImport() {
  const { state, setWindows } = useWindowContext()
  const { toast } = useToast()
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const isMobile = useMobile() // Use the hook

  const handleExport = () => {
    try {
      // Create a JSON string of the window data
      const dataStr = JSON.stringify(state.windowItems, null, 2)

      // Create a blob and download link
      const blob = new Blob([dataStr], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")

      // Set up the download
      const date = new Date().toISOString().split("T")[0]
      link.setAttribute("href", url)
      link.setAttribute("download", `window-measurements-${date}.json`)
      link.style.visibility = "hidden"

      // Trigger the download
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Data Exported",
        description: `${state.windowItems.length} window measurements exported successfully`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data",
        variant: "destructive",
      })
    }
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const importedData = JSON.parse(content) as WindowItem[]

        // Validate the imported data
        if (!Array.isArray(importedData)) {
          throw new Error("Invalid data format: Expected an array of window items")
        }

        // Check if each item has the required fields
        importedData.forEach((item, index) => {
          if (!item.id || typeof item.lineNumber !== "number") {
            throw new Error(`Invalid window item at position ${index + 1}`)
          }
        })

        // Update line numbers to ensure they're sequential
        const updatedData = importedData.map((item, index) => ({
          ...item,
          lineNumber: index + 1,
        }))

        // Set the imported data
        setWindows(updatedData)

        // Close the dialog
        setIsImportDialogOpen(false)

        // Show success message
        toast({
          title: "Data Imported",
          description: `${updatedData.length} window measurements imported successfully`,
        })
      } catch (error) {
        console.error("Import error:", error)
        setImportError("Invalid file format. Please select a valid window measurements JSON file.")
      }
    }

    reader.onerror = () => {
      setImportError("Error reading file. Please try again.")
    }

    reader.readAsText(file)
  }

  return (
    <>
      <div className="flex space-x-2">
        <Button
          variant="outline"
          onClick={() => setIsImportDialogOpen(true)}
          size={isMobile ? "icon" : "default"}
        >
          <Upload className={cn(!isMobile && "mr-2", "h-4 w-4")} />
          {!isMobile && "Import"}
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={state.windowItems.length === 0}
          size={isMobile ? "icon" : "default"}
        >
          <Download className={cn(!isMobile && "mr-2", "h-4 w-4")} />
          {!isMobile && "Export"}
        </Button>
      </div>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Window Measurements</DialogTitle>
            <DialogDescription>
              Upload a JSON file containing window measurement data. This will replace your current data.
            </DialogDescription>
          </DialogHeader>

          {importError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{importError}</AlertDescription>
            </Alert>
          )}

          <div className="py-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
              <Upload className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-gray-500 text-center mb-4">Click to browse or drag and drop a JSON file</p>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}