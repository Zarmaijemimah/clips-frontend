# Performance Optimization Guide

This document covers the comprehensive performance optimizations implemented to address issues #873, #877, #878, and #880.

## Table of Contents

- [Overview](#overview)
- [1. Layout Shift Prevention (CLS)](#1-layout-shift-prevention-cls)
- [2. Network Request Optimization](#2-network-request-optimization)
- [3. Main Thread Optimization](#3-main-thread-optimization)
- [4. JavaScript Parsing Optimization](#4-javascript-parsing-optimization)
- [Testing & Monitoring](#testing--monitoring)
- [Performance Targets](#performance-targets)

## Overview

The application implements a four-pillar performance optimization strategy:

1. **CLS (Cumulative Layout Shift)**: Prevent visual instability during page load
2. **Network Optimization**: Reduce request overhead and adapt to network conditions
3. **Main Thread Optimization**: Keep the UI responsive by managing CPU-intensive work
4. **JavaScript Parsing**: Optimize bundle size and parsing time

## 1. Layout Shift Prevention (CLS)

### Target: CLS < 0.1

### Implemented Solutions

#### Aspect Ratio Preservation

Use aspect ratios to reserve space before content loads:

```tsx
import { LazyImage } from "@/components/common/LazyImage";
import { ASPECT_RATIOS } from "@/app/lib/layoutShiftPrevention";

function VideoThumbnail({ src }: { src: string }) {
  return (
    <LazyImage
      src={src}
      alt="Video thumbnail"
      aspectRatio="VIDEO" // 16:9 aspect ratio
      fill
    />
  );
}
```

Available aspect ratios:
- `VIDEO`: 16:9 (standard video)
- `PORTRAIT`: 9:16 (TikTok, Reels, Shorts)
- `SQUARE`: 1:1 (Instagram posts)
- `ULTRAWIDE`: 21:9
- `CLASSIC`: 4:3
- `THUMBNAIL`: 3:2

#### Reserved Heights for Skeletons

Use predefined heights for loading states:

```tsx
import { RESERVED_HEIGHTS, reserveHeight } from "@/app/lib/layoutShiftPrevention";

function SkeletonCard() {
  return (
    <div style={reserveHeight(RESERVED_HEIGHTS.STAT_CARD)}>
      <Skeleton />
    </div>
  );
}
```

Available reserved heights:
- `STAT_CARD`: 144px
- `CHART`: 300px
- `PROJECT_CARD`: 320px
- `CLIP_CARD`: 280px
- `TABLE_ROW`: 56px
- `MODAL_HEADER`: 80px
- `NAV_BAR`: 72px
- `BUTTON_GROUP`: 48px
- `FORM_FIELD`: 76px

#### CLS Monitoring

Monitor layout shifts in development:

```tsx
import { useCLSMonitoring } from "@/app/hooks/useCLSMonitoring";

function MyPage() {
  // Automatically logs layout shifts in development
  useCLSMonitoring();
  
  return <div>...</div>;
}
```

### Best Practices

1. **Always specify dimensions** for images, videos, and iframes
2. **Reserve space** for dynamic content with skeleton states
3. **Avoid injecting content** above existing content (ads, banners)
4. **Use transforms** instead of layout-affecting properties for animations
5. **Preload critical images** that appear above the fold

## 2. Network Request Optimization

### Implemented Solutions

#### Network-Aware Fetching

Automatically adapt requests based on network conditions:

```tsx
import { useNetworkOptimization } from "@/app/hooks/useNetworkOptimization";

function DataComponent() {
  const { networkInfo, isSlow, optimizedFetch } = useNetworkOptimization({
    monitorNetworkChanges: true,
    onNetworkChange: (info) => {
      console.log(`Network changed: ${info.effectiveType}`);
    }
  });

  const loadData = async () => {
    // Automatically prioritized based on network conditions
    const data = await optimizedFetch("/api/data", {
      priority: "high",
      contentType: "data",
      ttl: 60000, // 1 minute cache
    });
    return data;
  };

  return (
    <div>
      {isSlow && <p>Slow network detected - using optimized assets</p>}
    </div>
  );
}
```

#### Request Batching

Batch multiple requests into a single call:

```tsx
import { createRequestBatcher } from "@/app/lib/networkOptimization";

const clipBatcher = createRequestBatcher(
  async (clipIds: string[]) => {
    const response = await fetch(`/api/clips/batch?ids=${clipIds.join(",")}`);
    const clips = await response.json();
    
    // Return Map of id -> clip
    return new Map(clips.map((clip: any) => [clip.id, clip]));
  },
  {
    maxWaitMs: 50,      // Wait max 50ms before flushing
    maxBatchSize: 50,   // Max 50 items per batch
  }
);

// These will be automatically batched:
const clip1 = await clipBatcher.add("clip-1");
const clip2 = await clipBatcher.add("clip-2");
const clip3 = await clipBatcher.add("clip-3");
```

#### Request Prioritization

Set request priorities based on importance:

```tsx
import { requestCache } from "@/app/lib/cache/requestCacheInstance";

// Critical above-the-fold content
await requestCache.fetch(
  "/api/dashboard/stats",
  () => fetch("/api/dashboard/stats").then(r => r.json()),
  { priority: "high" }
);

// Analytics (can wait)
await requestCache.fetch(
  "/api/analytics/track",
  () => fetch("/api/analytics/track").then(r => r.json()),
  { priority: "low" }
);
```

#### Compression

Requests automatically negotiate compression:

```tsx
import { fetchWithCompression } from "@/app/lib/networkOptimization";

// Automatically requests br/gzip/deflate compression
const response = await fetchWithCompression("/api/large-dataset");
const data = await response.json();
```

### Best Practices

1. **Batch similar requests** made within a short timeframe
2. **Prioritize critical content** (above-the-fold, user-facing)
3. **Defer analytics and non-critical requests** to low priority
4. **Use compression** for large payloads
5. **Adapt to network conditions** - serve lighter assets on slow networks

## 3. Main Thread Optimization

### Target: TBT < 200ms, INP < 200ms

### Implemented Solutions

#### Task Scheduling

Schedule work at appropriate priorities:

```tsx
import { useMainThreadOptimization } from "@/app/hooks/useMainThreadOptimization";

function HeavyComponent() {
  const { scheduleTask, processArray } = useMainThreadOptimization({
    monitorLongTasks: true,
  });

  const handleUserAction = () => {
    // Respond immediately to user input
    scheduleTask(() => {
      updateUI();
    }, "user-blocking"); // Runs immediately
  };

  const updateChart = () => {
    // Visual updates
    scheduleTask(() => {
      renderChart();
    }, "user-visible"); // Runs via requestAnimationFrame
  };

  const sendAnalytics = () => {
    // Background work
    scheduleTask(() => {
      trackEvent();
    }, "background"); // Runs when idle
  };
}
```

#### Processing Large Arrays

Process large datasets without blocking:

```tsx
const { processArray } = useMainThreadOptimization();

async function processLargeDataset(items: Item[]) {
  await processArray(
    items,
    async (item, index) => {
      // Process each item
      await processItem(item);
    },
    50 // Process 50 items per chunk
  );
}
```

#### Debouncing & Throttling

Optimize high-frequency events:

```tsx
import { useDebounce, useThrottle } from "@/app/hooks/useMainThreadOptimization";

function SearchComponent() {
  // Debounce: Wait for user to stop typing
  const debouncedSearch = useDebounce((query: string) => {
    performSearch(query);
  }, 300);

  // Throttle: Limit scroll handling frequency
  const throttledScroll = useThrottle((e: React.UIEvent) => {
    handleScroll(e);
  }, 100);

  return (
    <div onScroll={throttledScroll}>
      <input onChange={(e) => debouncedSearch(e.target.value)} />
    </div>
  );
}
```

#### Long Task Monitoring

Automatically monitor long tasks in development:

```tsx
const { isOverBudget, getUtilization } = useMainThreadOptimization({
  monitorLongTasks: true,
  longTaskThreshold: 50,   // Tasks > 50ms are logged
  warnThreshold: 100,      // Tasks > 100ms get warnings
});

// Check main thread health
if (isOverBudget()) {
  console.warn(`Main thread utilization: ${getUtilization()}%`);
}
```

### Best Practices

1. **Schedule work appropriately**: User input → user-blocking, Visual updates → user-visible, Everything else → background
2. **Break up long tasks**: Use `processArray` or `yieldToMainThread` for CPU-intensive work
3. **Debounce text input**: Wait for user to finish typing before processing
4. **Throttle scroll/resize**: Limit frequency of expensive event handlers
5. **Monitor in development**: Enable long task monitoring to identify bottlenecks

## 4. JavaScript Parsing Optimization

### Implemented Solutions

#### Code Splitting

Components are automatically code-split:

```tsx
import dynamic from "next/dynamic";

// Heavy component loaded only when needed
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  ssr: false, // Skip SSR if not needed
  loading: () => <ChartSkeleton />, // Show skeleton while loading
});
```

#### Package Import Optimization

Configured in `next.config.ts`:

```typescript
experimental: {
  optimizePackageImports: [
    "lucide-react",
    "@stellar/stellar-sdk",
    "zod",
    "dompurify",
    "zustand",
  ],
}
```

This converts barrel imports into direct imports, reducing bundle size.

#### Tree Shaking

Production builds aggressively tree-shake unused code:

```typescript
// Only used exports are included in the bundle
import { specificFunction } from "large-library";
```

Configured in `next.config.ts`:

```typescript
optimization: {
  usedExports: true,
  sideEffects: true,
}
```

#### Bundle Splitting

Strategic chunk splitting for better caching:

- **Framework chunk**: React, Next.js (changes infrequently)
- **Library chunks**: Third-party packages (grouped by package)
- **Commons chunk**: Shared application code
- **Page chunks**: Route-specific code

#### Console Removal

Console statements (except errors/warnings) are removed in production:

```typescript
compiler: {
  removeConsole: {
    exclude: ["error", "warn"],
  },
}
```

### Best Practices

1. **Use dynamic imports** for heavy components not needed immediately
2. **Import only what you need** - avoid barrel imports when possible
3. **Monitor bundle size** using `npm run analyze`
4. **Check for duplicate dependencies** using `npm run cleanup`
5. **Keep dependencies updated** to benefit from performance improvements

## Testing & Monitoring

### Local Performance Testing

#### 1. Lighthouse CI

```bash
npm run perf:test
```

Runs Lighthouse and checks against performance budgets.

#### 2. Bundle Analysis

```bash
npm run analyze
```

Visualizes bundle composition and identifies large modules.

#### 3. Visual Regression

```bash
npm run test:visual
```

Ensures performance optimizations don't break layouts.

### Production Monitoring

#### Web Vitals

Automatically tracked and reported to Sentry:

- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **CLS (Cumulative Layout Shift)**: Target < 0.1
- **INP (Interaction to Next Paint)**: Target < 200ms
- **FCP (First Contentful Paint)**: Target < 1.8s
- **TTFB (Time to First Byte)**: Target < 800ms

#### Custom Metrics

Track custom performance metrics:

```tsx
import { measure, startMeasure } from "@/app/lib/performanceMonitoring";

// Measure synchronous/async operations
await measure("dashboard.load", async () => {
  await loadDashboardData();
});

// Manual measurement for multi-step operations
const endMeasure = startMeasure("upload.total");
// ... upload process ...
endMeasure({ fileSize: 12345, success: true });
```

### CLS Debugging

In development, layout shifts are automatically logged to console:

```
[CLS] Layout shift detected: 0.0234
  startTime: 1234.5
  sources: [
    { node: DIV, previousSize: 100x100, currentSize: 100x200 }
  ]
```

Shifted elements are highlighted for 2 seconds with a red border.

## Performance Targets

### Core Web Vitals

| Metric | Good | Needs Improvement | Poor | Current Target |
|--------|------|-------------------|------|----------------|
| LCP | ≤ 2.5s | 2.5s - 4.0s | > 4.0s | **< 2.5s** |
| CLS | ≤ 0.1 | 0.1 - 0.25 | > 0.25 | **< 0.1** |
| INP | ≤ 200ms | 200ms - 500ms | > 500ms | **< 200ms** |
| FCP | ≤ 1.8s | 1.8s - 3.0s | > 3.0s | **< 1.8s** |
| TTFB | ≤ 800ms | 800ms - 1800ms | > 1800ms | **< 800ms** |

### Application-Specific Targets

| Metric | Target | Description |
|--------|--------|-------------|
| Dashboard Load | < 1s | Time to interactive dashboard |
| Upload Chunk | < 5s | Per-chunk upload time |
| CDN Probe | < 200ms | CDN health check response |
| Main Thread Budget | < 30% | Main thread utilization |
| Total Blocking Time | < 200ms | Sum of long task blocking time |

### Bundle Size Targets

| Bundle | Target | Current Check |
|--------|--------|---------------|
| Framework | < 150 KB | ✓ Via bundle analyzer |
| Page (initial) | < 200 KB | ✓ Via Lighthouse |
| Total (initial) | < 500 KB | ✓ Via performance budget |

## Troubleshooting

### High CLS

1. Check console for logged layout shifts
2. Ensure all images have explicit dimensions or aspect ratios
3. Verify skeleton states match real content dimensions
4. Look for injected content (ads, embeds) causing shifts

### Slow Network Performance

1. Check Network panel for uncompressed responses
2. Verify request priorities are set correctly
3. Look for duplicate requests (should be coalesced)
4. Consider implementing request batching for repeated calls

### Main Thread Blocking

1. Enable long task monitoring in development
2. Check for synchronous heavy computations
3. Consider offloading work to Web Workers
4. Use task scheduling to defer non-critical work

### Large Bundle Size

1. Run `npm run analyze` to identify large modules
2. Check for duplicate dependencies
3. Ensure dynamic imports are used for heavy components
4. Verify tree shaking is working (check prod build)

## References

- [Web Vitals](https://web.dev/vitals/)
- [Optimize LCP](https://web.dev/optimize-lcp/)
- [Optimize CLS](https://web.dev/optimize-cls/)
- [Optimize INP](https://web.dev/optimize-inp/)
- [Code Splitting](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Bundle Analysis](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
