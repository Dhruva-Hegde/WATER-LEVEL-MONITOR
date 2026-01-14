
// Simple in-memory rate limiter
const ipRequestHistory = new Map<string, number[]>();

export function isRateLimited(ip: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const history = ipRequestHistory.get(ip) || [];

    // Cleanup old entries
    const validHistory = history.filter(time => now - time < windowMs);

    if (validHistory.length >= limit) {
        return true;
    }

    validHistory.push(now);
    ipRequestHistory.set(ip, validHistory);
    return false;
}
