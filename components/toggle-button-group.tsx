"use client"

import * as React from "react"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

interface ToggleButtonGroupProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  error?: boolean
  labelColor?: string
}

export function ToggleButtonGroup({
  id,
  label,
  value,
  onChange,
  options,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: ToggleButtonGroupProps) {
  
  const handleValueChange = (newValue: string) => {
    if (newValue) {
      onChange(newValue)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <ToggleGroup
        id={id}
        type="single"
        value={value}
        onValueChange={handleValueChange}
        className={cn("flex flex-wrap gap-2", error && "ring-2 ring-rose-500 rounded-md")}
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={option.label}
            className={cn(
              "h-12 text-base flex-grow",
              value === option.value 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                : "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300"
            )}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}