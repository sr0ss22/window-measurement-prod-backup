"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileCheckboxButtonProps {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  required?: boolean
  error?: boolean
}

export function MobileCheckboxButton({
  id,
  label,
  checked,
  onCheckedChange,
  required = false,
  error = false,
}: MobileCheckboxButtonProps) {
  return (
    <div className="flex flex-col items-center space-y-2 flex-1">
      <Button
        type="button"
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          "w-full h-14 text-base justify-center",
          checked ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary" : "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300",
          error && "border-rose-500 ring-2 ring-rose-500"
        )}
        aria-checked={checked}
        role="checkbox"
        id={id}
      >
        {checked ? <Check className="mr-2 h-5 w-5" /> : <X className="mr-2 h-5 w-5" />}
        {label}
      </Button>
      {required && error && !checked && (
        <p className="text-sm text-rose-500">This field is required.</p>
      )}
    </div>
  )
}