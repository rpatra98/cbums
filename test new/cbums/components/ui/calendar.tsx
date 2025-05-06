"use client";

import * as React from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  initialFocus?: boolean;
  className?: string;
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  initialFocus,
  className,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  
  // Get days in current month view
  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    const firstDayOfWeek = firstDay.getDay();
    
    // Add days from previous month
    for (let i = 0; i < firstDayOfWeek; i++) {
      const prevDate = new Date(year, month, -i);
      days.unshift({
        date: prevDate,
        isCurrentMonth: false,
      });
    }
    
    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }
    
    // Add days from next month
    const lastDayOfWeek = lastDay.getDay();
    for (let i = 1; i < 7 - lastDayOfWeek; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
      });
    }
    
    return days;
  };
  
  const days = getDaysInMonth();
  
  const handlePreviousMonth = () => {
    setCurrentMonth((prev) => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      return new Date(year, month - 1, 1);
    });
  };
  
  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      return new Date(year, month + 1, 1);
    });
  };
  
  const isDateSelected = (date: Date) => {
    if (!selected) return false;
    return (
      date.getFullYear() === selected.getFullYear() &&
      date.getMonth() === selected.getMonth() &&
      date.getDate() === selected.getDate()
    );
  };
  
  return (
    <div className={cn("p-3", className)}>
      <div className="flex justify-between mb-2">
        <button
          onClick={handlePreviousMonth}
          className="p-1 rounded hover:bg-gray-100"
        >
          &lt;
        </button>
        <div>{format(currentMonth, "MMMM yyyy")}</div>
        <button
          onClick={handleNextMonth}
          className="p-1 rounded hover:bg-gray-100"
        >
          &gt;
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="text-center text-sm text-gray-500">
            {day}
          </div>
        ))}
        
        {days.map((day, index) => (
          <button
            key={index}
            className={cn(
              "h-9 w-9 rounded-md text-center text-sm",
              day.isCurrentMonth ? "text-gray-900" : "text-gray-400",
              isDateSelected(day.date) && "bg-blue-500 text-white",
              !isDateSelected(day.date) && "hover:bg-gray-100"
            )}
            onClick={() => onSelect(day.date)}
          >
            {day.date.getDate()}
          </button>
        ))}
      </div>
    </div>
  );
} 