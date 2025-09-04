"use client"

import React, { useRef, useState, useEffect } from "react"
import SignatureCanvas from "react-signature-canvas"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { RotateCcw, Check } from "lucide-react"

interface SignaturePadProps {
  id: string
  label: string
  value: string | null // Base64 image data
  onChange: (value: string | null) => void
  required?: boolean
  error?: boolean
  labelColor?: string
}

export function SignaturePad({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: SignaturePadProps) {
  const sigCanvas = useRef<SignatureCanvas | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (sigCanvas.current) {
      if (value && sigCanvas.current.isEmpty()) {
        // Load signature if value exists and canvas is empty
        sigCanvas.current.fromDataURL(value)
        setIsEmpty(false)
      }
    }
  }, [value])

  const handleClear = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear()
      setIsEmpty(true)
      onChange(null)
    }
  }

  const handleSave = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      // Get signature as base64 PNG
      const dataURL = sigCanvas.current.toDataURL("image/png")
      onChange(dataURL)
      setIsEmpty(false)
    } else {
      onChange(null)
      setIsEmpty(true)
    }
  }

  const handleBegin = () => {
    setIsEmpty(false);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div
        className={cn(
          "border rounded-md overflow-hidden",
          error ? "border-rose-500" : "border-gray-300"
        )}
      >
        <SignatureCanvas
          ref={sigCanvas}
          canvasProps={{
            id: id,
            className: "signature-canvas bg-white w-full h-48 touch-none",
            style: { touchAction: 'none' } // Disable browser touch actions
          }}
          minWidth={0.5}
          maxWidth={2.5}
          penColor="black"
          onEnd={handleSave}
          onBegin={handleBegin}
        />
        <div className="flex justify-end p-2 bg-gray-50 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={isEmpty}
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Clear
          </Button>
        </div>
      </div>
      {value && !isEmpty && (
        <p className="text-sm text-green-600 flex items-center">
          <Check className="h-4 w-4 mr-1" /> Signature captured.
        </p>
      )}
      {required && error && isEmpty && (
        <p className="text-sm text-rose-500">Signature is required.</p>
      )}
    </div>
  )
}