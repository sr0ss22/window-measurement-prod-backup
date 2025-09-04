"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { Check, X } from "lucide-react"

interface VisualSelectOption {
  value: string;
  label: string;
}

interface VisualSelectGroupProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: VisualSelectOption[]
  required?: boolean
  error?: boolean
  labelColor?: string
}

export function VisualSelectGroup({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: VisualSelectGroupProps) {
  
  const isYesNo = React.useMemo(() => 
    options.length === 2 && 
    options.some(o => o.value.toLowerCase() === 'yes') && 
    options.some(o => o.value.toLowerCase() === 'no'),
  [options]);

  if (isYesNo) {
    const yesOption = options.find(o => o.value.toLowerCase() === 'yes')!;
    const noOption = options.find(o => o.value.toLowerCase() === 'no')!;
    
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className={labelColor}>
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
        <div className={cn("flex items-center gap-2", error && "ring-2 ring-rose-500 rounded-md")}>
          <div className="flex flex-col items-center space-y-1 flex-1">
            <Button
              type="button"
              onClick={() => onChange(yesOption.value)}
              className={cn(
                "w-full h-16 rounded-full border-2 p-0",
                value === yesOption.value 
                  ? "bg-primary border-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Check className="h-8 w-8" />
            </Button>
            <span className="text-sm font-medium text-gray-700">{yesOption.label}</span>
          </div>
          <div className="flex flex-col items-center space-y-1 flex-1">
            <Button
              type="button"
              onClick={() => onChange(noOption.value)}
              className={cn(
                "w-full h-16 rounded-full border-2 p-0",
                 value === noOption.value 
                  ? "bg-gray-500 border-gray-500 text-white hover:bg-gray-600"
                  : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <X className="h-8 w-8" />
            </Button>
            <span className="text-sm font-medium text-gray-700">{noOption.label}</span>
          </div>
        </div>
      </div>
    );
  }

  // Generic case for 2-3 options
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div className={cn(
        "grid gap-2", 
        `grid-cols-1 sm:grid-cols-${options.length}`,
        error && "ring-2 ring-rose-500 rounded-md"
      )}>
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "h-14 text-base justify-center",
              value === option.value 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                : "bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            )}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}