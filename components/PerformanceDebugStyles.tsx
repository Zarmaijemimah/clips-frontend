/**
 * Performance Debug Styles
 * 
 * Conditionally loads performance debugging CSS in development.
 * Provides visual highlighting for layout shifts and performance issues.
 */

"use client";

import { useEffect } from "react";

export default function PerformanceDebugStyles() {
  useEffect(() => {
    // Only load debug styles in development
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    // Dynamically load debug CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/globals-performance-debug.css";
    link.id = "performance-debug-styles";
    document.head.appendChild(link);

    return () => {
      // Cleanup on unmount
      const existingLink = document.getElementById("performance-debug-styles");
      if (existingLink) {
        existingLink.remove();
      }
    };
  }, []);

  return null;
}
