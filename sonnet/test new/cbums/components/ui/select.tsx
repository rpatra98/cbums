"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
};

export function Select({ value, onValueChange, children }: SelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div
        className="flex items-center justify-between border rounded-md p-2 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <SelectValue value={value} />
        <span className="ml-2">▼</span>
      </div>
      
      {open && (
        <div className="absolute z-10 w-full border rounded-md mt-1 bg-white shadow-lg py-1">
          <SelectContext.Provider value={{ onSelect: handleSelect }}>
            {children}
          </SelectContext.Provider>
        </div>
      )}
    </div>
  );
}

export function SelectTrigger({ children }: { children: React.ReactNode }) {
  return children;
}

export function SelectValue({ value, placeholder }: { value: string; placeholder?: string }) {
  return <div>{value || placeholder || "Select an option"}</div>;
}

export function SelectContent({ children }: { children: React.ReactNode }) {
  return <div className="py-1">{children}</div>;
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
  const context = React.useContext(SelectContext);
  
  return (
    <div
      className="px-2 py-1 cursor-pointer hover:bg-gray-100"
      onClick={() => context.onSelect(value)}
    >
      {children}
    </div>
  );
}

const SelectContext = React.createContext<{
  onSelect: (value: string) => void;
}>({
  onSelect: () => {},
}); 