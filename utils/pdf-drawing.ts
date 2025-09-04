import type { Annotation, WindowItem, Point } from "@/types/window-item";
import { formatMeasurement } from "./measurements";
import { toast } from "@/components/ui/use-toast"; // Import toast

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

export async function generateAnnotatedImage(windowItem: WindowItem): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error("Canvas 2D context not available for PDF image generation.");
    return '';
  }

  const displayImage = windowItem.image || windowItem.wizardImage;
  if (!displayImage) {
    console.warn(`No image data available for PDF generation for window ${windowItem.lineNumber}.`);
    return '';
  }

  const image = new Image();
  // Only set crossOrigin if the image source is a network URL (not a data URL)
  if (displayImage.startsWith('http://') || displayImage.startsWith('https://')) {
    image.crossOrigin = "anonymous";
  }
  const imagePromise = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = (e) => {
      console.error(`Error loading image for PDF generation for window ${windowItem.lineNumber}:`, e);
      reject(new Error("Image loading failed for PDF."));
    };
  });
  image.src = displayImage;

  try {
    await imagePromise;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  } catch (error) {
    console.error(`Failed to load or draw image to canvas for PDF for window ${windowItem.lineNumber}:`, error);
    return ''; // Return empty string if image loading/drawing fails
  }

  const baseReferenceWidth = 1000; // Reference width for scaling
  const scaleFactor = image.naturalWidth / baseReferenceWidth;

  const annotations = parseAnnotationData(windowItem.annotations);

  annotations.forEach(ann => {
    ctx.strokeStyle = ann.color;
    ctx.fillStyle = ann.color;
    ctx.lineWidth = ann.type === 'brush' ? ann.radius * 2 : 5 * scaleFactor; // Scaled line thickness
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
        const headlen = 15 * scaleFactor; // Scaled headlen
        const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
        ctx.beginPath();
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - headlen * Math.cos(angle - Math.PI / 6), ann.y2 - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(ann.x2, ann.y2);
        ctx.lineTo(ann.x2 - headlen * Math.cos(angle + Math.PI / 6), ann.y2 - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
        break;
      case 'text':
        ctx.font = `${ann.fontSize * scaleFactor}px Arial`; // Scaled font size
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(ann.text, ann.x, ann.y);
        break;
    }
  });

  if (windowItem.wizardWindowBounds && windowItem.wizardMeasurements) {
    ctx.save();
    const { tl, tr, bl, br } = windowItem.wizardWindowBounds;

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

    const textHeight = 20 * scaleFactor; // Scaled
    const textPadding = 5 * scaleFactor; // Scaled
    const roundedRectRadius = 8 * scaleFactor; // Scaled

    ctx.lineWidth = 2 * scaleFactor; // Scaled
    ctx.font = `bold ${20 * scaleFactor}px Arial`; // Scaled

    ctx.setLineDash([5 * scaleFactor, 5 * scaleFactor]); // Scaled
    ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
    Object.values(widthLines).forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
    });
    ctx.strokeStyle = "rgba(34, 197, 94, 0.6)";
    Object.values(heightLines).forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
        ctx.stroke();
    });
    ctx.setLineDash([]);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    Object.entries(windowItem.wizardMeasurements.widths).forEach(([key, value]) => {
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

    Object.entries(windowItem.wizardMeasurements.heights).forEach(([key, value]) => {
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
        ctx.fillText(key, line.start.x - (10 * scaleFactor), line.start.y); // Scaled padding
    });

    ctx.fillStyle = "#22c55e";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    Object.entries(heightLines).forEach(([key, line]) => {
        ctx.fillText(key, line.start.x, line.start.y - (10 * scaleFactor)); // Scaled padding
    });

    ctx.restore();
  }

  const infoLines: string[] = [];
  if (windowItem.location || windowItem.windowNumber) {
      infoLines.push(`${windowItem.location || ''} ${windowItem.windowNumber || ''}`.trim());
  }
  const productInfo = [windowItem.product, windowItem.controlType].filter(Boolean).join(' / ');
  if (productInfo) {
      infoLines.push(productInfo);
  }

  if (infoLines.length > 0) {
      ctx.save();
      ctx.font = `bold ${24 * scaleFactor}px Arial`; // Scaled font size
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      const textX = canvas.width - (15 * scaleFactor); // Scaled padding
      let textY = (15 * scaleFactor); // Scaled padding
      
      const allTextMetrics = infoLines.map(line => ctx.measureText(line));
      const maxWidth = Math.max(...allTextMetrics.map(m => m.width));
      const totalHeight = infoLines.length * (30 * scaleFactor) + (infoLines.length > 1 ? (5 * scaleFactor) : 0); // Scaled line height and gap

      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      drawRoundedRect(ctx, textX - maxWidth - (10 * scaleFactor), textY - (5 * scaleFactor), maxWidth + (20 * scaleFactor), totalHeight + (5 * scaleFactor), (5 * scaleFactor)); // Scaled rect
      ctx.fillStyle = "white";
      infoLines.forEach(line => {
          ctx.fillText(line, textX, textY);
          textY += (30 * scaleFactor); // Scaled line height
      });
      ctx.restore();
  }

  try {
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error(`Error converting canvas to data URL for PDF for window ${windowItem.lineNumber}:`, error);
    return ''; // Return empty string if data URL conversion fails
  }
}