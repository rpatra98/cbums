"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover } from "./popover";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          !value && "text-gray-400"
        )}
        onClick={() => setOpen(true)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(value, "PPP") : <span>{placeholder}</span>}
      </Button>
      
      {open && (
        <div className="absolute top-full left-0 z-10 mt-1 rounded-md border bg-white shadow-md">
          <div className="p-1">
            <Calendar
              mode="single"
              selected={value || undefined}
              onSelect={(date) => {
                onChange(date || null);
                setOpen(false);
              }}
              initialFocus
            />
          </div>
          <div className="flex justify-between p-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 