"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HelpCircle, ImageIcon, Ruler, PenTool } from "lucide-react"

export function HelpGuide() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
        <HelpCircle className="h-5 w-5 mr-1" />
        Help
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Window Measurement App Guide</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="capture">Image Capture</TabsTrigger>
              <TabsTrigger value="detection">Window Detection</TabsTrigger>
              <TabsTrigger value="measurement">Measurements</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Getting Started</h3>
                <p className="text-gray-700">
                  The Window Measurement App helps field installers accurately measure windows for Hunter Douglas
                  products. Follow these steps to measure a window:
                </p>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  <li>Add a new window by clicking the "Add Window" button</li>
                  <li>Fill in the basic window information (location, product, etc.)</li>
                  <li>Click the "Measure Wizard" button to start the measurement process</li>
                  <li>Follow the three-step wizard to capture, detect, and measure the window</li>
                  <li>Save your measurements to update the window data</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-medium">Key Features</h3>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li>Image capture with camera or file upload</li>
                  <li>Automatic window edge detection</li>
                  <li>Manual adjustment of window boundaries</li>
                  <li>Multiple measurement points for width, height, and diagonals</li>
                  <li>Data persistence with local storage</li>
                  <li>Export and import functionality</li>
                </ul>
              </div>

              <div className="bg-blue-50 p-4 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Tip:</strong> For best results, take photos in good lighting conditions and ensure the entire
                  window is visible in the frame.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="capture" className="space-y-4 mt-4">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-100 p-2 rounded-md">
                  <ImageIcon className="h-10 w-10 text-indigo-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Image Capture</h3>
                  <p className="text-gray-700">
                    The first step in the measurement process is capturing a clear image of the window.
                  </p>

                  <h4 className="font-medium mt-4">Tips for Good Photos:</h4>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Ensure good lighting - avoid shadows and glare</li>
                    <li>Capture the entire window frame in the photo</li>
                    <li>Hold the camera parallel to the window (avoid angles)</li>
                    <li>Stand at a distance that allows the entire window to be visible</li>
                    <li>Make sure the window edges are clearly visible</li>
                  </ul>

                  <h4 className="font-medium mt-4">Options:</h4>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      <strong>Take Photo:</strong> Use your device's camera (mobile only)
                    </li>
                    <li>
                      <strong>Upload Image:</strong> Select an existing image from your device
                    </li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="detection" className="space-y-4 mt-4">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-100 p-2 rounded-md">
                  <PenTool className="h-10 w-10 text-indigo-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Window Detection</h3>
                  <p className="text-gray-700">The second step is identifying the window boundaries in the image.</p>

                  <h4 className="font-medium mt-4">Auto Detection:</h4>
                  <p className="text-gray-700">
                    The app uses edge detection to automatically find the window boundaries. You can adjust the
                    sensitivity using the slider.
                  </p>

                  <h4 className="font-medium mt-4">Manual Selection:</h4>
                  <p className="text-gray-700">
                    If auto detection doesn't work well, you can manually draw a rectangle around the window.
                  </p>

                  <h4 className="font-medium mt-4">Adjusting the Selection:</h4>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Drag the corners to resize the selection</li>
                    <li>Drag the center to move the entire selection</li>
                    <li>Use pinch gestures to zoom in/out on mobile devices</li>
                    <li>Click "Confirm Selection" when done</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="measurement" className="space-y-4 mt-4">
              <div className="flex items-start space-x-4">
                <div className="bg-gray-100 p-2 rounded-md">
                  <Ruler className="h-10 w-10 text-indigo-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-medium">Adding Measurements</h3>
                  <p className="text-gray-700">The final step is adding measurement points to the window.</p>

                  <h4 className="font-medium mt-4">Types of Measurements:</h4>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>
                      <strong>Width:</strong> Horizontal measurements (blue)
                    </li>
                    <li>
                      <strong>Height:</strong> Vertical measurements (green)
                    </li>
                    <li>
                      <strong>Diagonal:</strong> Diagonal measurements (purple)
                    </li>
                  </ul>

                  <h4 className="font-medium mt-4">Adding Measurements:</h4>
                  <ol className="list-decimal list-inside space-y-1 pl-4">
                    <li>Click the "Add Width", "Add Height", or "Add Diagonal" button</li>
                    <li>Click on the image to place the measurement</li>
                    <li>For diagonals, click twice to set both endpoints</li>
                    <li>Enter the actual measurement value</li>
                  </ol>

                  <h4 className="font-medium mt-4">Editing Measurements:</h4>
                  <ul className="list-disc list-inside space-y-1 pl-4">
                    <li>Click on a measurement to select it</li>
                    <li>Click "Edit" to modify its position or value</li>
                    <li>Click "Delete" to remove it</li>
                    <li>Click "Save Measurements" when done</li>
                  </ul>

                  <div className="bg-yellow-50 p-3 rounded-md mt-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> All measurements are automatically rounded to the nearest 1/8" (0.125").
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4 pt-4 border-t">
            <Button onClick={() => setIsOpen(false)}>Close Guide</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
