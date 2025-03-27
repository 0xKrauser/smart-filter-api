import { NextRequest, NextResponse } from "next/server";
import { getRedisClient } from "./redis";

type RateLimiterOptions = {
  limit: number;         // Maximum requests allowed
  window: number;        // Time window in seconds
  identifier?: (req: NextRequest) => string;  // Function to get unique identifier
};

export async function rateLimiter(
  req: NextRequest,
  options: RateLimiterOptions
) {
  const { limit, window, identifier } = options;
  
  // Get identifier (default to IP)
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const id = identifier ? identifier(req) : ip;
  
  const key = `rate-limit:${id}`;
  const redis = getRedisClient();
  
  // Get current count
  let count: number;
  try {
    // Increment counter and set expiry if not exists
    count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, window);
    }
    
    // Set rate limit headers
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', limit.toString());
    headers.set('X-RateLimit-Remaining', Math.max(0, limit - count).toString());
    
    // If over limit, return error response
    if (count > limit) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { 
          status: 429,
          headers,
        }
      );
    }
    
    return null; // No rate limit hit
  } catch (error) {
    console.error("Rate limiting error:", error);
    return null; // Continue on error
  }
}
