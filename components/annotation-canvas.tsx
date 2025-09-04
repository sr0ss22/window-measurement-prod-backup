"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Upload, ImageIcon, Edit3, Trash2, Save, Square, Circle, ArrowRight, Type, Ruler, Undo, Redo, MousePointer } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { useMobile } from "@/hooks/use-mobile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate } from "@/utils/date-formatter"
import type { WizardMeasurements, WindowBounds, Point } from "@/types/window-item"
import { formatMeasurement } from "@/utils/measurements"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
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

// --- Annotation Types ---
type AnnotationTool = "select" | "brush" | "rectangle" | "circle" | "arrow" | "text";

type BrushAnnotation = { id: string; type: 'brush'; points: Point[]; color: string; radius: number; };
type RectangleAnnotation = { id: string; type: 'rectangle'; x: number; y: number; width: number; height: number; color: string; };
type CircleAnnotation = { id: string; type: 'circle'; cx: number; cy: number; radius: number; color: string; };
type ArrowAnnotation = { id: string; type: 'arrow'; x1: number; y1: number; x2: number; y2: number; color: string; };
type TextAnnotation = { id: string; type: 'text'; x: number; y: number; text: string; color: string; fontSize: number; };

type Annotation = BrushAnnotation | RectangleAnnotation | CircleAnnotation | ArrowAnnotation | TextAnnotation;

// --- Component Props ---
interface AnnotationCanvasProps {
  imageData: string | null
  annotationData: string | null
  onImageUpdate: (imageData: string | null, metadata?: { uploadedAt: string; modifiedAt: string; uploadedBy: string }) => void
  onAnnotationUpdate: (annotationData: string | null) => void
  imageMetadata?: { uploadedAt: string; modifiedAt: string; uploadedBy: string; }
  wizardImage?: string | null
  wizardMeasurements?: WizardMeasurements | null
  wizardWindowBounds?: WindowBounds | null
  onOpenMeasureWizard?: () => void
  location?: string;
  windowNumber?: string;
  product?: string;
  controlType?: string;
}

