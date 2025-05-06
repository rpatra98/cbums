"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PopoverProps {
  children: React.ReactNode;
  className?: string;
}

export function Popover({ children, className }: PopoverProps) {
  return <div className={cn("relative", className)}>{children}</div>;
}

interface PopoverTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function PopoverTrigger({ asChild, children }: PopoverTriggerProps) {
  if (asChild) {
    return children;
  }
  return <div>{children}</div>;
}

interface PopoverContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  return (
    <div
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
    >
      {children}
    </div>
  );
} 