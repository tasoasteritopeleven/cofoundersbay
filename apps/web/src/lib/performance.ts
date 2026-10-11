/**
 * Performance monitoring and optimization utilities
 * Tracks Core Web Vitals and provides performance insights
 */


/**
 * The DOM lib does not model these entry types, so they were each read through
 * `as any`. Declaring the fields we actually use keeps the casts honest and
 * makes a typo a build error rather than a NaN metric.
 */
interface LargestContentfulPaintEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
}

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

export interface PerformanceMetrics {
  FCP?: number; // First Contentful Paint
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  TTFB?: number; // Time to First Byte
  INP?: number; // Interaction to Next Paint
}

export class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window === 'undefined') return;
    this.initializeObservers();
  }

  private initializeObservers() {
    // Observe paint timing
    if ('PerformanceObserver' in window) {
      try {
        // FCP observer
        const paintObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.name === 'first-contentful-paint') {
              this.metrics.FCP = entry.startTime;
              this.reportMetric('FCP', entry.startTime);
            }
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.push(paintObserver);

        // LCP observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as LargestContentfulPaintEntry;
          this.metrics.LCP = lastEntry.renderTime || lastEntry.loadTime;
          if (this.metrics.LCP) {
            this.reportMetric('LCP', this.metrics.LCP);
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // FID observer
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.metrics.FID = (entry as FirstInputEntry).processingStart - entry.startTime;
            this.reportMetric('FID', this.metrics.FID);
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);

        // CLS observer
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as LayoutShiftEntry;
            if (!shift.hadRecentInput) {
              clsValue += shift.value;
              this.metrics.CLS = clsValue;
              this.reportMetric('CLS', clsValue);
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);

        // INP observer (Interaction to Next Paint)
        const inpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.metrics.INP = entry.duration;
            this.reportMetric('INP', this.metrics.INP ?? 0);
          }
        });
        inpObserver.observe({ entryTypes: ['event'] });
        this.observers.push(inpObserver);
      } catch (e) {
        console.warn('Performance monitoring not fully supported', e);
      }
    }

    // TTFB from Navigation Timing
    if ('performance' in window && 'timing' in performance) {
      // performance.timing is deprecated but still the only source in some
      // browsers; PerformanceTiming already types these fields.
      const timing: PerformanceTiming = performance.timing;
      this.metrics.TTFB = timing.responseStart - timing.requestStart;
      if (this.metrics.TTFB) {
        this.reportMetric('TTFB', this.metrics.TTFB);
      }
    }
  }

  private reportMetric(name: string, value: number) {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${name}:`, value.toFixed(2), 'ms');
    }

    // Send to analytics in production
    if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
      // You can integrate with your analytics service here
      // Example: window.gtag?.('event', 'web_vitals', { name, value });
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  getScore(): { score: number; rating: 'good' | 'needs-improvement' | 'poor' } {
    const { LCP, FID, CLS } = this.metrics;
    
    let score = 100;
    
    // LCP scoring (good: <2.5s, needs improvement: <4s, poor: >=4s)
    if (LCP) {
      if (LCP >= 4000) score -= 40;
      else if (LCP >= 2500) score -= 20;
    }
    
    // FID scoring (good: <100ms, needs improvement: <300ms, poor: >=300ms)
    if (FID) {
      if (FID >= 300) score -= 30;
      else if (FID >= 100) score -= 15;
    }
    
    // CLS scoring (good: <0.1, needs improvement: <0.25, poor: >=0.25)
    if (CLS) {
      if (CLS >= 0.25) score -= 30;
      else if (CLS >= 0.1) score -= 15;
    }

    let rating: 'good' | 'needs-improvement' | 'poor';
    if (score >= 80) rating = 'good';
    else if (score >= 50) rating = 'needs-improvement';
    else rating = 'poor';

    return { score, rating };
  }

  cleanup() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
}

// React hook for performance monitoring
export function usePerformanceMonitor() {
  if (typeof window === 'undefined') return null;
  return getPerformanceMonitor();
}

// Utility to measure function execution time
export function measurePerformance<T>(
  fn: () => T,
  label: string
): T {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${label}:`, (end - start).toFixed(2), 'ms');
  }
  
  return result;
}

// Debounce utility for performance optimization
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle utility for performance optimization
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Lazy load images with intersection observer
export function lazyLoadImage(img: HTMLImageElement, src: string) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        img.src = src;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });
  
  observer.observe(img);
}