const colorOptions = [
  { name: "Red", value: "#ef4444" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
];

// --- Helper Functions ---
const parseAnnotationData = (data: string | null): Annotation[] => {
  if (!data) return [];
  try {
    let jsonString = data;
    if (data.startsWith('data:application/json;base64,')) {
      const base64String = data.split(',')[1];
      jsonString = atob(base64String);
    }
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse annotation data:", e);
    return [];
  }
};

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

const HANDLE_RADIUS = 6;
type HandleName = 'tl' | 'tr' | 'bl' | 'br' | 'n' | 's' | 'e' | 'w' | 'start' | 'end' | 'move';

export function AnnotationCanvas({
  imageData,
  annotationData,
  onImageUpdate,
  onAnnotationUpdate,
  imageMetadata,
  wizardImage,
  wizardMeasurements,
  wizardWindowBounds,
  onOpenMeasureWizard,
  location,
  windowNumber,
  product,
  controlType,
}: AnnotationCanvasProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [activeTool, setActiveTool] = useState<AnnotationTool>("brush");
  const [toolColor, setToolColor] = useState(colorOptions[0].value);
  const [lineThickness, setLineThickness] = useState(5); // Renamed from brushRadius
  const [fontSize, setFontSize] = useState(24);
  const [textInputValue, setTextInputValue] = useState("Your Text");
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [action, setAction] = useState<"none" | "drawing" | "moving" | "resizing">("none");
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [originalAnnotation, setOriginalAnnotation] = useState<Annotation | null>(null);
  const [resizeHandle, setResizeHandle] = useState<HandleName | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // New state for live brush drawing
  const [liveBrushPoints, setLiveBrushPoints] = useState<Point[]>([]);
  const liveBrushId = useRef<string | null>(null); // To track the ID of the brush being drawn live

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [baseScaleFactor, setBaseScaleFactor] = useState(1); // New state for base scale factor

  const displayImage = imageData || wizardImage;

  useEffect(() => {
    setIsMounted(true);
    const savedAnnotations = parseAnnotationData(annotationData);
    setAnnotations(savedAnnotations);
    setHistory([savedAnnotations]);
    setHistoryIndex(0);
  }, [annotationData]);

  const updateAnnotations = (newAnnotations: Annotation[], saveToHistory = true) => {
    setAnnotations(newAnnotations);
    if (saveToHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newAnnotations);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setAnnotations(history[newIndex]);
    }
  };

  const getBoundingBox = (annotation: Annotation): { x: number; y: number; width: number; height: number } => {
    switch (annotation.type) {
        case 'rectangle':
            return {
                x: Math.min(annotation.x, annotation.x + annotation.width),
                y: Math.min(annotation.y, annotation.y + annotation.height),
                width: Math.abs(annotation.width),
                height: Math.abs(annotation.height),
            };
        case 'circle':
            return {
                x: annotation.cx - annotation.radius,
                y: annotation.cy - annotation.radius,
                width: annotation.radius * 2,
                height: annotation.radius * 2,
            };
        case 'arrow':
            return {
                x: Math.min(annotation.x1, annotation.x2),
                y: Math.min(annotation.y1, annotation.y2),
                width: Math.abs(annotation.x1 - annotation.x2),
                height: Math.abs(annotation.y1 - annotation.y2),
            };
        case 'text':
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.font = `${annotation.fontSize * baseScaleFactor}px Arial`; // Use scaled font size for measurement
                    const metrics = ctx.measureText(annotation.text);
                    return { x: annotation.x, y: annotation.y - metrics.actualBoundingBoxAscent, width: metrics.width, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent };
                }
            }
            return { x: annotation.x, y: annotation.y, width: annotation.text.length * (annotation.fontSize * 0.6), height: annotation.fontSize };
        case 'brush':
            if (annotation.points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
            let minX = annotation.points[0].x;
            let maxX = annotation.points[0].x;
            let minY = annotation.points[0].y;
            let maxY = annotation.points[0].y;
            annotation.points.forEach(p => {
                minX = Math.min(minX, p.x);
                maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y);
                maxY = Math.max(maxY, p.y);
            });
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  };

  const getHandlesForAnnotation = (ann: Annotation): Partial<Record<HandleName, Point>> => {
    const handles: Partial<Record<HandleName, Point>> = {};
    const bbox = getBoundingBox(ann);
    const { x, y, width, height } = bbox;
    const cx = x + width / 2;
    const cy = y + height / 2;

    handles['move'] = { x: cx, y: cy };

    switch (ann.type) {
        case 'rectangle':
        case 'text':
            handles['tl'] = { x, y };
            handles['tr'] = { x: x + width, y };
            handles['bl'] = { x, y: y + height };
            handles['br'] = { x: x + width, y: y + height };
            break;
        case 'circle':
            const r = ann.radius;
            handles['n'] = { x: ann.cx, y: ann.cy - r };
            handles['s'] = { x: ann.cx, y: ann.cy + r };
            handles['e'] = { x: ann.cx + r, y: ann.cy };
            handles['w'] = { x: ann.cx - r, y: ann.cy };
            break;
        case 'arrow':
            handles['start'] = { x: ann.x1, y: ann.y1 };
            handles['end'] = { x: ann.x2, y: ann.y2 };
            break;
        case 'brush':
            break;
    }
    return handles;
  };

  // Function to draw a single annotation (used for both saved and live drawing)
  const drawSingleAnnotation = (ctx: CanvasRenderingContext2D, ann: Annotation, isSelected: boolean, currentLineThickness: number) => {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.type === 'brush' ? ann.radius * 2 : currentLineThickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (ann.type) {
      case 'brush':
        ctx.lineWidth = ann.radius * 2;
        ctx.beginPath();
        ann.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.stroke();
        break;
      case 'rectangle':
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(ann.cx, ann.cy, ann.radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(ann.x1, ann.y1);
        ctx.lineTo(ann.x2, ann.y2);
        ctx.stroke();
        const headlen = 15 * baseScaleFactor; // Scaled headlen
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        ctx.beginPath();
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - headlen * Math.cos(angle - Math.PI / 6), ann.y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - headlen * Math.cos(angle + Math.PI / 6), ann.y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `${ann.fontSize * baseScaleFactor}px Arial`; // Scaled font size
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ann.text, ann.x, ann.y);
        break;
    }

    if (isSelected) {
      const handles = getHandlesForAnnotation(ann);
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1 * baseScaleFactor; // Scaled line width
      Object.entries(handles).forEach(([name, point]) => {
          if (!point) return;
          const radius = name === 'move' ? (HANDLE_RADIUS + 2) * baseScaleFactor : HANDLE_RADIUS * baseScaleFactor; // Scaled radius
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
          ctx.fill();
          ctx.stroke();
      });
    }
  };

  // Main draw function for all static content (image + saved annotations)
  const drawAllContent = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const image = imageRef.current;
    if (!canvas || !ctx || !image) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    annotations.forEach(ann => {
      drawSingleAnnotation(ctx, ann, ann.id === selectedAnnotationId, lineThickness * baseScaleFactor); // Pass scaled line thickness
    });

    if (wizardWindowBounds && wizardMeasurements) {
        ctx.save();
        const { tl, tr, bl, br } = wizardWindowBounds;

        const lerp = (p1: Point, p2: Point, t: number): Point => ({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
        });

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

        const textHeight = 20 * baseScaleFactor; // Scaled
        const textPadding = 5 * baseScaleFactor; // Scaled
        const roundedRectRadius = 8 * baseScaleFactor; // Scaled

        ctx.lineWidth = 2 * baseScaleFactor; // Scaled
        ctx.font = `bold ${20 * baseScaleFactor}px Arial`; // Scaled

        ctx.setLineDash([5 * baseScaleFactor, 5 * baseScaleFactor]); // Scaled
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)"; // Transparent blue
        Object.values(widthLines).forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.start.x, line.start.y);
            ctx.lineTo(line.end.x, line.end.y);
            ctx.stroke();
        });
        ctx.strokeStyle = "rgba(34, 197, 94, 0.6)"; // Transparent green
        Object.values(heightLines).forEach(line => {
            ctx.beginPath();
            ctx.moveTo(line.start.x, line.start.y);
            ctx.lineTo(line.end.x, line.end.y);
            ctx.stroke();
        });
        ctx.setLineDash([]);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        Object.entries(wizardMeasurements.widths).forEach(([key, value]) => {
            if (value > 0) {
                const line = widthLines[key as keyof typeof widthLines];
                const midPoint = lerp(line.start, line.end, 0.5);
                const text = formatMeasurement(value) + '"';
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                ctx.fillStyle = "rgba(59, 130, 246, 0.7)";
                drawRoundedRect(ctx, midPoint.x - textWidth / 2 - textPadding, midPoint.y - textHeight / 2 - 2, textWidth + (textPadding * 2), textHeight + 4, roundedRectRadius);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(text, midPoint.x, midPoint.y);
            }
        });
        
        const yPosM = lerp(widthLines.M.start, widthLines.M.end, 0.5).y;
        const yPosB = lerp(widthLines.B.start, widthLines.B.end, 0.5).y;
        const heightTextY = (yPosM + yPosB) / 2;

        Object.entries(wizardMeasurements.heights).forEach(([key, value]) => {
            if (value > 0) {
                const line = heightLines[key as keyof typeof heightLines];
                const midPoint = lerp(line.start, line.end, 0.5);
                const text = formatMeasurement(value) + '"';
                const textMetrics = ctx.measureText(text);
                const textWidth = textMetrics.width;
                
                const textX = midPoint.x;
                const textY = heightTextY;

                ctx.fillStyle = "rgba(34, 197, 94, 0.7)";
                drawRoundedRect(ctx, textX - textWidth / 2 - textPadding, textY - textHeight / 2 - 2, textWidth + (textPadding * 2), textHeight + 4, roundedRectRadius);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(text, textX, textY);
            }
        });

        ctx.fillStyle = "#3b82f6";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        Object.entries(widthLines).forEach(([key, line]) => {
            ctx.fillText(key, line.start.x - (10 * baseScaleFactor), line.start.y); // Scaled padding
        });

        ctx.fillStyle = "#22c55e";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        Object.entries(heightLines).forEach(([key, line]) => {
            ctx.fillText(key, line.start.x, line.start.y - (10 * baseScaleFactor)); // Scaled padding
        });

        ctx.restore();
    }

    // Draw info text in the upper right corner
    const infoLines: string[] = [];
    if (location || windowNumber) {
        infoLines.push(`${location || ''} ${windowNumber || ''}`.trim());
    }
    const productInfo = [product, controlType].filter(Boolean).join(' / ');
    if (productInfo) {
        infoLines.push(productInfo);
    }

    if (infoLines.length > 0) {
        ctx.save();
        ctx.font = `bold ${24 * baseScaleFactor}px Arial`; // Scaled font size
        ctx.textAlign = "right";
        ctx.textBaseline = "top";
        const textX = canvas.width - (15 * baseScaleFactor); // Scaled padding
        let textY = (15 * baseScaleFactor); // Scaled padding
        
        const allTextMetrics = infoLines.map(line => ctx.measureText(line));
        const maxWidth = Math.max(...allTextMetrics.map(m => m.width));
        const totalHeight = infoLines.length * (30 * baseScaleFactor) + (infoLines.length > 1 ? (5 * baseScaleFactor) : 0); // Scaled line height and gap

        // Add a semi-transparent background for readability
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        drawRoundedRect(ctx, textX - maxWidth - (10 * baseScaleFactor), textY - (5 * baseScaleFactor), maxWidth + (20 * baseScaleFactor), totalHeight + (5 * baseScaleFactor), (5 * baseScaleFactor)); // Scaled rect
        ctx.fillStyle = "white";
        infoLines.forEach(line => {
            ctx.fillText(line, textX, textY);
            textY += (30 * baseScaleFactor); // Scaled line height
        });
        ctx.restore();
    }
  }, [annotations, selectedAnnotationId, wizardWindowBounds, wizardMeasurements, location, windowNumber, product, controlType, lineThickness, baseScaleFactor]);

  useEffect(() => {
    if (!isMounted || !displayImage) return;
    const image = new Image();
    image.src = displayImage;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      imageRef.current = image;
      const canvas = canvasRef.current;
      if (canvas && containerRef.current) {
        const containerWidth = containerRef.current.clientWidth;
        const scale = containerWidth / image.naturalWidth;
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${image.naturalHeight * scale}px`;
        
        const referenceWidth = 1000; // Example reference width
        setBaseScaleFactor(image.naturalWidth / referenceWidth); // Set base scale factor
        
        drawAllContent();
      }
    };
  }, [isMounted, displayImage, drawAllContent]);

  // Redraw all content when annotations or selectedAnnotationId changes
  useEffect(() => {
    drawAllContent();
  }, [drawAllContent]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const getHandleAtPoint = (point: Point, handles: Partial<Record<HandleName, Point>>): HandleName | null => {
    for (const name in handles) {
        const handlePoint = handles[name as HandleName];
        if (handlePoint) {
            const dist = Math.sqrt(Math.pow(point.x - handlePoint.x, 2) + Math.pow(point.y - handlePoint.y, 2));
            if (dist <= (HANDLE_RADIUS + 2) * baseScaleFactor) { // Scaled handle detection radius
                return name as HandleName;
            }
        }
    }
    return null;
  };

  const getAnnotationAtPoint = (point: Point, annotations: Annotation[]): Annotation | null => {
    for (const ann of [...annotations].reverse()) {
        const bbox = getBoundingBox(ann);
        const bufferedBbox = { x: bbox.x - (5 * baseScaleFactor), y: bbox.y - (5 * baseScaleFactor), width: bbox.width + (10 * baseScaleFactor), height: bbox.height + (10 * baseScaleFactor) }; // Scaled buffer
        if (point.x >= bufferedBbox.x && point.x <= bufferedBbox.x + bufferedBbox.width && point.y >= bufferedBbox.y && point.y <= bufferedBbox.y + bufferedBbox.height) {
            return ann;
        }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isAnnotating) return;
    const point = getCanvasPoint(e);
    setStartPoint(point);

    if (activeTool === 'select') {
        if (selectedAnnotationId) {
            const selectedAnn = annotations.find(a => a.id === selectedAnnotationId);
            if (selectedAnn) {
                const handles = getHandlesForAnnotation(selectedAnn);
                const clickedHandle = getHandleAtPoint(point, handles);
                if (clickedHandle) {
                    setOriginalAnnotation({ ...selectedAnn });
                    if (clickedHandle === 'move') {
                        setAction('moving');
                    } else {
                        setAction('resizing');
                        setResizeHandle(clickedHandle);
                    }
                    return;
                }
            }
        }

        const clickedAnnotation = getAnnotationAtPoint(point, annotations);
        if (clickedAnnotation) {
            setSelectedAnnotationId(clickedAnnotation.id);
            setAction('moving');
            setOriginalAnnotation({ ...clickedAnnotation });
        } else {
            setSelectedAnnotationId(null);
            setAction('none');
        }
    } else {
        setAction("drawing");
        setSelectedAnnotationId(null);
        let newId = `ann-${Date.now()}`;
        let newAnnotation: Annotation | null = null;

        switch (activeTool) {
          case 'brush':
            newAnnotation = { id: newId, type: 'brush', points: [point], color: toolColor, radius: lineThickness };
            setLiveBrushPoints([point]); // Start live drawing
            liveBrushId.current = newId; // Store ID for live brush
            break;
          case 'rectangle':
            newAnnotation = { id: newId, type: 'rectangle', x: point.x, y: point.y, width: 0, height: 0, color: toolColor };
            break;
          case 'circle':
            newAnnotation = { id: newId, type: 'circle', cx: point.x, cy: point.y, radius: 0, color: toolColor };
            break;
          case 'arrow':
            newAnnotation = { id: newId, type: 'arrow', x1: point.x, y1: point.y, x2: point.x, y2: point.y, color: toolColor };
            break;
          case 'text':
            if (textInputValue.trim()) {
              newAnnotation = { id: newId, type: 'text', x: point.x, y: point.y, text: textInputValue, color: toolColor, fontSize };
            }
            break;
        }

        if (newAnnotation && activeTool !== 'brush') { // Only add to annotations for non-brush tools on pointerDown
          updateAnnotations([...annotations, newAnnotation]);
          setSelectedAnnotationId(newId);
        } else if (newAnnotation && activeTool === 'brush') {
          // For brush, we don't add to annotations until pointerUp
          // The liveBrushPoints state will handle the drawing
        }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (action === 'none' || !startPoint) return;
    const point = getCanvasPoint(e);
    const dx = point.x - startPoint.x;
    const dy = point.y - startPoint.y;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    if (action === 'drawing') {
      if (activeTool === 'brush') {
        if (liveBrushPoints.length === 0) return; // Should not happen if pointerDown worked

        const lastPoint = liveBrushPoints[liveBrushPoints.length - 1];
        const distance = Math.sqrt(Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2));
        const segmentLength = 3 * baseScaleFactor; // Scaled segment length for smoother lines

        ctx.strokeStyle = toolColor;
        ctx.lineWidth = lineThickness * 2 * baseScaleFactor; // Brush uses its own radius for thickness, scaled
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (distance > segmentLength) {
          const newPoints: Point[] = [...liveBrushPoints];
          const numSegments = Math.ceil(distance / segmentLength);
          for (let i = 1; i <= numSegments; i++) {
            const t = i / numSegments;
            const interpolatedX = lastPoint.x + (point.x - lastPoint.x) * t;
            const interpolatedY = lastPoint.y + (point.y - lastPoint.y) * t;
            
            ctx.beginPath();
            ctx.moveTo(newPoints[newPoints.length - 1].x, newPoints[newPoints.length - 1].y);
            ctx.lineTo(interpolatedX, interpolatedY);
            ctx.stroke();
            newPoints.push({ x: interpolatedX, y: interpolatedY });
          }
          setLiveBrushPoints(newPoints);
        } else {
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(point.x, point.y);
          ctx.stroke();
          setLiveBrushPoints(prev => [...prev, point]);
        }
      } else { // For other drawing tools (rectangle, circle, arrow)
        // Clear and redraw all static content to show dynamic resizing
        drawAllContent(); 
        const currentAnnotation = annotations.find(a => a.id === selectedAnnotationId);
        if (!currentAnnotation) return;

        ctx.strokeStyle = toolColor;
        ctx.fillStyle = toolColor;
        ctx.lineWidth = lineThickness * baseScaleFactor; // Scaled line thickness
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw the current in-progress shape
        switch (currentAnnotation.type) {
          case 'rectangle':
            ctx.strokeRect(startPoint.x, startPoint.y, dx, dy);
            break;
          case 'circle':
            const radius = Math.sqrt(dx * dx + dy * dy);
            ctx.beginPath();
            ctx.arc(startPoint.x, startPoint.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            break;
          case 'arrow':
            ctx.beginPath();
            ctx.moveTo(startPoint.x, startPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            const headlen = 15 * baseScaleFactor; // Scaled headlen
            const angle = Math.atan2(dy, dx);
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(point.x - headlen * Math.cos(angle - Math.PI / 6), point.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(point.x - headlen * Math.cos(angle + Math.PI / 6), point.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
            break;
        }
      }
    } else if (action === 'moving' && originalAnnotation) {
        const movedAnnotation = { ...originalAnnotation };
        if (movedAnnotation.type === 'brush') {
            movedAnnotation.points = originalAnnotation.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        } else if (movedAnnotation.type === 'rectangle' || movedAnnotation.type === 'text') {
            movedAnnotation.x = originalAnnotation.x + dx;
            movedAnnotation.y = originalAnnotation.y + dy;
        } else if (movedAnnotation.type === 'circle') {
            movedAnnotation.cx = originalAnnotation.cx + dx;
            movedAnnotation.cy = originalAnnotation.cy + dy;
        } else if (movedAnnotation.type === 'arrow') {
            movedAnnotation.x1 = originalAnnotation.x1 + dx;
            movedAnnotation.y1 = originalAnnotation.y1 + dy;
            movedAnnotation.x2 = originalAnnotation.x2 + dx;
            movedAnnotation.y2 = originalAnnotation.y2 + dy;
        }
        updateAnnotations(annotations.map(a => a.id === movedAnnotation.id ? movedAnnotation : a), false);
    } else if (action === 'resizing' && originalAnnotation && resizeHandle) {
        let resizedAnn = { ...originalAnnotation };
        
        if (resizedAnn.type === 'rectangle' || resizedAnn.type === 'text') {
            const { x, y, width, height } = getBoundingBox(originalAnnotation);
            let newX = x, newY = y, newW = width, newH = height;

            if (resizeHandle.includes('l')) { newX = point.x; newW = (x + width) - point.x; }
            if (resizeHandle.includes('r')) { newW = point.x - x; }
            if (resizeHandle.includes('t')) { newY = point.y; newH = (y + height) - point.y; }
            if (resizeHandle.includes('b')) { newH = point.y - y; }
            
            resizedAnn.x = newX;
            resizedAnn.y = newY;
            resizedAnn.width = newW;
            resizedAnn.height = newH;
        } else if (resizedAnn.type === 'arrow') {
            if (resizeHandle === 'start') {
                resizedAnn.x1 = point.x;
                resizedAnn.y1 = point.y;
            } else if (resizeHandle === 'end') {
                resizedAnn.x2 = point.x;
                resizedAnn.y2 = point.y;
            }
        } else if (resizedAnn.type === 'circle') {
            const dx = point.x - resizedAnn.cx;
            const dy = point.y - resizedAnn.cy;
            resizedAnn.radius = Math.sqrt(dx*dx + dy*dy);
        }
        updateAnnotations(annotations.map(a => a.id === resizedAnn.id ? resizedAnn : a), false);
    }
  };

  const handlePointerUp = () => {
    if (action === 'drawing' && activeTool === 'brush' && liveBrushPoints.length > 0) {
      const newBrushAnnotation: BrushAnnotation = {
        id: liveBrushId.current || `ann-${Date.now()}`,
        type: 'brush',
        points: liveBrushPoints,
        color: toolColor,
        radius: lineThickness,
      };
      updateAnnotations([...annotations, newBrushAnnotation]);
      setSelectedAnnotationId(newBrushAnnotation.id);
      setLiveBrushPoints([]);
      liveBrushId.current = null;
    } else if (action === 'drawing' && selectedAnnotationId) { // For other shapes
      const currentAnnotation = annotations.find(a => a.id === selectedAnnotationId);
      if (currentAnnotation) {
        const finalAnnotations = annotations.map(a => a.id === selectedAnnotationId ? {
          ...currentAnnotation,
          // Ensure final dimensions are positive for rectangle
          ...(currentAnnotation.type === 'rectangle' && {
            x: Math.min(currentAnnotation.x, startPoint!.x + (currentAnnotation.width)),
            y: Math.min(currentAnnotation.y, startPoint!.y + (currentAnnotation.height)),
            width: Math.abs(currentAnnotation.width),
            height: Math.abs(currentAnnotation.height),
          })
        } : a);
        updateAnnotations(finalAnnotations);
      }
    } else if (action !== 'none') { // For moving/resizing existing annotations
      const finalAnnotations = [...annotations];
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(finalAnnotations);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
    setAction("none");
    setStartPoint(null);
    setOriginalAnnotation(null);
    setResizeHandle(null);
    drawAllContent(); // Ensure everything is redrawn correctly after action
  };

  const handleImageUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const imageData = reader.result as string;
        const now = new Date().toISOString();
        onImageUpdate(imageData, { uploadedAt: now, modifiedAt: now, uploadedBy: "Field Installer" });
        setIsUploading(false);
        updateAnnotations([]);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleSaveAnnotations = () => {
    onAnnotationUpdate(JSON.stringify(annotations));
    setIsAnnotating(false);
    setSelectedAnnotationId(null);
  };

  const handleCancelAnnotations = () => {
    const savedAnnotations = parseAnnotationData(annotationData);
    setAnnotations(savedAnnotations);
    setHistory([savedAnnotations]);
    setHistoryIndex(0);
    setIsAnnotating(false);
    setSelectedAnnotationId(null);
  };

  const handleDeleteSelected = () => {
    if (selectedAnnotationId) {
      updateAnnotations(annotations.filter(a => a.id !== selectedAnnotationId));
      setSelectedAnnotationId(null);
    }
  };

  const handleClearAll = () => {
    updateAnnotations([]);
    setIsClearConfirmOpen(false);
  };

  const renderToolbar = () => (
    <div className="p-2 border rounded-md bg-gray-50 space-y-4">
      <div className="flex flex-wrap gap-1 items-center">
        <Button variant={activeTool === 'select' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('select')}><MousePointer /></Button>
        <Button variant={activeTool === 'brush' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('brush')}><Edit3 /></Button>
        <Button variant={activeTool === 'rectangle' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('rectangle')}><Square /></Button>
        <Button variant={activeTool === 'circle' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('circle')}><Circle /></Button>
        <Button variant={activeTool === 'arrow' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('arrow')}><ArrowRight /></Button>
        <Button variant={activeTool === 'text' ? 'secondary' : 'ghost'} size="icon" onClick={() => setActiveTool('text')}><Type /></Button>
        {activeTool === 'text' && (
          <Input
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            placeholder="Enter text..."
            className="w-48 h-9 ml-2"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        {colorOptions.map(color => (
          <Button key={color.value} style={{ backgroundColor: color.value }} className={cn("w-8 h-8 rounded-full border-2", toolColor === color.value ? 'border-black' : 'border-transparent')} onClick={() => setToolColor(color.value)} />
        ))}
      </div>
      {(activeTool === 'brush' || activeTool === 'rectangle' || activeTool === 'circle' || activeTool === 'arrow') && (
        <div className="flex items-center gap-2">
          <Label>Line Thickness</Label>
          <Slider value={[lineThickness]} onValueChange={(val) => setLineThickness(val[0])} min={1} max={50} step={1} className="w-32" />
        </div>
      )}
      {activeTool === 'text' && (
        <div className="flex items-center gap-2">
          <Label>Font Size</Label>
          <Slider value={[fontSize]} onValueChange={(val) => setFontSize(val[0])} min={12} max={72} step={1} className="w-32" />
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <Button variant="outline" size="sm" onClick={handleUndo} disabled={historyIndex === 0}><Undo className="mr-2 h-4 w-4" />Undo</Button>
        <Button variant="outline" size="sm" onClick={handleRedo} disabled={historyIndex === history.length - 1}><Redo className="mr-2 h-4 w-4" />Redo</Button>
        {selectedAnnotationId && activeTool === 'select' && <Button variant="destructive" size="sm" onClick={handleDeleteSelected}><Trash2 className="mr-2 h-4 w-4" />Delete Selected</Button>}
        <Button variant="destructive" size="sm" onClick={() => setIsClearConfirmOpen(true)} disabled={annotations.length === 0}><Trash2 className="mr-2 h-4 w-4" />Clear All</Button>
      </div>
    </div>
  );

  return (
    <div className="border rounded-lg p-4" ref={containerRef}>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h3 className="text-lg font-medium text-gray-700 mb-2 sm:mb-0">Window Image & Annotations</h3>
        {displayImage && !isAnnotating && (
          <Button variant="outline" onClick={() => setIsAnnotating(true)}>
            <Edit3 className="mr-2 h-4 w-4" /> Edit Annotations
          </Button>
        )}
      </div>

      {displayImage ? (
        <div className="space-y-4">
          {isAnnotating && renderToolbar()}
          {isMounted && (
            <div 
              className="relative w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <canvas ref={canvasRef} className={cn(isAnnotating && activeTool === 'select' ? 'cursor-default' : 'cursor-crosshair')} />
            </div>
          )}
          {isAnnotating && (
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelAnnotations}>Cancel</Button>
              <Button onClick={handleSaveAnnotations}><Save className="mr-2 h-4 w-4" />Save Annotations</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center justify-center bg-gray-50">
          <ImageIcon className="h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No Image Uploaded</h3>
          <Button onClick={handleImageUpload}><Upload className="mr-2 h-4 w-4" />Upload Image</Button>
        </div>
      )}
      <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Annotations?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all annotations from this image. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="bg-red-500 hover:bg-red-600">Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}