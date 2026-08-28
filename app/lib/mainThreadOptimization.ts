/**
 * Main Thread Optimization (#873)
 *
 * Tools for identifying and resolving main thread bottlenecks:
 * - Long task detection and monitoring
 * - Work offloading to Web Workers
 * - Task scheduling and prioritization
 * - Main thread budget tracking
 * - Input responsiveness optimization
 *
 * Target: Total Blocking Time (TBT) < 200ms, INP < 200ms
 */

import { logger } from "./logger";
import { reportMetric } from "./performanceMonitoring";

// ─── Long Task Detection ──────────────────────────────────────────────────────

export interface LongTaskEntry {
  /** Task name/attribution */
  name: string;
  /** Duration in ms */
  duration: number;
  /** Start time relative to navigation */
  startTime: number;
  /** Attribution container (iframe, script, etc.) */
  attribution?: string;
}

/**
 * Monitor long tasks (>50ms) that block the main thread.
 * Uses PerformanceObserver to track tasks that exceed the threshold.
 *
 * @example
 * ```ts
 * const stop = monitorLongTasks((tasks) => {
 *   console.warn('Long tasks detected:', tasks);
 * });
 * ```
 */
export function monitorLongTasks(
  onLongTask: (tasks: LongTaskEntry[]) => void,
  threshold: number = 50
): () => void {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
    return () => {};
  }

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const longTasks: LongTaskEntry[] = entries
        .filter((entry) => entry.duration > threshold)
        .map((entry: any) => ({
          name: entry.name || "unknown",
          duration: entry.duration,
          startTime: entry.startTime,
          attribution: entry.attribution?.[0]?.name,
        }));

      if (longTasks.length > 0) {
        onLongTask(longTasks);

        // Report to performance monitoring
        longTasks.forEach((task) => {
          reportMetric("main_thread.long_task", task.duration, {
            taskName: task.name,
            attribution: task.attribution ?? "unknown",
          });
        });
      }
    });

    observer.observe({ type: "longtask", buffered: true });

    return () => observer.disconnect();
  } catch (err) {
    logger.warn("[mainThreadOptimization] Long task monitoring not supported", err);
    return () => {};
  }
}

/**
 * Calculate Total Blocking Time (TBT) from long task entries.
 * TBT is the sum of blocking time (duration > 50ms) for all long tasks.
 */
export function calculateTBT(longTasks: LongTaskEntry[]): number {
  return longTasks.reduce((total, task) => {
    // Only count the blocking portion (duration beyond 50ms threshold)
    const blockingTime = Math.max(0, task.duration - 50);
    return total + blockingTime;
  }, 0);
}

// ─── Work Offloading ──────────────────────────────────────────────────────────

/**
 * Generic worker pool for offloading CPU-intensive work.
 * Manages multiple worker instances for parallel processing.
 */
export class WorkerPool<TInput, TOutput> {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private queue: Array<{
    input: TInput;
    resolve: (output: TOutput) => void;
    reject: (error: unknown) => void;
  }> = [];

  constructor(
    private workerUrl: string | URL,
    private poolSize: number = navigator.hardwareConcurrency || 4
  ) {
    this.initializePool();
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(this.workerUrl);
      this.workers.push(worker);
      this.availableWorkers.push(worker);

      worker.onmessage = (event) => {
        this.availableWorkers.push(worker);
        this.processQueue();
      };

      worker.onerror = (error) => {
        logger.error("[WorkerPool] Worker error:", error);
        // Worker errored but is still available for next task
        this.availableWorkers.push(worker);
        this.processQueue();
      };
    }
  }

  /**
   * Execute work on an available worker from the pool.
   * Queues the work if all workers are busy.
   */
  async execute(input: TInput): Promise<TOutput> {
    return new Promise((resolve, reject) => {
      this.queue.push({ input, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.availableWorkers.length > 0) {
      const job = this.queue.shift()!;
      const worker = this.availableWorkers.shift()!;

      const handler = (event: MessageEvent<TOutput>) => {
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errorHandler);
        job.resolve(event.data);
      };

      const errorHandler = (error: ErrorEvent) => {
        worker.removeEventListener("message", handler);
        worker.removeEventListener("error", errorHandler);
        job.reject(error);
      };

      worker.addEventListener("message", handler);
      worker.addEventListener("error", errorHandler);
      worker.postMessage(job.input);
    }
  }

  /**
   * Terminate all workers and clear the queue.
   */
  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.queue.forEach((job) =>
      job.reject(new Error("WorkerPool terminated"))
    );
    this.queue = [];
  }

  /**
   * Get pool statistics.
   */
  getStats(): { total: number; available: number; queued: number } {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      queued: this.queue.length,
    };
  }
}

