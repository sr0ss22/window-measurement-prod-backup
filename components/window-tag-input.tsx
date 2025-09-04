"use client"

import React from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface WindowTagInputProps {
  id: string
  label: string
  value: string // e.g., "L-1", "C-3"
  onChange: (value: string) => void
  required?: boolean
  error?: boolean
  labelColor?: string
}

export function WindowTagInput({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: WindowTagInputProps) {
  const [group1Value, setGroup1Value] = React.useState<string>("L")
  const [group2Value, setGroup2Value] = React.useState<string>("1")

  React.useEffect(() => {
    // Parse the incoming value (e.g., "L-1")
    // Ensure value is a string before splitting it, to handle cases where it might be a number (e.g., 0) or null
    const stringValue = String(value);
    const parts = stringValue.split("-")
    if (parts.length === 2) {
      setGroup1Value(parts[0])
      setGroup2Value(parts[1])
    } else {
      // Default if value is not in expected format or is not a string
      setGroup1Value("L")
      setGroup2Value("1")
      onChange("L-1") // Ensure a valid default is set
    }
  }, [value, onChange])

  const handleGroup1Change = (newValue: string) => {
    setGroup1Value(newValue)
    onChange(`${newValue}-${group2Value}`)
  }

  const handleGroup2Change = (newValue: string) => {
    setGroup2Value(newValue)
    onChange(`${group1Value}-${newValue}`)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <div className={cn("flex flex-col space-y-4 p-3 border rounded-md", error && "border-rose-500")}>
        {/* Group 1: L, C, R */}
        <RadioGroup
          value={group1Value}
          onValueChange={handleGroup1Change}
          className="flex space-x-2 justify-around"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="L" id={`${id}-L`} />
            <Label htmlFor={`${id}-L`}>L</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="C" id={`${id}-C`} />
            <Label htmlFor={`${id}-C`}>C</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="R" id={`${id}-R`} />
            <Label htmlFor={`${id}-R`}>R</Label>
          </div>
        </RadioGroup>

        {/* Group 2: 1, 2, 3, 4, 5 */}
        <RadioGroup
          value={group2Value}
          onValueChange={handleGroup2Change}
          className="flex space-x-2 justify-around"
        >
          {[1, 2, 3, 4, 5].map((num) => (
            <div className="flex items-center space-x-2" key={num}>
              <RadioGroupItem value={num.toString()} id={`${id}-${num}`} />
              <Label htmlFor={`${id}-${num}`}>{num}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    </div>
  )
}