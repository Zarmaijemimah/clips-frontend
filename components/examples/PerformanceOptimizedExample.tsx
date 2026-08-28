/**
 * Performance-Optimized Component Example
 * 
 * Demonstrates all four performance optimization strategies working together:
 * 1. Layout Shift Prevention (CLS)
 * 2. Network Request Optimization
 * 3. Main Thread Optimization
 * 4. JavaScript Parsing Optimization (via dynamic imports)
 * 
 * This is a reference implementation showing best practices.
 * Issues: #873, #877, #878, #880
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { LazyImage } from "@/components/common/LazyImage";
import { useCLSMonitoring } from "@/app/hooks/useCLSMonitoring";
import { useNetworkOptimization } from "@/app/hooks/useNetworkOptimization";
import { useMainThreadOptimization, useDebounce } from "@/app/hooks/useMainThreadOptimization";
import { RESERVED_HEIGHTS, ASPECT_RATIOS } from "@/app/lib/layoutShiftPrevention";
import Skeleton from "@/components/ui/Skeleton";

// Heavy component loaded dynamically (JavaScript Parsing Optimization)
const HeavyChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: RESERVED_HEIGHTS.CHART }}>
      <Skeleton className="w-full h-full" />
    </div>
  ),
});

interface DataItem {
  id: string;
  title: string;
  thumbnail: string;
  value: number;
}

export default function PerformanceOptimizedExample() {
  // 1. CLS Monitoring (Development only)
  useCLSMonitoring();

  // 2. Network Optimization
  const { isSlow, optimizedFetch, networkInfo } = useNetworkOptimization({
    monitorNetworkChanges: true,
    onNetworkChange: (info) => {
      console.log(`Network changed to ${info.effectiveType}`);
    },
  });

  // 3. Main Thread Optimization
  const { scheduleTask, processArray } = useMainThreadOptimization({
    monitorLongTasks: true,
  });

  const [items, setItems] = useState<DataItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Load data with network optimization
  const loadData = useCallback(async () => {
    setLoading(true);
    
    try {
      // Use optimizedFetch with appropriate priority
      const data = await optimizedFetch<DataItem[]>("/api/items", {
        priority: "high", // Critical data
        contentType: "data",
        ttl: 60000, // Cache for 1 minute
      });

      // Process large dataset without blocking main thread
      await processArray(
        data,
        async (item, index) => {
          // Heavy processing for each item
          await processItem(item);
        },
        50 // Process 50 items per chunk
      );

      setItems(data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  }, [optimizedFetch, processArray]);

  // Debounced search (Main Thread Optimization)
  const debouncedSearch = useDebounce((query: string) => {
    // Schedule search as background task
    scheduleTask(async () => {
      const results = await optimizedFetch<DataItem[]>(
        `/api/search?q=${encodeURIComponent(query)}`,
        {
          priority: "normal",
          contentType: "data",
        }
      );
      setItems(results);
    }, "background");
  }, 300);

  // Handle search input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Load initial data
  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="space-y-8 p-6">
      {/* Network Status Indicator */}
      {isSlow && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-sm">
          ⚠️ Slow network detected ({networkInfo.effectiveType}) - Loading optimized content
        </div>
      )}

      {/* Search Input with Debouncing */}
      <div className="space-y-2">
        <label htmlFor="search" className="block text-sm font-medium">
          Search (debounced 300ms)
        </label>
        <input
          id="search"
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          className="w-full px-4 py-2 border rounded-lg"
          placeholder="Type to search..."
        />
      </div>

      {/* Grid with CLS Prevention */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && items.length === 0 ? (
          // Skeleton states with reserved heights (CLS Prevention)
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              style={{ minHeight: RESERVED_HEIGHTS.CLIP_CARD }}
              className="bg-surface border border-border rounded-lg overflow-hidden"
            >
              <Skeleton className="w-full h-full" />
            </div>
          ))
        ) : (
          items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))
        )}
      </div>

      {/* Heavy Component (Lazy Loaded) */}
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Revenue Chart</h2>
        <HeavyChart />
      </div>

      {/* Performance Metrics Display */}
      <PerformanceMetrics />
    </div>
  );
}

// Individual item card with CLS prevention
function ItemCard({ item }: { item: DataItem }) {
  return (
    <div 
      className="bg-surface border border-border rounded-lg overflow-hidden"
      style={{ minHeight: RESERVED_HEIGHTS.CLIP_CARD }}
    >
      {/* Image with aspect ratio preservation */}
      <div className="relative w-full">
        <LazyImage
          src={item.thumbnail}
          alt={item.title}
          aspectRatio="VIDEO" // 16:9 aspect ratio prevents CLS
          fill
          className="object-cover"
        />
      </div>
      
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-lg truncate">{item.title}</h3>
        <p className="text-sm text-muted-foreground">
          Value: ${item.value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// Display performance metrics in development
function PerformanceMetrics() {
  const { getUtilization, isOverBudget } = useMainThreadOptimization();
  const [utilization, setUtilization] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const interval = setInterval(() => {
      setUtilization(getUtilization());
    }, 1000);

    return () => clearInterval(interval);
  }, [getUtilization]);

  if (process.env.NODE_ENV !== "development") return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg text-xs space-y-1">
      <div className="font-bold">Performance Metrics</div>
      <div>
        Main Thread: {utilization.toFixed(1)}%
        {isOverBudget() && " ⚠️ OVER BUDGET"}
      </div>
      <div className="text-white/60 text-[10px]">
        (Development only)
      </div>
    </div>
  );
}

// Simulated heavy processing function
async function processItem(item: DataItem): Promise<void> {
  // Simulate some processing work
  return new Promise((resolve) => {
    setTimeout(resolve, 1);
  });
}
