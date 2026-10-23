/**
 * Sliding-window rate limiter with a hard cap on tracked keys to avoid unbounded memory.
 * When at capacity, the oldest idle key is evicted before inserting a new one.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxEvents: number,
    /** Max distinct keys retained (default 2048). */
    private readonly maxKeys = 2048,
  ) {}

  /** Returns true if the event is allowed. */
  allow(key: string, now = Date.now()): boolean {
    this.pruneKey(key, now);
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) {
      this.evictOldestIdle(now);
    }

    const windowStart = now - this.windowMs;
    const prior = this.hits.get(key) ?? [];
    const recent = prior.filter((t) => t >= windowStart);
    if (recent.length >= this.maxEvents) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  clear(key: string): void {
    this.hits.delete(key);
  }

  /** Test helper — number of tracked keys. */
  size(): number {
    return this.hits.size;
  }

  private pruneKey(key: string, now: number): void {
    const windowStart = now - this.windowMs;
    const prior = this.hits.get(key);
    if (!prior) return;
    const recent = prior.filter((t) => t >= windowStart);
    if (recent.length === 0) this.hits.delete(key);
    else this.hits.set(key, recent);
  }

  private evictOldestIdle(now: number): void {
    const windowStart = now - this.windowMs;
    let victim: string | undefined;
    let oldest = Infinity;
    for (const [k, times] of this.hits) {
      const recent = times.filter((t) => t >= windowStart);
      if (recent.length === 0) {
        this.hits.delete(k);
        return;
      }
      const last = recent[recent.length - 1]!;
      if (last < oldest) {
        oldest = last;
        victim = k;
      }
    }
    if (victim) this.hits.delete(victim);
  }
}
