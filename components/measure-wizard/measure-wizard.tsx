"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ArrowLeft, ArrowRight, Move, Save, Bot } from "lucide-react"
import { ImageCapture } from "./image-capture"
import { WindowDetection, type WindowDetectionHandles } from "./window-detection"
import { MeasurementOverlay } from "./measurement-overlay"
import type { WindowItem, WizardMeasurements, WindowBounds } from "@/types/window-item"
import { useMobile } from "@/hooks/use-mobile"
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
import { cn } from "@/lib/utils"

export interface MeasureWizardProps {
  isOpen: boolean
  onClose: () => void
  window: WindowItem
  onSave: (windowData: {
    wizardImage: string | null
    wizardWindowBounds: WindowBounds | null
    wizardMeasurements: WizardMeasurements | null
  }) => void
}

type WizardStep = "capture" | "detection" | "measurement"
type DetectionMode = "simpleRect" | "adjustFraming"

export function MeasureWizard({ isOpen, onClose, window, onSave }: MeasureWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>("capture")
  const router = useRouter()
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [windowBounds, setWindowBounds] = useState<WindowBounds | null>(null)
  const [measurements, setMeasurements] = useState<WizardMeasurements | null>(null)
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false)
  const [isBackConfirmOpen, setIsBackConfirmOpen] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("simpleRect")
  const detectionRef = useRef<WindowDetectionHandles>(null)
  const isMobile = useMobile()

  const stepTitles: Record<WizardStep, string> = {
    capture: "Step 1: Capture or Upload Image",
    detection: "Step 2: Identify Window Area",
    measurement: "Step 3: Add Measurements",
  }

  useEffect(() => {
    if (isOpen) {
      // Determine initial measurements
      let initialMeasurements: WizardMeasurements = {
        widths: { T: 0, M: 0, B: 0 },
        heights: { L: 0, C: 0, R: 0 },
      };
  
      if (window.wizardMeasurements) {
        // If wizard data already exists, use it
        initialMeasurements = window.wizardMeasurements;
      } else if (window.width > 0 || window.height > 0) {
        // If no wizard data, but line item has width/height, pre-populate
        initialMeasurements.widths.T = window.width;
        initialMeasurements.heights.C = window.height;
      }
      
      setMeasurements(initialMeasurements);
  
      // Determine initial image and step
      if (window.wizardImage) {
        setCapturedImage(window.wizardImage);
        setWindowBounds(window.wizardWindowBounds || null);
        setCurrentStep(window.wizardWindowBounds ? "measurement" : "detection");
      } else if (window.image) {
        setCapturedImage(window.image);
        setWindowBounds(null);
        setCurrentStep("detection");
      } else {
        setCapturedImage(null);
        setWindowBounds(null);
        setCurrentStep("capture");
      }
      
      setHasUnsavedChanges(false);
    }
  }, [isOpen, window]);

  const handleImageCapture = (imageData: string) => {
    setCapturedImage(imageData)
    setCurrentStep("detection")
    setHasUnsavedChanges(true)
  }

  const handleMeasurementsChange = (measurementData: WizardMeasurements) => {
    setMeasurements(measurementData)
    setHasUnsavedChanges(true)
  }

  const handleSaveAndClose = () => {
    if (!measurements) return
    onSave({
      wizardImage: capturedImage,
      wizardWindowBounds: windowBounds,
      wizardMeasurements: measurements,
    })
    setHasUnsavedChanges(false)
    onClose()
  }

  const handleHelp = () => {
    if (!measurements) return
    // First, save the current measurements
    onSave({
      wizardImage: capturedImage,
      wizardWindowBounds: windowBounds,
      wizardMeasurements: measurements,
    })
    setHasUnsavedChanges(false)
    // Then, navigate to the product helper page
    router.push(`/product-helper?projectId=${window.project_id}&windowId=${window.id}`);
  }

  const handleNext = () => {
    if (currentStep === "capture" && capturedImage) {
      setCurrentStep("detection")
    } else if (currentStep === "detection") {
      const bounds = detectionRef.current?.getBounds()
      if (bounds) {
        setWindowBounds(bounds)
        setCurrentStep("measurement")
        setHasUnsavedChanges(true)
      }
    }
  }

  const handleBack = () => {
    if (currentStep === "detection") {
      setCurrentStep("capture")
    } else if (currentStep === "measurement") {
      setCurrentStep("detection")
    }
  }

  const handleBackToWorkOrder = () => {
    if (window.project_id) {
      router.push(`/work-order?id=${window.project_id}`);
    } else {
      router.push('/projects');
    }
  };

  const attemptNavigation = () => {
    if (hasUnsavedChanges) {
      setIsBackConfirmOpen(true);
    } else {
      handleBackToWorkOrder();
    }
  };

  const handleCloseWizard = () => {
    if (hasUnsavedChanges) {
      setIsCloseConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const handleToggleFraming = () => {
    detectionRef.current?.toggleFramingMode()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case "capture":
        return <ImageCapture onCapture={handleImageCapture} />
      case "detection":
        return capturedImage ? <WindowDetection ref={detectionRef} imageData={capturedImage} onModeChange={setDetectionMode} /> : null
      case "measurement":
        return capturedImage && windowBounds ? (
          <MeasurementOverlay
            imageData={capturedImage}
            initialWindowBounds={windowBounds}
            initialMeasurements={measurements}
            onMeasurementsChange={handleMeasurementsChange}
          />
        ) : null
      default:
        return null
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleCloseWizard()}>
        <DialogContent
          className={cn(
            "flex flex-col overflow-hidden",
            isMobile
              ? "w-screen h-dvh max-h-dvh rounded-none border-0 p-0"
              : "max-w-6xl max-h-[90vh]"
          )}
        >
          <DialogHeader className="p-4 pt-[calc(2rem+env(safe-area-inset-top))] border-b flex-shrink-0">
            <div className="flex items-center justify-between relative">
              <Button variant="ghost" size="icon" onClick={attemptNavigation} className="absolute left-0">
                <ArrowLeft className="h-6 w-6" />
              </Button>
              <DialogTitle className="text-lg sm:text-xl font-bold text-center flex-1 truncate">{stepTitles[currentStep]}</DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {renderStepContent()}
          </div>

          <div className="p-4 border-t flex justify-between items-center flex-shrink-0 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex space-x-2">
              {currentStep !== "capture" && (
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              {currentStep === "measurement" ? (
                <>
                  <Button variant="outline" onClick={handleHelp}>
                    <Bot className="mr-2 h-4 w-4" />
                    Help
                  </Button>
                  <Button onClick={handleSaveAndClose} className="bg-green-600 hover:bg-green-700">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </>
              ) : (
                <Button onClick={handleNext} disabled={!capturedImage}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to close the wizard? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onClose} className="bg-red-500 hover:bg-red-600">
              Close Wizard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBackConfirmOpen} onOpenChange={setIsBackConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to go back? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBackToWorkOrder} className="bg-red-500 hover:bg-red-600">Go Back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}