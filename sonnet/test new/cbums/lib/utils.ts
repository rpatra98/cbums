import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Utility functions for the application
 */

/**
 * Determines if a user agent string is from a mobile device
 * @param userAgent The user agent string to check
 * @returns Object with device type and boolean flags for mobile/desktop
 */
export function detectDevice(userAgent: string = "") {
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua);
  
  return {
    type: isMobile ? "mobile" : "desktop",
    isMobile,
    isDesktop: !isMobile,
    userAgent
  };
}

/**
 * Formats a date for display
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  if (!date) return '';
  
  const d = new Date(date);
  const now = new Date();
  const diffInHours = (now.getTime() - d.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return `Today at ${d.toLocaleTimeString()}`;
  } else if (diffInHours < 48) {
    return `Yesterday at ${d.toLocaleTimeString()}`;
  } else {
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString()}`;
  }
}

/**
 * Truncates a string to a maximum length and adds ellipsis if needed
 * @param text String to truncate
 * @param maxLength Maximum allowed length
 * @returns Truncated string
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
}

/**
 * Creates a deep copy of an object
 * @param obj Object to clone
 * @returns A deep copy of the object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
} 