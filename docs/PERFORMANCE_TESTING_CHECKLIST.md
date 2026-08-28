# Performance Testing Checklist

Use this checklist to verify all performance optimizations are working correctly.

## Pre-Testing Setup

- [ ] Run `npm install` to ensure all dependencies are up to date
- [ ] Build the application: `npm run build`
- [ ] Clear browser cache and storage
- [ ] Use Chrome DevTools in Incognito mode for consistent results

## 1. Layout Shift Prevention (CLS) Testing

### Manual Testing

- [ ] **Dashboard Page**
  - [ ] Load dashboard and verify no layout shifts during initial load
  - [ ] Check that stat cards appear with reserved space (no jump when data loads)
  - [ ] Verify charts load without causing layout shifts
  - [ ] Ensure skeleton states match final content dimensions

- [ ] **Image Loading**
  - [ ] Navigate to pages with multiple images (projects, clips)
  - [ ] Verify images have proper aspect ratios set
  - [ ] Confirm LazyImage components reserve space before loading
  - [ ] Check that image placeholders match final image dimensions

- [ ] **Dynamic Content**
  - [ ] Load analytics page and verify charts don't shift layout
  - [ ] Navigate between tabs/sections and check for shifts
  - [ ] Verify modals and overlays don't cause background shifts

### Automated Testing

```bash
# Run Lighthouse CI to measure CLS
npm run perf:test
```

- [ ] CLS score is below 0.1 (Good rating)
- [ ] No layout shift warnings in Lighthouse report
- [ ] Check `Layout Shift` section in Chrome DevTools Performance panel

### Development Monitoring

- [ ] Open browser console in development
- [ ] Navigate through the application
- [ ] Verify layout shift logs appear for any detected shifts
- [ ] Check that shifted elements are highlighted (red border for 2s)

**Expected**: No layout shift logs for normal navigation. Any shifts should be documented and fixed.

## 2. Network Request Optimization Testing

### Network Condition Testing

- [ ] **Fast Network (4G)**
  - [ ] Open DevTools Network panel
  - [ ] Set throttling to "Fast 4G"
  - [ ] Load dashboard and verify requests complete quickly
  - [ ] Check that all requests have `Accept-Encoding: br, gzip, deflate` header
  - [ ] Verify responses use compression (check `Content-Encoding` header)

- [ ] **Slow Network (Slow 3G)**
  - [ ] Set throttling to "Slow 3G"
  - [ ] Load dashboard and verify:
    - [ ] Critical requests are prioritized
    - [ ] Analytics/background requests are deprioritized
    - [ ] No request timeouts
    - [ ] Appropriate loading states are shown

- [ ] **Offline Mode**
  - [ ] Enable offline mode in DevTools
  - [ ] Navigate to visited pages
  - [ ] Verify cached content is served
  - [ ] Check that appropriate offline messages appear

### Request Batching

- [ ] Identify pages that make multiple similar requests
- [ ] Verify requests are being batched (check Network panel for single batch request)
- [ ] Check batch request payload contains multiple items
- [ ] Verify responses are correctly distributed to individual callers

### Caching Verification

```bash
# Check cache headers in Network panel
```

- [ ] Static assets have `Cache-Control: public, max-age=31536000, immutable`
- [ ] API responses have appropriate cache headers
- [ ] Verify RequestCache is working (duplicate requests served from cache)

### Compression Verification

- [ ] Check Network panel → Response Headers
- [ ] Verify `Content-Encoding` is present (br, gzip, or deflate)
- [ ] Check transferred size vs. resource size (should be significantly smaller)
- [ ] For API responses > 1KB, verify compression is applied

## 3. Main Thread Optimization Testing

### Long Task Monitoring

- [ ] Open Chrome DevTools → Performance panel
- [ ] Record a session while navigating the app
- [ ] Check for long tasks (> 50ms) in the timeline
- [ ] Verify no tasks exceed 100ms
- [ ] Check Total Blocking Time (TBT) is below 200ms

### Task Scheduling Verification

- [ ] **User-blocking tasks**
  - [ ] Click buttons and verify immediate UI feedback
  - [ ] Check that user interactions don't queue behind other work
  - [ ] Verify INP (Interaction to Next Paint) < 200ms

- [ ] **User-visible tasks**
  - [ ] Verify visual updates (animations, transitions) are smooth
  - [ ] Check 60fps in Performance panel during animations

- [ ] **Background tasks**
  - [ ] Verify analytics tracking doesn't block UI
  - [ ] Check that background work runs during idle periods
  - [ ] Confirm low-priority work doesn't interfere with interactions

### Debouncing & Throttling

- [ ] **Search Input**
  - [ ] Type rapidly in search fields
  - [ ] Verify search doesn't fire on every keystroke
  - [ ] Check that search triggers after typing stops (300ms default)

- [ ] **Scroll Handling**
  - [ ] Scroll rapidly through long lists
  - [ ] Verify scroll handlers are throttled (not firing on every scroll event)
  - [ ] Check that scroll performance remains smooth

### Large Array Processing

- [ ] Navigate to pages with large data sets (100+ items)
- [ ] Verify page remains responsive during processing
- [ ] Check that main thread isn't blocked (can still interact with UI)
- [ ] Verify no jank during processing

