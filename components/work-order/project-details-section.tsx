"use client";

import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ProjectDetailsSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ProjectDetailsSection({ title, children, defaultOpen = false, className }: ProjectDetailsSectionProps) {
  return (
    <Accordion type="single" collapsible defaultValue={defaultOpen ? "item-1" : undefined} className="w-full border rounded-lg">
      <AccordionItem value="item-1" className="border-b-0">
        <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
          {title}
        </AccordionTrigger>
        <AccordionContent className="p-4 border-t">
          <CardContent className={cn("p-0 space-y-4", className)}>
            {children}
          </CardContent>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}