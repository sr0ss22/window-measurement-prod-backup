"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Camera as CameraIcon, Upload, RefreshCw, ImageIcon, AlertCircle } from "lucide-react"
import { useMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Capacitor } from "@capacitor/core"
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera"

interface ImageCaptureProps {
  onCapture: (imageData: string) => void
}

export function ImageCapture({ onCapture }: ImageCaptureProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMobile()
  const isNative = Capacitor.isNativePlatform()

  const processImageData = (imageData: string) => {
    const img = new Image()
    img.onload = () => {
      if (img.width < 200 || img.height < 200) {
        setError("Image is too small. Please upload a larger image.")
        setIsLoading(false)
        return
      }
      setPreviewImage(imageData)
      onCapture(imageData)
      setIsLoading(false)
    }
    img.onerror = () => {
      setError("Failed to load image. Please try another file.")
      setIsLoading(false)
    }
    img.src = imageData
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPEG, PNG, etc.)")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Please upload an image smaller than 10MB")
      return
    }

    setIsLoading(true)
    const reader = new FileReader()

    reader.onload = (event) => {
      if (event.target?.result) {
        processImageData(event.target.result.toString())
      }
    }

    reader.onerror = () => {
      setError("Failed to read file. Please try again.")
      setIsLoading(false)
    }

    reader.readAsDataURL(file)
  }

  const handleTakePhoto = async () => {
    setError(null)
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      })

      if (image.dataUrl) {
        setIsLoading(true)
        processImageData(image.dataUrl)
      }
    } catch (e) {
      console.warn("Camera operation cancelled by user.", e)
      // No error message needed if user cancels
    }
  }

  const resetSelection = () => {
    setPreviewImage(null)
    setError(null)
  }

  return (
    <div className="flex flex-col items-center">
      {error && (
        <Alert variant="destructive" className="mb-4 max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {previewImage ? (
        <div className="w-full max-w-lg">
          <div className="border rounded-lg overflow-hidden mb-4">
            <img src={previewImage} alt="Captured window" className="w-full h-auto" />
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" className="flex-1" onClick={resetSelection} disabled={isLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Replace Image
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center bg-gray-50">
            <ImageIcon className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload or Take a Photo</h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Take a clear photo of the window for accurate measurements
            </p>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </>
                )}
              </Button>
              {isNative && (
                <Button
                  onClick={handleTakePhoto}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={isLoading}
                >
                  <CameraIcon className="mr-2 h-4 w-4" />
                  Take Photo
                </Button>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
            <p className="text-xs text-gray-500 mt-4">
              For best results, ensure the window is well-lit and the entire frame is visible
            </p>
          </div>
        </div>
      )}
    </div>
  )
}