### Development Monitoring

- [ ] Open browser console in development
- [ ] Enable main thread monitoring
- [ ] Navigate through the application
- [ ] Check for long task warnings in console
- [ ] Verify main thread utilization stays below 30%

## 4. JavaScript Parsing Optimization Testing

### Bundle Size Analysis

```bash
# Analyze bundle composition
npm run analyze
```

- [ ] Framework bundle < 150 KB
- [ ] Initial page bundle < 200 KB
- [ ] Total initial load < 500 KB
- [ ] No duplicate dependencies (check analyzer treemap)
- [ ] Verify code splitting is working (multiple smaller chunks vs. one large chunk)

### Code Splitting Verification

- [ ] Open DevTools → Network panel
- [ ] Navigate to different pages
- [ ] Verify page-specific chunks are loaded on demand
- [ ] Check that heavy components (charts, forms) are in separate chunks
- [ ] Confirm shared code is in commons chunk

### Tree Shaking Verification

```bash
# Build for production
npm run build

# Check bundle contents
# Look for unused exports or dead code
```

- [ ] Verify unused exports are removed
- [ ] Check that only imported functions are included
- [ ] Confirm no dev-only code in production bundle

### Package Import Optimization

- [ ] Build the app and check output
- [ ] Verify lucide-react imports are optimized (direct imports, not barrel)
- [ ] Check that large libraries are tree-shaken
- [ ] Confirm barrel imports are converted to direct imports

### Script Loading

- [ ] Check Network panel → JS files
- [ ] Verify scripts are loaded in correct order
- [ ] Confirm async/defer attributes are used appropriately
- [ ] Check that critical scripts block render, non-critical don't

### Console Removal

- [ ] Build for production
- [ ] Open production app in browser
- [ ] Open console and verify:
  - [ ] No `console.log()` statements
  - [ ] No `console.info()` statements
  - [ ] `console.error()` and `console.warn()` still present

## Cross-Browser Testing

Test in multiple browsers to ensure consistent performance:

- [ ] **Chrome/Edge** (Chromium)
  - [ ] All metrics within targets
  - [ ] No console errors
  - [ ] All features working

- [ ] **Firefox**
  - [ ] Performance comparable to Chrome
  - [ ] No browser-specific issues
  - [ ] All optimizations active

- [ ] **Safari** (if available)
  - [ ] Core Web Vitals measured
  - [ ] No Safari-specific performance issues
  - [ ] Fallbacks working for unsupported features

## Mobile Testing

Test on actual mobile devices or emulation:

- [ ] **Mobile Network Conditions**
  - [ ] Test on 3G network
  - [ ] Verify mobile-optimized assets are served
  - [ ] Check that adaptive optimizations engage

- [ ] **Mobile Performance**
  - [ ] LCP < 2.5s on mobile
  - [ ] No layout shifts on smaller screens
  - [ ] Touch interactions responsive (INP < 200ms)

- [ ] **Data Saver Mode**
  - [ ] Enable Data Saver in Chrome
  - [ ] Verify lighter assets are served
  - [ ] Check that caching is more aggressive
  - [ ] Confirm non-critical requests are deprioritized

## Production Monitoring

After deploying to production:

- [ ] **Real User Monitoring (RUM)**
  - [ ] Check Sentry for Web Vitals metrics
  - [ ] Verify P75 (75th percentile) metrics meet targets
  - [ ] Monitor for performance regressions
  - [ ] Check for browser/device-specific issues

- [ ] **Analytics**
  - [ ] Verify performance metrics are being tracked
  - [ ] Check that custom metrics are recorded
  - [ ] Monitor conversion impact of performance changes

- [ ] **Error Tracking**
  - [ ] Check for new performance-related errors
  - [ ] Verify optimization code doesn't cause crashes
  - [ ] Monitor for increased error rates

## Performance Budget Enforcement

Ensure performance budgets are not exceeded:

```bash
# Check against budgets
npm run bundle:check
```

- [ ] JavaScript bundle budget not exceeded
- [ ] CSS bundle budget not exceeded
- [ ] Image asset budget not exceeded
- [ ] Total page weight budget not exceeded

## Regression Testing

- [ ] Run existing test suite: `npm test`
- [ ] Verify all tests pass
- [ ] Run integration tests: `npm run test:integration`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Check visual regression: `npm run test:visual`

## Documentation

- [ ] All optimizations are documented in code comments
- [ ] Performance guide is updated
- [ ] Team is trained on performance best practices
- [ ] Performance metrics are added to dashboards

## Sign-off

- **Tester**: _______________
- **Date**: _______________
- **Build**: _______________
- **Environment**: _______________

### Notes

(Add any observations, issues found, or recommendations here)

---

## Continuous Monitoring

Set up alerts for:

- [ ] LCP > 4s
- [ ] CLS > 0.25
- [ ] INP > 500ms
- [ ] Bundle size increases > 10%
- [ ] Main thread blocking time > 300ms

Schedule regular performance audits:

- [ ] Weekly Lighthouse runs
- [ ] Monthly bundle analysis
- [ ] Quarterly comprehensive performance review
