export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxEvents: number,
  ) {}

  /** Returns true if the event is allowed. */
  allow(key: string, now = Date.now()): boolean {
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
}
