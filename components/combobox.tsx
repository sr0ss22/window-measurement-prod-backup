"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  required?: boolean;
  error?: boolean;
  labelColor?: string;
}

export function Combobox({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  error = false,
  labelColor = "text-charcoal",
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)

  // When the external `value` prop changes, update our internal `inputValue`.
  React.useEffect(() => {
    const currentLabel = options.find(opt => opt.value.toLowerCase() === value.toLowerCase())?.label || value;
    setInputValue(currentLabel);
  }, [value, options]);

  const handleSelect = (option: ComboboxOption) => {
    onChange(option.value);
    setInputValue(option.label);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newText = e.target.value;
    setInputValue(newText);
    onChange(newText); // Immediately update parent state for free typing
    if (newText) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const filteredOptions = inputValue
    ? options.filter(option =>
        option.label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : options;

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={labelColor}>
        {label} {required && <span className="text-rose-500">*</span>}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              id={id}
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => {
                if (inputValue) setOpen(true);
              }}
              onBlur={() => {
                // Delay closing to allow for item clicks
                setTimeout(() => setOpen(false), 150);
              }}
              placeholder={placeholder}
              className={cn("w-full pr-8", error && "border-rose-500")}
              autoComplete="off"
            />
            <ChevronsUpDown
              className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50 cursor-pointer"
              onClick={() => setOpen(!open)}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              {filteredOptions.length === 0 && inputValue ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleSelect(option)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value.toLowerCase() === option.value.toLowerCase()
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}