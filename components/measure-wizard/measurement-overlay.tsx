"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Save, Ruler } from "lucide-react"
import { MeasurementInput } from "@/components/measurement-input"
import { formatMeasurement } from "@/utils/measurements"
import { useMobile } from "@/hooks/use-mobile"
import { roundToNearest } from "@/utils/measurements"
import type { WindowBounds, WizardMeasurements, Point } from "@/types/window-item"
import { Label } from "@/components/ui/label"

interface MeasurementOverlayProps {
  imageData: string
  initialWindowBounds: WindowBounds
  initialMeasurements: WizardMeasurements | null
  onMeasurementsChange: (measurements: WizardMeasurements) => void
}

export function MeasurementOverlay({
  imageData,
  initialWindowBounds,
  initialMeasurements,
  onMeasurementsChange,
}: MeasurementOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })
  const [measurements, setMeasurements] = useState<WizardMeasurements>(
    initialMeasurements || {
      widths: { T: 0, M: 0, B: 0 },
      heights: { L: 0, C: 0, R: 0 },
    },
  )
  const [baseScaleFactor, setBaseScaleFactor] = useState(1); // New state for base scale factor
  const isMobile = useMobile()

  // Calculate canvas dimensions based on image aspect ratio and container width
  useEffect(() => {
    const img = new Image()
    img.src = imageData
    img.onload = () => {
      imageRef.current = img
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth
        const aspectRatio = img.naturalHeight / img.naturalWidth
        setCanvasDimensions({ width: containerWidth, height: containerWidth * aspectRatio })
        
        const referenceWidth = 1000; // Reference width for scaling
        setBaseScaleFactor(img.naturalWidth / referenceWidth); // Set base scale factor
      }
    }
  }, [imageData])

  // Draw measurements on canvas
  const drawMeasurements = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const image = imageRef.current
    if (!canvas || !ctx || !image || canvasDimensions.width === 0 || canvasDimensions.height === 0) return

    // Set canvas display size to match container, but drawing buffer to image natural size
    canvas.style.width = `${canvasDimensions.width}px`
    canvas.style.height = `${canvasDimensions.height}px`
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight)

    const { tl, tr, bl, br } = initialWindowBounds

    // Draw the skewed window bounds
    ctx.strokeStyle = "#4f46e5" // indigo-600
    ctx.lineWidth = 3 * baseScaleFactor; // Scaled line width
    ctx.setLineDash([5 * baseScaleFactor, 5 * baseScaleFactor]); // Scaled dash pattern
    ctx.beginPath()
    ctx.moveTo(tl.x, tl.y)
    ctx.lineTo(tr.x, tr.y)
    ctx.lineTo(br.x, br.y)
    ctx.lineTo(bl.x, bl.y)
    ctx.closePath()
    ctx.stroke()
    ctx.setLineDash([])

    // Helper for linear interpolation
    const lerp = (p1: Point, p2: Point, t: number): Point => ({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
    })

    // Calculate points for width lines
    const widthLines = {
      T: { start: lerp(tl, bl, 0.15), end: lerp(tr, br, 0.15) },
      M: { start: lerp(tl, bl, 0.5), end: lerp(tr, br, 0.5) },
      B: { start: lerp(tl, bl, 0.85), end: lerp(tr, br, 0.85) },
    }

    // Calculate points for height lines
    const heightLines = {
      L: { start: lerp(tl, tr, 0.15), end: lerp(bl, br, 0.15) },
      C: { start: lerp(tl, tr, 0.5), end: lerp(bl, br, 0.5) },
      R: { start: lerp(tl, tr, 0.85), end: lerp(bl, br, 0.85) },
    }

    // Draw horizontal (width) lines and labels
    ctx.strokeStyle = "#3b82f6" // blue-500
    ctx.lineWidth = 2 * baseScaleFactor; // Scaled line width
    ctx.setLineDash([2 * baseScaleFactor, 2 * baseScaleFactor]); // Scaled dash pattern
    Object.entries(widthLines).forEach(([key, line]) => {
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()

      // Label (T, M, B)
      ctx.fillStyle = "#3b82f6"
      ctx.font = `bold ${24 * baseScaleFactor}px Arial`; // Scaled font size
      ctx.textAlign = "right"
      ctx.textBaseline = "middle"
      ctx.fillText(key, line.start.x - (10 * baseScaleFactor), line.start.y) // Scaled padding
    })

    // Draw vertical (height) lines and labels
    ctx.strokeStyle = "#22c55e" // green-500
    ctx.lineWidth = 2 * baseScaleFactor; // Scaled line width
    ctx.setLineDash([2 * baseScaleFactor, 2 * baseScaleFactor]); // Scaled dash pattern
    Object.entries(heightLines).forEach(([key, line]) => {
      ctx.beginPath()
      ctx.moveTo(line.start.x, line.start.y)
      ctx.lineTo(line.end.x, line.end.y)
      ctx.stroke()

      // Label (L, C, R)
      ctx.fillStyle = "#22c55e"
      ctx.font = `bold ${24 * baseScaleFactor}px Arial`; // Scaled font size
      ctx.textAlign = "center"
      ctx.textBaseline = "bottom"
      ctx.fillText(key, line.start.x, line.start.y - (10 * baseScaleFactor)) // Scaled padding
    })
    ctx.setLineDash([]) // Reset line dash

    // Draw measurement values on canvas for mobile
    if (isMobile) {
      ctx.font = `bold ${20 * baseScaleFactor}px Arial`; // Scaled font size
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const textPadding = 5 * baseScaleFactor; // Scaled padding
      const textHeight = 20 * baseScaleFactor; // Scaled height
      const roundedRectRadius = 8 * baseScaleFactor; // Scaled radius

      // Width values
      Object.entries(measurements.widths).forEach(([key, value]) => {
        if (value > 0) {
          const line = widthLines[key as keyof typeof widthLines];
          const midPoint = lerp(line.start, line.end, 0.5);
          const text = formatMeasurement(value) + '"';
          const textMetrics = ctx.measureText(text);
          const textWidth = textMetrics.width;
          ctx.fillStyle = "rgba(59, 130, 246, 0.7)"; // Blue background
          drawRoundedRect(ctx, midPoint.x - textWidth / 2 - textPadding, midPoint.y - textHeight / 2 - 2, textWidth + (textPadding * 2), textHeight + 4, roundedRectRadius);
          ctx.fillStyle = "#ffffff"; // White text
          ctx.fillText(text, midPoint.x, midPoint.y);
        }
      });

      // Height values (positioned centrally between M and B width lines)
      const yPosM = lerp(widthLines.M.start, widthLines.M.end, 0.5).y;
      const yPosB = lerp(widthLines.B.start, widthLines.B.end, 0.5).y;
      const heightTextY = (yPosM + yPosB) / 2;

      Object.entries(measurements.heights).forEach(([key, value]) => {
        if (value > 0) {
          const line = heightLines[key as keyof typeof heightLines];
          const midPoint = lerp(line.start, line.end, 0.5);
          const text = formatMeasurement(value) + '"';
          const textMetrics = ctx.measureText(text);
          const textWidth = textMetrics.width;
          
          const textX = midPoint.x;
          const textY = heightTextY;

          ctx.fillStyle = "rgba(34, 197, 94, 0.7)"; // Green background
          drawRoundedRect(ctx, textX - textWidth / 2 - textPadding, textY - textHeight / 2 - 2, textWidth + (textPadding * 2), textHeight + 4, roundedRectRadius);
          ctx.fillStyle = "#ffffff"; // White text
          ctx.fillText(text, textX, textY);
        }
      });
    }
  }, [imageData, canvasDimensions, initialWindowBounds, measurements, isMobile, baseScaleFactor])

  // Redraw on state changes
  useEffect(() => {
    drawMeasurements()
  }, [drawMeasurements])

  // Handle measurement input changes
  const handleWidthChange = (key: 'T' | 'M' | 'B', value: number) => {
    setMeasurements(prev => {
      const newMeasurements = {
        ...prev,
        widths: {
          ...prev.widths,
          [key]: value,
        },
      };
      onMeasurementsChange(newMeasurements);
      return newMeasurements;
    });
  };

  const handleHeightChange = (key: 'L' | 'C' | 'R', value: number) => {
    setMeasurements(prev => {
      const newMeasurements = {
        ...prev,
        heights: {
          ...prev.heights,
          [key]: value,
        },
      };
      onMeasurementsChange(newMeasurements);
      return newMeasurements;
    });
  };

  // Calculate fixed positions for rendering inputs
  const getScaledX = (naturalX: number) => naturalX / (imageRef.current?.naturalWidth || 1) * canvasDimensions.width;
  const getScaledY = (naturalY: number) => naturalY / (imageRef.current?.naturalHeight || 1) * canvasDimensions.height;

  const inputWidth = isMobile ? 80 : 100;
  const inputHeight = 40;

  const lerp = (p1: Point, p2: Point, t: number): Point => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  });

  const { tl, tr, bl, br } = initialWindowBounds;
  const widthLines = {
    T: { start: lerp(tl, bl, 0.15), end: lerp(tr, br, 0.15) },
    M: { start: lerp(tl, bl, 0.5), end: lerp(tr, br, 0.5) },
    B: { start: lerp(tl, bl, 0.85), end: lerp(tr, br, 0.85) },
  };
  const heightLines = {
    L: { start: lerp(tl, tr, 0.15), end: lerp(bl, br, 0.15) },
    C: { start: lerp(tl, tr, 0.5), end: lerp(bl, br, 0.5) },
    R: { start: lerp(tl, tr, 0.85), end: lerp(bl, br, 0.85) },
  };

  // Calculate the Y position for the height inputs, halfway between M and B lines
  const yPosM = lerp(widthLines.M.start, widthLines.M.end, 0.5).y;
  const yPosB = lerp(widthLines.B.start, widthLines.B.end, 0.5).y;
  const heightInputY = (yPosM + yPosB) / 2;

  // Helper to draw rounded rectangle for text background
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
    ctx.fill();
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-full bg-gray-200 overflow-hidden border rounded-lg"
        ref={containerRef}
        style={{ height: canvasDimensions.height > 0 ? canvasDimensions.height : "auto" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0"
          style={{
            width: "100%",
            height: "100%",
          }}
        />

        {/* Render Measurement Inputs only if image is loaded and dimensions are set AND NOT mobile */}
        {!isMobile && imageRef.current && canvasDimensions.width > 0 && canvasDimensions.height > 0 && (
          <>
            {/* Width Inputs */}
            {Object.entries(widthLines).map(([key, line]) => {
              const midPoint = lerp(line.start, line.end, 0.5);
              return (
                <div
                  key={`width-${key}`}
                  className="absolute"
                  style={{
                    top: getScaledY(midPoint.y) - (inputHeight / 2),
                    left: getScaledX(midPoint.x) - (inputWidth / 2),
                    width: `${inputWidth}px`,
                    height: `${inputHeight}px`,
                  }}
                >
                  <MeasurementInput
                    id={`width-${key}`}
                    label=""
                    value={measurements.widths[key as 'T' | 'M' | 'B']}
                    onChange={(val) => handleWidthChange(key as 'T' | 'M' | 'B', val)}
                    labelColor="hidden"
                    error={false}
                    borderColor="border-blue-500"
                    className="text-center"
                  />
                </div>
              );
            })}

            {/* Height Inputs */}
            {Object.entries(heightLines).map(([key, line]) => {
              const midPoint = lerp(line.start, line.end, 0.5);
              return (
                <div
                  key={`height-${key}`}
                  className="absolute"
                  style={{
                    top: getScaledY(heightInputY) - (inputHeight / 2),
                    left: getScaledX(midPoint.x) - (inputWidth / 2),
                    width: `${inputWidth}px`,
                    height: `${inputHeight}px`,
                  }}
                >
                  <MeasurementInput
                    id={`height-${key}`}
                    label=""
                    value={measurements.heights[key as 'L' | 'C' | 'R']}
                    onChange={(val) => handleHeightChange(key as 'L' | 'C' | 'R', val)}
                    labelColor="hidden"
                    error={false}
                    borderColor="border-green-500"
                    className="text-center"
                  />
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg border w-full">
        {/* Always render the input fields below the image */}
        {isMobile ? (
          <div className="grid grid-cols-2 gap-x-4">
            <div className="space-y-2">
              <h4 className="text-blue-600 font-medium text-center mb-2">Width</h4>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-width-T" className="w-8 font-bold text-blue-600 text-right">T:</Label>
                <MeasurementInput id="summary-width-T" label="" value={measurements.widths.T} onChange={(val) => handleWidthChange('T', val)} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-width-M" className="w-8 font-bold text-blue-600 text-right">M:</Label>
                <MeasurementInput id="summary-width-M" label="" value={measurements.widths.M} onChange={(val) => handleWidthChange('M', val)} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-width-B" className="w-8 font-bold text-blue-600 text-right">B:</Label>
                <MeasurementInput id="summary-width-B" label="" value={measurements.widths.B} onChange={(val) => handleWidthChange('B', val)} className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-green-600 font-medium text-center mb-2">Height</h4>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-height-L" className="w-8 font-bold text-green-600 text-right">L:</Label>
                <MeasurementInput id="summary-height-L" label="" value={measurements.heights.L} onChange={(val) => handleHeightChange('L', val)} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-height-C" className="w-8 font-bold text-green-600 text-right">C:</Label>
                <MeasurementInput id="summary-height-C" label="" value={measurements.heights.C} onChange={(val) => handleHeightChange('C', val)} className="flex-1" />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="summary-height-R" className="w-8 font-bold text-green-600 text-right">R:</Label>
                <MeasurementInput id="summary-height-R" label="" value={measurements.heights.R} onChange={(val) => handleHeightChange('R', val)} className="flex-1" />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-blue-600 font-medium w-16">Width:</span>
              <div className="flex-1 grid grid-cols-3 gap-4">
                <MeasurementInput id="summary-width-T" label="T:" value={measurements.widths.T} onChange={(val) => handleWidthChange('T', val)} labelColor="text-blue-600" />
                <MeasurementInput id="summary-width-M" label="M:" value={measurements.widths.M} onChange={(val) => handleWidthChange('M', val)} labelColor="text-blue-600" />
                <MeasurementInput id="summary-width-B" label="B:" value={measurements.widths.B} onChange={(val) => handleWidthChange('B', val)} labelColor="text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-green-600 font-medium w-16">Height:</span>
              <div className="flex-1 grid grid-cols-3 gap-4">
                <MeasurementInput id="summary-height-L" label="L:" value={measurements.heights.L} onChange={(val) => handleHeightChange('L', val)} labelColor="text-green-600" />
                <MeasurementInput id="summary-height-C" label="C:" value={measurements.heights.C} onChange={(val) => handleHeightChange('C', val)} labelColor="text-green-600" />
                <MeasurementInput id="summary-height-R" label="R:" value={measurements.heights.R} onChange={(val) => handleHeightChange('R', val)} labelColor="text-green-600" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}