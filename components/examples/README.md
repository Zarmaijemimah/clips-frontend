# Performance Optimization Examples

This directory contains reference implementations demonstrating performance optimization best practices.

## PerformanceOptimizedExample.tsx

A comprehensive example component that demonstrates all four performance optimization strategies:

### 1. Layout Shift Prevention (CLS)

```tsx
// Use LazyImage with aspect ratios
<LazyImage
  src={item.thumbnail}
  alt={item.title}
  aspectRatio="VIDEO" // Prevents CLS by reserving space
  fill
/>

// Reserve heights for skeleton states
<div style={{ minHeight: RESERVED_HEIGHTS.CLIP_CARD }}>
  <Skeleton />
</div>

// Monitor CLS in development
useCLSMonitoring();
```

**Key Concepts:**
- Always specify aspect ratios for images
- Use reserved heights for loading states
- Enable CLS monitoring during development

### 2. Network Request Optimization

```tsx
// Network-aware fetching
const { isSlow, optimizedFetch } = useNetworkOptimization({
  monitorNetworkChanges: true,
});

// Automatically adapts to network conditions
const data = await optimizedFetch("/api/data", {
  priority: "high",
  contentType: "data",
  ttl: 60000,
});

// Show different content on slow networks
{isSlow && <p>Loading optimized content...</p>}
```

**Key Concepts:**
- Monitor network conditions in real-time
- Prioritize critical requests
- Adapt content based on network speed
- Use appropriate cache TTLs

### 3. Main Thread Optimization

```tsx
// Debounce search input
const debouncedSearch = useDebounce((query: string) => {
  performSearch(query);
}, 300);

// Schedule work at appropriate priorities
scheduleTask(() => {
  updateUI();
}, "user-blocking"); // Immediate

scheduleTask(() => {
  trackAnalytics();
}, "background"); // When idle

// Process large arrays without blocking
await processArray(items, processItem, 50);
```

**Key Concepts:**
- Debounce high-frequency inputs
- Schedule work by priority (user-blocking > user-visible > background)
- Process large datasets in chunks
- Monitor long tasks in development

### 4. JavaScript Parsing Optimization

```tsx
// Lazy load heavy components
const HeavyChart = dynamic(() => import("@/components/HeavyChart"), {
  ssr: false,
  loading: () => <Skeleton />,
});
```

**Key Concepts:**
- Use dynamic imports for heavy components
- Skip SSR for client-only components
- Provide loading states to prevent CLS
- Bundle splitting is automatic with dynamic imports

## Usage

This component is a **reference implementation** and should not be used directly in production. Instead:

1. **Study the patterns** used in this example
2. **Apply the techniques** to your own components
3. **Adapt the code** to your specific use cases
4. **Test performance** using the provided checklist

## Testing the Example

To see the optimizations in action:

1. **Open DevTools**
   - Performance tab: Monitor long tasks and TBT
   - Network tab: Check request priorities and compression
   - Console: View CLS and long task warnings

2. **Simulate Network Conditions**
   - Set throttling to "Slow 3G"
   - Verify lighter assets are served
   - Check that requests are prioritized correctly

3. **Interact with the Component**
   - Type rapidly in search field (debouncing)
   - Scroll through items (lazy loading)
   - Watch performance metrics display

4. **Check Core Web Vitals**
   - Run Lighthouse audit
   - Verify CLS < 0.1
   - Verify TBT < 200ms
   - Verify INP < 200ms

## Related Documentation

- [Performance Optimization Guide](../../docs/PERFORMANCE_OPTIMIZATION.md)
- [Performance Testing Checklist](../../docs/PERFORMANCE_TESTING_CHECKLIST.md)
- [Layout Shift Prevention Utilities](../../app/lib/layoutShiftPrevention.ts)
- [Network Optimization Utilities](../../app/lib/networkOptimization.ts)
- [Main Thread Optimization Utilities](../../app/lib/mainThreadOptimization.ts)

## Performance Targets

When implementing these patterns, aim for:

- **CLS**: < 0.1
- **TBT**: < 200ms
- **INP**: < 200ms
- **LCP**: < 2.5s
- **FCP**: < 1.8s

Use the testing checklist to verify your implementation meets these targets.
