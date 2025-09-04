"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roundToNearest, formatMeasurement } from "@/utils/measurements"
import { cn } from "@/lib/utils"

interface MeasurementInputProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  required?: boolean
  error?: boolean
  labelColor?: string
  borderColor?: string;
  className?: string;
}

export function MeasurementInput({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
  borderColor,
  className,
}: MeasurementInputProps) {
  const [inputValue, setInputValue] = useState(formatMeasurement(value))
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setInputValue(formatMeasurement(value));
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleFocus = () => {
    isFocused.current = true;
    if (inputValue === "0") {
      setInputValue("");
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    if (inputValue.trim() === "") {
      onChange(0);
      setInputValue("0");
      return;
    }
    const numValue = Number.parseFloat(inputValue);

    if (isNaN(numValue) || numValue < 0) {
      setInputValue(formatMeasurement(value));
      return;
    }

    const roundedValue = roundToNearest(numValue, 0.125);
    if (roundedValue !== value) {
      onChange(roundedValue);
    }
    setInputValue(formatMeasurement(roundedValue));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={id} className={labelColor}>
          {label} {required && <span className="text-rose-500">*</span>}
        </Label>
      )}
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "h-12 text-center text-lg font-bold",
          error ? "border-rose-500" : "",
          borderColor ? `border-[2px] ${borderColor}` : ""
        )}
        placeholder="0"
      />
    </div>
  )
}