"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface WindowTagButtonGroupProps {
  id: string
  label: string
  value: string // e.g., "L-1", "C-3" or ""
  onChange: (value: string) => void
  required?: boolean
  error?: boolean
  labelColor?: string
}

export function WindowTagButtonGroup({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: WindowTagButtonGroupProps) {
  const [group1Value, setGroup1Value] = React.useState<string | null>(null)
  const [group2Value, setGroup2Value] = React.useState<string | null>(null)

  React.useEffect(() => {
    const stringValue = String(value || "");
    const parts = stringValue.split("-")
    if (parts.length === 2 && parts[0] && parts[1]) {
      setGroup1Value(parts[0])
      setGroup2Value(parts[1])
    } else {
      setGroup1Value(null)
      setGroup2Value(null)
    }
  }, [value])

  const handleGroup1Change = (newValue: string) => {
    const newGroup1 = group1Value === newValue ? null : newValue;
    setGroup1Value(newGroup1);
    if (newGroup1 && group2Value) {
      onChange(`${newGroup1}-${group2Value}`);
    } else {
      onChange("");
    }
  }

  const handleGroup2Change = (newValue: string) => {
    const newGroup2 = group2Value === newValue ? null : newValue;
    setGroup2Value(newGroup2);
    if (group1Value && newGroup2) {
      onChange(`${group1Value}-${newGroup2}`);
    } else {
      onChange("");
    }
  }

  const group1Options = ["L", "C", "R"]
  const group2Options = ["1", "2", "3", "4", "5"]

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div className={cn("flex flex-col space-y-3 p-3 border rounded-md", error && "border-rose-500")}>
        {/* Group 1: L, C, R */}
        <div className="flex space-x-2 justify-around">
          {group1Options.map((opt) => (
            <Button
              key={opt}
              onClick={() => handleGroup1Change(opt)}
              className={cn(
                "w-1/3 py-2 text-base",
                group1Value === opt ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary" : "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300"
              )}
            >
              {opt}
            </Button>
          ))}
        </div>

        {/* Group 2: 1, 2, 3, 4, 5 */}
        <div className="flex space-x-2 justify-around">
          {group2Options.map((opt) => (
            <Button
              key={opt}
              onClick={() => handleGroup2Change(opt)}
              className={cn(
                "w-1/5 py-2 text-base",
                group2Value === opt ? "bg-primary hover:bg-primary/90 text-primary-foreground border-primary" : "bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300"
              )}
            >
              {opt}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}