/**
 * Offload a heavy computation to a worker with automatic fallback.
 * Falls back to synchronous execution if workers aren't available.
 */
export async function offloadWork<TInput, TOutput>(
  input: TInput,
  workerFn: (input: TInput) => Promise<TOutput>,
  fallbackFn: (input: TInput) => TOutput | Promise<TOutput>,
  workerUrl?: string | URL
): Promise<TOutput> {
  // Fallback to sync execution if workers aren't available
  if (typeof Worker === "undefined" || !workerUrl) {
    const start = performance.now();
    const result = await fallbackFn(input);
    const duration = performance.now() - start;

    reportMetric("main_thread.sync_work", duration, {
      workType: "fallback",
    });

    return result;
  }

  try {
    const start = performance.now();
    const result = await workerFn(input);
    const duration = performance.now() - start;

    reportMetric("main_thread.worker_offload", duration, {
      workType: "worker",
    });

    return result;
  } catch (err) {
    logger.warn("[mainThreadOptimization] Worker failed, using fallback", err);
    return fallbackFn(input);
  }
}

// ─── Task Scheduling ──────────────────────────────────────────────────────────

export type TaskPriority = "user-blocking" | "user-visible" | "background";

export interface ScheduledTask {
  id: number;
  priority: TaskPriority;
  fn: () => void | Promise<void>;
  deadline?: number; // Timestamp when task should run by
}

/**
 * Scheduler that uses requestIdleCallback for background tasks
 * and prioritizes user-blocking work.
 *
 * Implements a simplified version of React's Scheduler.
 */
export class TaskScheduler {
  private tasks: ScheduledTask[] = [];
  private nextId = 0;
  private isProcessing = false;
  private currentTask: ScheduledTask | null = null;

  /**
   * Schedule a task with given priority.
   * Returns a cancel function.
   */
  schedule(
    fn: () => void | Promise<void>,
    priority: TaskPriority = "user-visible"
  ): () => void {
    const id = this.nextId++;
    const task: ScheduledTask = { id, priority, fn };

    // Set deadline based on priority
    if (priority === "user-blocking") {
      task.deadline = Date.now() + 250; // User-blocking should run within 250ms
    } else if (priority === "user-visible") {
      task.deadline = Date.now() + 1000; // User-visible within 1s
    }
    // Background tasks have no deadline

    this.tasks.push(task);
    this.tasks.sort((a, b) => {
      // Sort by priority first, then by deadline
      const priorityOrder = {
        "user-blocking": 0,
        "user-visible": 1,
        "background": 2,
      };
      
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      if (a.deadline && b.deadline) return a.deadline - b.deadline;
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      return 0;
    });

    this.processNext();

    return () => {
      const index = this.tasks.findIndex((t) => t.id === id);
      if (index !== -1) {
        this.tasks.splice(index, 1);
      }
    };
  }

  private processNext(): void {
    if (this.isProcessing || this.tasks.length === 0) return;

    const task = this.tasks[0];
    this.currentTask = task;

    // User-blocking tasks run immediately
    if (task.priority === "user-blocking") {
      this.runTask(task);
      return;
    }

    // User-visible tasks use requestAnimationFrame
    if (task.priority === "user-visible") {
      requestAnimationFrame(() => this.runTask(task));
      return;
    }

    // Background tasks use requestIdleCallback
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(() => this.runTask(task), { timeout: 5000 });
    } else {
      // Fallback to setTimeout for browsers without idle callback
      setTimeout(() => this.runTask(task), 1);
    }
  }

  private async runTask(task: ScheduledTask): Promise<void> {
    this.isProcessing = true;
    const start = performance.now();

    try {
      await task.fn();
      
      const duration = performance.now() - start;
      reportMetric(`main_thread.task.${task.priority}`, duration);

      // Warn about long user-blocking tasks
      if (task.priority === "user-blocking" && duration > 50) {
        logger.warn(
          `[TaskScheduler] Long user-blocking task: ${duration.toFixed(1)}ms`
        );
      }
    } catch (err) {
      logger.error("[TaskScheduler] Task failed:", err);
    } finally {
      // Remove completed task
      const index = this.tasks.findIndex((t) => t.id === task.id);
      if (index !== -1) {
        this.tasks.splice(index, 1);
      }

      this.currentTask = null;
      this.isProcessing = false;

      // Process next task
      if (this.tasks.length > 0) {
        this.processNext();
      }
    }
  }

  /**
   * Get current queue size by priority.
   */
  getQueueStats(): Record<TaskPriority, number> {
    return {
      "user-blocking": this.tasks.filter((t) => t.priority === "user-blocking")
        .length,
      "user-visible": this.tasks.filter((t) => t.priority === "user-visible")
        .length,
      background: this.tasks.filter((t) => t.priority === "background").length,
    };
  }

  /**
   * Cancel all pending tasks.
   */
  clear(): void {
    this.tasks = [];
    this.currentTask = null;
    this.isProcessing = false;
  }
}

