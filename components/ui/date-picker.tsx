"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface DatePickerProps {
  id: string;
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  required?: boolean;
  error?: boolean;
  labelColor?: string;
}

export function DatePicker({
  id,
  label,
  value,
  onChange,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const isValidDate = value instanceof Date && !isNaN(value.getTime());

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !isValidDate && "text-muted-foreground",
              error && "border-rose-500"
            )}
            id={id}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {isValidDate ? format(value, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={isValidDate ? value : undefined}
            onSelect={(date) => {
              onChange(date);
              setOpen(false); // Close popover after date selection
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}