"use client"

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMobile } from "@/hooks/use-mobile"
import type { WindowBounds, Point } from "@/types/window-item"
import { AlertCircle, X, Move } from "lucide-react"
import { Button } from "@/components/ui/button"

// Define types for simple rectangle bounds
interface RectangleBounds {
  x: number
  y: number
  width: number
  height: number
}

type DetectionMode = "simpleRect" | "adjustFraming"

export interface WindowDetectionHandles {
  resetSelection: () => void
  toggleFramingMode: () => void
  getBounds: () => WindowBounds | null
}

interface WindowDetectionProps {
  imageData: string
  onModeChange?: (mode: DetectionMode) => void
}

export const WindowDetection = forwardRef<WindowDetectionHandles, WindowDetectionProps>(({ imageData, onModeChange }, ref) => {
  const [mode, setMode] = useState<DetectionMode>("simpleRect")
  const [error, setError] = useState<string | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const [rectangleBounds, setRectangleBounds] = useState<RectangleBounds | null>(null)
  const [windowBounds, setWindowBounds] = useState<WindowBounds | null>(null)
  const [dragStartPos, setDragStartPos] = useState<Point | null>(null)
  const [activeHandle, setActiveHandle] = useState<"tl" | "tr" | "bl" | "br" | "n" | "s" | "e" | "w" | "move" | null>(null)
  const [originalRectBounds, setOriginalRectBounds] = useState<RectangleBounds | null>(null)
  const [originalWindowBounds, setOriginalWindowBounds] = useState<WindowBounds | null>(null)

  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const zoomCanvasRef = useRef<HTMLCanvasElement>(null); // Ref for the zoom canvas
  const offscreenCanvasRef = useRef<HTMLCanvasElement>(null); // Ref for the offscreen canvas

  const [isZooming, setIsZooming] = useState(false);
  const [zoomPoint, setZoomPoint] = useState<Point | null>(null); // Point on the main canvas to magnify
  const [zoomPosition, setZoomPosition] = useState<{ left: string; top: string } | null>(null);
  const ZOOM_RADIUS = 60; // Radius of the zoom circle on screen
  const ZOOM_LEVEL = 2.5; // Magnification level

  const [baseScaleFactor, setBaseScaleFactor] = useState(1); // New state for base scale factor

  const isMobile = useMobile()

  useEffect(() => {
    if (imageRef.current && imageRef.current.complete && canvasRef.current && overlayCanvasRef.current && offscreenCanvasRef.current) {
      initializeCanvas()
    }
  }, [imageData])

  useEffect(() => {
    onModeChange?.(mode)
  }, [mode, onModeChange])

  useEffect(() => {
    if (canvasWidth > 0 && canvasHeight > 0) {
      drawOverlay()
    }
  }, [canvasWidth, canvasHeight, rectangleBounds, windowBounds, mode, baseScaleFactor])

  useEffect(() => {
    if (isZooming) {
      drawZoomCircle();
    }
  }, [isZooming, zoomPoint, mode, rectangleBounds, windowBounds, zoomPosition, baseScaleFactor]);

  const getScaledDisplayPoint = (naturalPoint: Point): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !imageRef.current) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / imageRef.current.naturalWidth;
    const scaleY = rect.height / imageRef.current.naturalHeight;
    return {
      x: naturalPoint.x * scaleX,
      y: naturalPoint.y * scaleY,
    };
  };

  useEffect(() => {
    if (isZooming && zoomPoint && activeHandle) {
        const displayPoint = getScaledDisplayPoint(zoomPoint);
        const offset = 80; // Reduced offset
        const circleDiameter = ZOOM_RADIUS * 2;

        // Calculate proposed position
        let proposedLeft = displayPoint.x + 20;
        let proposedTop = displayPoint.y + 20;

        if (activeHandle.includes('l')) {
            proposedLeft = displayPoint.x + offset;
        } else if (activeHandle.includes('r')) {
            proposedLeft = displayPoint.x - offset - circleDiameter;
        }

        if (activeHandle.includes('t')) {
            proposedTop = displayPoint.y + offset;
        } else if (activeHandle.includes('b')) {
            proposedTop = displayPoint.y - offset - circleDiameter;
        }

        // Handle cardinal directions if they are not part of a corner
        if (activeHandle === 'n') proposedTop = displayPoint.y + offset;
        if (activeHandle === 's') proposedTop = displayPoint.y - offset - circleDiameter;
        if (activeHandle === 'w') proposedLeft = displayPoint.x + offset;
        if (activeHandle === 'e') proposedLeft = displayPoint.x - offset - circleDiameter;
        
        if (activeHandle === 'move') {
            proposedLeft = displayPoint.x - (circleDiameter / 2);
            proposedTop = displayPoint.y - offset - circleDiameter;
        }

        // Get container bounds for clamping
        const container = overlayCanvasRef.current?.parentElement;
        if (container) {
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;

            // Clamp the position to stay within the container
            const finalLeft = Math.max(0, Math.min(proposedLeft, containerWidth - circleDiameter));
            const finalTop = Math.max(0, Math.min(proposedTop, containerHeight - circleDiameter));

            setZoomPosition({ left: `${finalLeft}px`, top: `${finalTop}px` });
        } else {
            setZoomPosition({ left: `${proposedLeft}px`, top: `${proposedTop}px` }); // Fallback without clamping
        }
    } else {
        setZoomPosition(null);
    }
  }, [isZooming, zoomPoint, activeHandle]);

  const initializeCanvas = () => {
    try {
      if (!imageRef.current || !canvasRef.current || !overlayCanvasRef.current || !offscreenCanvasRef.current) return

      const img = imageRef.current
      const canvas = canvasRef.current
      const overlayCanvas = overlayCanvasRef.current
      const offscreenCanvas = offscreenCanvasRef.current

      const imgWidth = img.naturalWidth
      const imgHeight = img.naturalHeight

      canvas.width = imgWidth
      canvas.height = imgHeight
      overlayCanvas.width = imgWidth
      overlayCanvas.height = imgHeight
      offscreenCanvas.width = imgWidth; // Initialize offscreen canvas
      offscreenCanvas.height = imgHeight; // Initialize offscreen canvas

      setCanvasWidth(imgWidth)
      setCanvasHeight(imgHeight)

      // Calculate and set the baseScaleFactor
      const referenceWidth = 1000; // Reference width for scaling
      setBaseScaleFactor(imgWidth / referenceWidth);

      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight)
      }

      if (!rectangleBounds) {
        const defaultWidth = imgWidth * 0.6
        const defaultHeight = imgHeight * 0.6
        const defaultX = (imgWidth - defaultWidth) / 2
        const defaultY = (imgHeight - defaultHeight) / 2
        setRectangleBounds({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight })
      }
      drawOverlay()
    } catch (error) {
      console.error("Error initializing canvas:", error)
      setError("Error initializing canvas. Please try refreshing the page.")
    }
  }

  const drawOverlay = useCallback(() => {
    if (!overlayCanvasRef.current || !imageRef.current || !offscreenCanvasRef.current) return

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const offscreenCanvas = offscreenCanvasRef.current;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    if (!ctx || !offscreenCtx) return;

    // Clear both canvases
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Draw the base image onto the offscreen canvas (this will be used for zooming)
    offscreenCtx.drawImage(imageRef.current, 0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Now, draw the overlay elements directly onto the visible overlayCanvas
    // Draw the semi-transparent mask
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const handleSize = (isMobile ? 60 : 36) * baseScaleFactor; // Scaled handle size
    const halfHandle = handleSize / 2;

    if (mode === "simpleRect" && rectangleBounds) {
      const { x, y, width, height } = rectangleBounds;

      // Cut out the rectangle from the mask
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(255, 255, 255, 1)"; // Any opaque color will work for cutting out
      ctx.fillRect(x, y, width, height);
      ctx.restore();

      // Draw the border
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 6 * baseScaleFactor; // Scaled line width
      ctx.setLineDash([5 * baseScaleFactor, 5 * baseScaleFactor]); // Scaled dash pattern
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);

      // Draw the handles
      ctx.fillStyle = "#4f46e5";
      ctx.fillRect(x - halfHandle, y - halfHandle, handleSize, handleSize);
      ctx.fillRect(x + width - halfHandle, y - halfHandle, handleSize, handleSize);
      ctx.fillRect(x - halfHandle, y + height - halfHandle, handleSize, handleSize);
      ctx.fillRect(x + width - halfHandle, y + height - halfHandle, handleSize, handleSize);
      ctx.fillRect(x + width / 2 - halfHandle, y - halfHandle, handleSize, handleSize);
      ctx.fillRect(x + width / 2 - halfHandle, y + height - halfHandle, handleSize, handleSize);
      ctx.fillRect(x - halfHandle, y + height / 2 - halfHandle, handleSize, handleSize);
      ctx.fillRect(x + width - halfHandle, y + height / 2 - halfHandle, handleSize, handleSize);
    } else if (mode === "adjustFraming" && windowBounds) {
      const { tl, tr, bl, br } = windowBounds;

      // Cut out the quadrilateral from the mask
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Draw the border
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 6 * baseScaleFactor; // Scaled line width
      ctx.setLineDash([5 * baseScaleFactor, 5 * baseScaleFactor]); // Scaled dash pattern
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw the handles
      ctx.fillStyle = "#4f46e5";
      ctx.fillRect(tl.x - halfHandle, tl.y - halfHandle, handleSize, handleSize);
      ctx.fillRect(tr.x - halfHandle, tr.y - halfHandle, handleSize, handleSize);
      ctx.fillRect(bl.x - halfHandle, bl.y - halfHandle, handleSize, handleSize);
      ctx.fillRect(br.x - halfHandle, br.y - halfHandle, handleSize, handleSize);
    }
  }, [mode, rectangleBounds, windowBounds, isMobile, baseScaleFactor]);

  const drawZoomCircle = useCallback(() => {
    if (!zoomCanvasRef.current || !offscreenCanvasRef.current || !zoomPoint) return;

    const zoomCanvas = zoomCanvasRef.current;
    const zoomCtx = zoomCanvas.getContext('2d');
    const offscreenCanvas = offscreenCanvasRef.current; // This has the full original image

    if (!zoomCtx) return;

    zoomCtx.clearRect(0, 0, zoomCanvas.width, zoomCanvas.height);

    // Calculate source rectangle on the offscreen canvas (original image)
    // The source rectangle is centered around the zoomPoint, but scaled down by ZOOM_LEVEL
    const sourceX = zoomPoint.x - (ZOOM_RADIUS / ZOOM_LEVEL);
    const sourceY = zoomPoint.y - (ZOOM_RADIUS / ZOOM_LEVEL);
    const sourceWidth = (ZOOM_RADIUS * 2) / ZOOM_LEVEL;
    const sourceHeight = (ZOOM_RADIUS * 2) / ZOOM_LEVEL;

    // Ensure source rectangle stays within offscreen canvas bounds
    const clampedSourceX = Math.max(0, Math.min(sourceX, offscreenCanvas.width - sourceWidth));
    const clampedSourceY = Math.max(0, Math.min(sourceY, offscreenCanvas.height - sourceHeight));

    // Draw the magnified portion of the original image
    zoomCtx.drawImage(
        offscreenCanvas,
        clampedSourceX,
        clampedSourceY,
        sourceWidth,
        sourceHeight,
        0, // Destination X
        0, // Destination Y
        zoomCanvas.width, // Destination Width
        zoomCanvas.height // Destination Height
    );

    // Now, draw the magnified selection overlay on top
    const handleSize = (isMobile ? 60 : 36) * baseScaleFactor; // Use scaled handle size from main overlay
    const halfHandle = handleSize / 2;

    // Calculate the offset for drawing magnified elements
    // This offset shifts the drawing so that the zoomPoint in the original image
    // aligns with the center of the zoom circle on the zoom canvas.
    const offsetX = ZOOM_RADIUS - (zoomPoint.x - clampedSourceX) * ZOOM_LEVEL;
    const offsetY = ZOOM_RADIUS - (zoomPoint.y - clampedSourceY) * ZOOM_LEVEL;

    zoomCtx.strokeStyle = "#4f46e5"; // Indigo color
    zoomCtx.lineWidth = (6 * baseScaleFactor) * ZOOM_LEVEL; // Scaled line width, then magnified
    zoomCtx.setLineDash([(5 * baseScaleFactor) * ZOOM_LEVEL, (5 * baseScaleFactor) * ZOOM_LEVEL]); // Scaled dash pattern, then magnified

    if (mode === "simpleRect" && rectangleBounds) {
        const { x, y, width, height } = rectangleBounds;
        // Magnify and offset the rectangle
        zoomCtx.strokeRect(
            x * ZOOM_LEVEL + offsetX,
            y * ZOOM_LEVEL + offsetY,
            width * ZOOM_LEVEL,
            height * ZOOM_LEVEL
        );
    } else if (mode === "adjustFraming" && windowBounds) {
        const { tl, tr, bl, br } = windowBounds;
        // Magnify and offset the quadrilateral
        zoomCtx.beginPath();
        zoomCtx.moveTo(tl.x * ZOOM_LEVEL + offsetX, tl.y * ZOOM_LEVEL + offsetY);
        zoomCtx.lineTo(tr.x * ZOOM_LEVEL + offsetX, tr.y * ZOOM_LEVEL + offsetY);
        zoomCtx.lineTo(br.x * ZOOM_LEVEL + offsetX, br.y * ZOOM_LEVEL + offsetY);
        zoomCtx.lineTo(bl.x * ZOOM_LEVEL + offsetX, bl.y * ZOOM_LEVEL + offsetY);
        zoomCtx.closePath();
        zoomCtx.stroke();
    }
    zoomCtx.setLineDash([]); // Reset line dash

    // Draw magnified handles
    zoomCtx.fillStyle = "#4f46e5";
    const magnifiedHandleSize = handleSize * ZOOM_LEVEL; // Magnify the already scaled handle size
    const halfMagnifiedHandle = magnifiedHandleSize / 2;

    if (mode === "simpleRect" && rectangleBounds) {
        const { x, y, width, height } = rectangleBounds;
        zoomCtx.fillRect(x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect((x + width) * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect(x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, (y + height) * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect((x + width) * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, (y + height) * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        // Also draw mid-point handles if needed, scaled similarly
        zoomCtx.fillRect((x + width / 2) * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect((x + width / 2) * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, (y + height) * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect(x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, (y + height / 2) * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect((x + width) * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, (y + height / 2) * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
    } else if (mode === "adjustFraming" && windowBounds) {
        const { tl, tr, bl, br } = windowBounds;
        zoomCtx.fillRect(tl.x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, tl.y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect(tr.x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, tr.y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect(bl.x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, bl.y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
        zoomCtx.fillRect(br.x * ZOOM_LEVEL + offsetX - halfMagnifiedHandle, br.y * ZOOM_LEVEL + offsetY - halfMagnifiedHandle, magnifiedHandleSize, magnifiedHandleSize);
    }

    // Draw crosshair at the center of the zoom circle
    zoomCtx.strokeStyle = 'white'; // Or a contrasting color
    zoomCtx.lineWidth = 2 * baseScaleFactor; // Scaled crosshair line width
    zoomCtx.setLineDash([]); // Ensure no dashes for crosshair

    const centerX = ZOOM_RADIUS;
    const centerY = ZOOM_RADIUS;
    const crosshairLength = ZOOM_RADIUS * 0.8; // Adjust length as needed

    zoomCtx.beginPath();
    zoomCtx.moveTo(centerX - (crosshairLength / 2), centerY);
    zoomCtx.lineTo(centerX + (crosshairLength / 2), centerY);
    zoomCtx.moveTo(centerX, centerY - (crosshairLength / 2));
    zoomCtx.lineTo(centerX, centerY + (crosshairLength / 2));
    zoomCtx.stroke();

    // Optional: Add a small circle at the center of the crosshair for more precision
    zoomCtx.beginPath();
    zoomCtx.arc(centerX, centerY, 3 * baseScaleFactor, 0, Math.PI * 2); // Scaled center dot
    zoomCtx.fillStyle = 'white';
    zoomCtx.fill();
    zoomCtx.strokeStyle = 'black';
    zoomCtx.lineWidth = 1 * baseScaleFactor; // Scaled border for center dot
    zoomCtx.stroke();

    // Draw a circle mask (this should be done last to apply to all drawn content)
    zoomCtx.globalCompositeOperation = 'destination-in';
    zoomCtx.beginPath();
    zoomCtx.arc(ZOOM_RADIUS, ZOOM_RADIUS, ZOOM_RADIUS, 0, Math.PI * 2);
    zoomCtx.fill();
    zoomCtx.globalCompositeOperation = 'source-over'; // Reset composite operation

    // Draw border
    zoomCtx.strokeStyle = '#4f46e5'; // Indigo color
    zoomCtx.lineWidth = 3 * baseScaleFactor; // Scaled border for zoom circle
    zoomCtx.beginPath();
    zoomCtx.arc(ZOOM_RADIUS, ZOOM_RADIUS, ZOOM_RADIUS - (1.5 * baseScaleFactor), 0, Math.PI * 2); // Slightly smaller to keep border inside
    zoomCtx.stroke();

  }, [zoomPoint, mode, rectangleBounds, windowBounds, isMobile, baseScaleFactor]);

  const getHandleAtPoint = (point: Point): typeof activeHandle => {
    const handleSize = (isMobile ? 60 : 36) * baseScaleFactor; // Use scaled handle size
    const halfHandle = handleSize / 2;

    if (mode === "simpleRect" && rectangleBounds) {
      const { x, y, width, height } = rectangleBounds;
      // Normalize x, y, width, height to always be positive for handle detection
      const normalizedX = Math.min(x, x + width);
      const normalizedY = Math.min(y, y + height);
      const normalizedWidth = Math.abs(width);
      const normalizedHeight = Math.abs(height);

      if (point.x >= normalizedX - halfHandle && point.x <= normalizedX + halfHandle && point.y >= normalizedY - halfHandle && point.y <= normalizedY + halfHandle) return "tl"
      if (point.x >= normalizedX + normalizedWidth - halfHandle && point.x <= normalizedX + normalizedWidth + halfHandle && point.y >= normalizedY - halfHandle && point.y <= normalizedY + halfHandle) return "tr"
      if (point.x >= normalizedX - halfHandle && point.x <= normalizedX + halfHandle && point.y >= normalizedY + normalizedHeight - halfHandle && point.y <= normalizedY + normalizedHeight + halfHandle) return "bl"
      if (point.x >= normalizedX + normalizedWidth - halfHandle && point.x <= normalizedX + normalizedWidth + halfHandle && point.y >= normalizedY + normalizedHeight - halfHandle && point.y <= normalizedY + normalizedHeight + halfHandle) return "br"
      if (point.x >= normalizedX + normalizedWidth / 2 - halfHandle && point.x <= normalizedX + normalizedWidth / 2 + halfHandle && point.y >= normalizedY - halfHandle && point.y <= normalizedY + halfHandle) return "n"
      if (point.x >= normalizedX + normalizedWidth / 2 - halfHandle && point.x <= normalizedX + normalizedWidth / 2 + halfHandle && point.y >= normalizedY + normalizedHeight - halfHandle && point.y <= normalizedY + normalizedHeight + halfHandle) return "s"
      if (point.x >= normalizedX - halfHandle && point.x <= normalizedX + halfHandle && point.y >= normalizedY + normalizedHeight / 2 - halfHandle && point.y <= normalizedY + normalizedHeight / 2 + halfHandle) return "w"
      if (point.x >= normalizedX + normalizedWidth - halfHandle && point.x <= normalizedX + normalizedWidth + halfHandle && point.y >= normalizedY + normalizedHeight / 2 - halfHandle && point.y <= normalizedY + normalizedHeight / 2 + halfHandle) return "e"
      if (point.x > normalizedX && point.x < normalizedX + normalizedWidth && point.y > normalizedY && point.y < normalizedY + normalizedHeight) return "move"
    } else if (mode === "adjustFraming" && windowBounds) {
      const { tl, tr, bl, br } = windowBounds
      if (Math.abs(point.x - tl.x) <= handleSize && Math.abs(point.y - tl.y) <= handleSize) return "tl"
      if (Math.abs(point.x - tr.x) <= handleSize && Math.abs(point.y - tr.y) <= handleSize) return "tr"
      if (Math.abs(point.x - bl.x) <= handleSize && Math.abs(point.y - bl.y) <= handleSize) return "bl"
      if (Math.abs(point.x - br.x) <= handleSize && Math.abs(point.y - br.y) <= handleSize) return "br"
      const path = new Path2D()
      path.moveTo(tl.x, tl.y)
      path.lineTo(tr.x, tr.y)
      path.lineTo(br.x, br.y)
      path.lineTo(bl.x, bl.y)
      path.closePath()
      const ctx = overlayCanvasRef.current?.getContext("2d")
      if (ctx && ctx.isPointInPath(path, point.x, point.y)) {
        return "move"
      }
    }
    return null
  }

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault() // Prevent default touch actions like scrolling
    const point = getCanvasPoint(e)
    setDragStartPos(point)

    const handle = getHandleAtPoint(point)
    if (handle) {
      setActiveHandle(handle)
      if (mode === "simpleRect") {
        setOriginalRectBounds({ ...rectangleBounds! })
      } else if (mode === "adjustFraming") {
        setOriginalWindowBounds({ ...windowBounds! })
      }

      // Start zooming if it's a handle or move on mobile
      if (isMobile) {
          setIsZooming(true);
          setZoomPoint(point);
      }
    } else {
      // If no handle was clicked, and a rectangle already exists, do nothing.
      // This prevents the existing selection from disappearing.
      if (rectangleBounds || windowBounds) {
        setActiveHandle(null); // Ensure no active handle if clicking outside
        setDragStartPos(null);
        setIsZooming(false);
        setZoomPoint(null);
        setZoomPosition(null);
        return; // Do not proceed to create a new rectangle
      }

      // If no handle was clicked AND no selection exists, then initialize a default rectangle.
      // This happens only when the component first loads or after a "Reset".
      const defaultWidth = canvasRef.current?.width * 0.6 || 0;
      const defaultHeight = canvasRef.current?.height * 0.6 || 0;
      const defaultX = (canvasRef.current?.width - defaultWidth) / 2 || 0;
      const defaultY = (canvasRef.current?.height - defaultHeight) / 2 || 0;
      setRectangleBounds({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
      setActiveHandle("move"); // Set to 'move' to allow dragging the default rectangle immediately
      if (isMobile) {
          setIsZooming(true);
          setZoomPoint(point);
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartPos || !activeHandle) return
    e.preventDefault() // Prevent default touch actions like scrolling

    const point = getCanvasPoint(e)
    const dx = point.x - dragStartPos.x
    const dy = point.y - dragStartPos.y

    if (mode === "simpleRect" && originalRectBounds) {
      let newRect = { ...originalRectBounds }
      if (activeHandle === "move") {
        newRect.x = originalRectBounds.x + dx
        newRect.y = originalRectBounds.y + dy
      } else {
        const currentX = originalRectBounds.x
        const currentY = originalRectBounds.y
        const currentWidth = originalRectBounds.width
        const currentHeight = originalRectBounds.height
        switch (activeHandle) {
          case "tl":
            newRect.x = currentX + dx
            newRect.y = currentY + dy
            newRect.width = currentWidth - dx
            newRect.height = currentHeight - dy
            break
          case "tr":
            newRect.y = currentY + dy
            newRect.width = currentWidth + dx
            newRect.height = currentHeight - dy
            break
          case "bl":
            newRect.x = currentX + dx
            newRect.width = currentWidth - dx
            newRect.height = currentHeight + dy
            break
          case "br":
            newRect.width = currentWidth + dx
            newRect.height = currentHeight + dy
            break
          case "n":
            newRect.y = currentY + dy
            newRect.height = currentHeight - dy
            break
          case "s":
            newRect.height = currentHeight + dy
            break
          case "e":
            newRect.width = currentWidth + dx
            break
          case "w":
            newRect.x = currentX + dx
            newRect.width = currentWidth - dx
            break
        }
      }
      setRectangleBounds(newRect)
    } else if (mode === "adjustFraming" && originalWindowBounds) {
      let newBounds = { ...originalWindowBounds }
      if (activeHandle === "move") {
        newBounds = {
          tl: { x: originalWindowBounds.tl.x + dx, y: originalWindowBounds.tl.y + dy },
          tr: { x: originalWindowBounds.tr.x + dx, y: originalWindowBounds.tr.y + dy },
          bl: { x: originalWindowBounds.bl.x + dx, y: originalWindowBounds.bl.y + dy },
          br: { x: originalWindowBounds.br.x + dx, y: originalWindowBounds.br.y + dy },
        }
      } else {
        newBounds[activeHandle as "tl" | "tr" | "bl" | "br"] = { x: originalWindowBounds[activeHandle as "tl" | "tr" | "bl" | "br"].x + dx, y: originalWindowBounds[activeHandle as "tl" | "tr" | "bl" | "br"].y + dy }
      }
      setWindowBounds(newBounds)
    }

    if (isZooming) {
        setZoomPoint(point);
    }
  }

  const handlePointerUp = () => {
    setActiveHandle(null)
    setDragStartPos(null)
    setOriginalRectBounds(null)
    setOriginalWindowBounds(null)
    setIsZooming(false); // Stop zooming
    setZoomPoint(null);
    setZoomPosition(null);
  }

  useImperativeHandle(ref, () => ({
    resetSelection: () => {
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const defaultWidth = canvas.width * 0.6
        const defaultHeight = canvas.height * 0.6
        const defaultX = (canvas.width - defaultWidth) / 2
        const defaultY = (canvas.height - defaultHeight) / 2
        setRectangleBounds({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight })
      }
      setWindowBounds(null)
      setMode("simpleRect")
      setError(null)
    },
    toggleFramingMode: () => {
      if (mode === "simpleRect") {
        if (rectangleBounds) {
          // Normalize rectangle bounds before converting to window bounds
          const normalizedX = Math.min(rectangleBounds.x, rectangleBounds.x + rectangleBounds.width);
          const normalizedY = Math.min(rectangleBounds.y, rectangleBounds.y + rectangleBounds.height);
          const normalizedWidth = Math.abs(rectangleBounds.width);
          const normalizedHeight = Math.abs(rectangleBounds.height);

          setWindowBounds({
            tl: { x: normalizedX, y: normalizedY },
            tr: { x: normalizedX + normalizedWidth, y: normalizedY },
            bl: { x: normalizedX, y: normalizedY + normalizedHeight },
            br: { x: normalizedX + normalizedWidth, y: normalizedY + normalizedHeight },
          })
          setMode("adjustFraming")
        }
      }
    },
    getBounds: () => {
      if (mode === "simpleRect" && rectangleBounds) {
        // Normalize rectangle bounds before returning
        const normalizedX = Math.min(rectangleBounds.x, rectangleBounds.x + rectangleBounds.width);
        const normalizedY = Math.min(rectangleBounds.y, rectangleBounds.y + rectangleBounds.height);
        const normalizedWidth = Math.abs(rectangleBounds.width);
        const normalizedHeight = Math.abs(rectangleBounds.height);

        return {
          tl: { x: normalizedX, y: normalizedY },
          tr: { x: normalizedX + normalizedWidth, y: normalizedY },
          bl: { x: normalizedX, y: normalizedY + normalizedHeight },
          br: { x: normalizedX + normalizedWidth, y: normalizedY + normalizedHeight },
        }
      } else if (mode === "adjustFraming" && windowBounds) {
        return windowBounds
      }
      return null
    },
  }))

  return (
    <div className="flex flex-col items-center">
      <p className="text-base text-gray-700 text-center mb-4">
        Drag the handles to adjust the rectangle, or click and drag to draw a new one.
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4 max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="w-full mb-4">
        <div className="border rounded-lg overflow-hidden">
          <div className="relative">
            <img
              ref={imageRef}
              src={imageData || "/placeholder.svg"}
              alt="Window"
              className="w-full h-auto"
              onLoad={initializeCanvas}
              style={{ display: "none" }}
            />
            <canvas ref={canvasRef} className="w-full h-auto" style={{ display: "block" }}></canvas>
            <canvas
              ref={overlayCanvasRef}
              className="absolute top-0 left-0 w-full h-auto"
              style={{ display: "block", touchAction: 'none' }} // Add touch-action: none
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            ></canvas>
            {/* Hidden offscreen canvas */}
            <canvas ref={offscreenCanvasRef} style={{ display: 'none' }} />
            {/* Zoom canvas */}
            <canvas
                ref={zoomCanvasRef}
                width={ZOOM_RADIUS * 2} // Diameter
                height={ZOOM_RADIUS * 2} // Diameter
                className="absolute z-20 rounded-full shadow-lg border-2 border-indigo-600"
                style={{
                    display: isZooming && zoomPosition ? 'block' : 'none',
                    left: zoomPosition?.left || '0px',
                    top: zoomPosition?.top || '0px',
                    pointerEvents: 'none',
                }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 w-full justify-center">
        <Button variant="outline" onClick={() => ref.current?.resetSelection()} className="flex-1 sm:flex-none">
          <X className="mr-2 h-4 w-4" />
          Reset
        </Button>
        <Button variant="outline" onClick={() => ref.current?.toggleFramingMode()} disabled={mode === 'adjustFraming'} className="flex-1 sm:flex-none">
          <Move className="mr-2 h-5 w-5" />
          Adjust Framing
        </Button>
      </div>
    </div>
  )
})

WindowDetection.displayName = "WindowDetection"