/** Shared task scheduler instance */
export const taskScheduler = new TaskScheduler();

/**
 * Convenience wrapper for scheduling work at different priorities.
 */
export function scheduleWork(
  fn: () => void | Promise<void>,
  priority: TaskPriority = "user-visible"
): () => void {
  return taskScheduler.schedule(fn, priority);
}

// ─── Main Thread Budget Tracking ──────────────────────────────────────────────

/**
 * Track main thread utilization over time windows.
 * Helps identify when the main thread is consistently overloaded.
 */
export class MainThreadBudget {
  private windowSize: number;
  private budget: number; // Target percentage (0-100)
  private samples: Array<{ timestamp: number; blocked: number }> = [];

  /**
   * @param windowSize Time window in ms (default 1000ms)
   * @param budget Target utilization percentage (default 30%)
   */
  constructor(windowSize: number = 1000, budget: number = 30) {
    this.windowSize = windowSize;
    this.budget = budget;
  }

  /**
   * Record blocked time (e.g., from a long task).
   */
  recordBlocked(duration: number): void {
    const now = Date.now();
    this.samples.push({ timestamp: now, blocked: duration });

    // Remove samples outside the window
    const cutoff = now - this.windowSize;
    this.samples = this.samples.filter((s) => s.timestamp > cutoff);
  }

  /**
   * Get current utilization percentage.
   */
  getUtilization(): number {
    if (this.samples.length === 0) return 0;

    const totalBlocked = this.samples.reduce((sum, s) => sum + s.blocked, 0);
    return (totalBlocked / this.windowSize) * 100;
  }

  /**
   * Check if we're over budget.
   */
  isOverBudget(): boolean {
    return this.getUtilization() > this.budget;
  }

  /**
   * Get time remaining in budget (ms).
   */
  getRemainingBudget(): number {
    const utilization = this.getUtilization();
    const usedTime = (utilization / 100) * this.windowSize;
    const budgetTime = (this.budget / 100) * this.windowSize;
    return Math.max(0, budgetTime - usedTime);
  }

  /**
   * Reset tracking.
   */
  reset(): void {
    this.samples = [];
  }
}

/** Shared budget tracker */
export const mainThreadBudget = new MainThreadBudget();

// ─── Input Responsiveness ─────────────────────────────────────────────────────

/**
 * Debounce expensive operations triggered by user input.
 * Prevents flooding the main thread with rapid updates.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}

/**
 * Throttle expensive operations to limit execution frequency.
 * Ensures the function runs at most once per interval.
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun;

    if (timeSinceLastRun >= intervalMs) {
      lastRun = now;
      fn(...args);
    } else {
      // Schedule to run at the end of the interval
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          lastRun = Date.now();
          fn(...args);
        },
        intervalMs - timeSinceLastRun
      );
    }
  };
}

/**
 * Batch rapid state updates into a single update.
 * Useful for high-frequency events like scroll or mouse move.
 */
export function batchUpdates<T>(
  updateFn: (values: T[]) => void,
  windowMs: number = 16 // ~1 frame at 60fps
): (value: T) => void {
  let pending: T[] = [];
  let timeout: NodeJS.Timeout | null = null;

  return (value: T) => {
    pending.push(value);

    if (timeout) return;

    timeout = setTimeout(() => {
      if (pending.length > 0) {
        updateFn([...pending]);
        pending = [];
      }
      timeout = null;
    }, windowMs);
  };
}

/**
 * Yield to the main thread during long-running loops.
 * Prevents blocking the UI during heavy processing.
 *
 * @example
 * ```ts
 * for (const item of largeArray) {
 *   await yieldToMainThread();
 *   processItem(item);
 * }
 * ```
 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof setImmediate !== "undefined") {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Process array in chunks with yielding between chunks.
 * Prevents blocking the main thread during large array operations.
 */
export async function processInChunks<T>(
  items: T[],
  processFn: (item: T, index: number) => void | Promise<void>,
  chunkSize: number = 50
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    
    for (let j = 0; j < chunk.length; j++) {
      await processFn(chunk[j], i + j);
    }

    // Yield after each chunk
    if (i + chunkSize < items.length) {
      await yieldToMainThread();
    }
  }
}
