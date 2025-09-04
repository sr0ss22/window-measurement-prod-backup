"use client";

import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { formatMeasurement } from "@/utils/measurements";
import type { WindowItem } from "@/types/window-item";
import { cn } from "@/lib/utils";
import { Image, Ruler, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/utils/date-formatter";

interface LineItemDisplayProps {
  windowItem: WindowItem;
}

export function LineItemDisplay({ windowItem }: LineItemDisplayProps) {
  const totalMeasurements = Object.values(windowItem.wizardMeasurements?.widths || {}).filter(v => v > 0).length + Object.values(windowItem.wizardMeasurements?.heights || {}).filter(v => v > 0).length;
  const hasImage = !!windowItem.image || !!windowItem.wizardImage;
  const hasAnnotations = !!windowItem.annotations;

  return (
    <Accordion type="single" collapsible className="w-full border rounded-lg">
      <AccordionItem value={windowItem.id} className="border-b-0">
        <AccordionTrigger className="p-4 text-base font-semibold hover:no-underline">
          <div className="flex items-center gap-3">
            {windowItem.width > 0 && windowItem.height > 0 ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            )}
            <span>Line #{windowItem.lineNumber}: {windowItem.location || 'N/A'} - {windowItem.product || 'N/A'}</span>
            {windowItem.width > 0 && windowItem.height > 0 && (
              <Badge variant="secondary" className="ml-auto">
                {formatMeasurement(windowItem.width)}" x {formatMeasurement(windowItem.height)}"
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="p-4 border-t bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p><strong>Window Tag:</strong> {windowItem.windowNumber || 'N/A'}</p>
              <p><strong>Mount Type:</strong> {windowItem.mountType || 'N/A'}</p>
              <p><strong>Control Type:</strong> {windowItem.controlType || 'N/A'}</p>
              <p><strong>Control Length:</strong> {windowItem.controlLength || 'N/A'}</p>
              <p><strong>Tilt:</strong> {windowItem.tilt || 'N/A'}</p>
              <p><strong>SBS:</strong> {windowItem.sbs || 'N/A'}</p>
              <p><strong>Stack Position:</strong> {windowItem.stackPosition || 'N/A'}</p>
            </div>
            <div className="space-y-2">
              <p><strong>Comments:</strong> {windowItem.comments || 'N/A'}</p>
              <p><strong>Notes:</strong> {windowItem.notes || 'N/A'}</p>
              <div className="flex items-center gap-2">
                <strong>Images:</strong>
                {hasImage ? <Image className="h-4 w-4 text-blue-500" /> : <span className="text-gray-500">None</span>}
                {hasAnnotations && <span className="text-xs text-gray-500">(Annotated)</span>}
              </div>
              <div className="flex items-center gap-2">
                <strong>Wizard Data:</strong>
                {totalMeasurements > 0 ? <Ruler className="h-4 w-4 text-green-500" /> : <span className="text-gray-500">None</span>}
              </div>
              {windowItem.signature && (
                <div className="space-y-1">
                  <strong>Signature:</strong>
                  <img src={windowItem.signature} alt="Signature" className="max-w-[150px] border rounded-md" />
                </div>
              )}
              {windowItem.uploadedFiles && windowItem.uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  <strong>Uploaded Files:</strong>
                  <ul className="list-disc list-inside">
                    {windowItem.uploadedFiles.map(file => <li key={file.id}>{file.name}</li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="col-span-full space-y-2">
              <p className="font-semibold mt-2">Surcharges:</p>
              <div className="flex flex-wrap gap-2">
                {windowItem.takeDown && <Badge variant="secondary">Take Down</Badge>}
                {windowItem.hardSurface && <Badge variant="secondary">Hard Surface</Badge>}
                {windowItem.holdDown && <Badge variant="secondary">Hold Down</Badge>}
                {windowItem.tallWindow12 && <Badge variant="secondary">Tall Window 12'</Badge>}
                {windowItem.tallWindow16 && <Badge variant="secondary">Tall Window 16'</Badge>}
                {!windowItem.takeDown && !windowItem.hardSurface && !windowItem.holdDown && !windowItem.tallWindow12 && !windowItem.tallWindow16 && (
                  <span className="text-gray-500">None</span>
                )}
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}