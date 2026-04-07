/**
 * 这个文件负责最基础的限流：按 IP 每分钟限制请求次数。
 * 这样做是为了保护免费部署环境的稳定性，避免被瞬时高频请求拖垮。
 */
import { LRUCache } from "lru-cache";

type RateState = {
  count: number;
  resetAt: number;
};

const store = new LRUCache<string, RateState>({
  max: 10000,
  ttl: 60 * 60 * 1000,
});

/**
 * 检查请求是否超出频率限制。
 *
 * @param ip 客户端 IP
 * @param limit 每分钟允许次数
 * @param windowMs 窗口大小（毫秒）
 * @returns 是否允许 + 剩余次数 + 重置时间
 * @example
 * const { allowed } = checkRateLimit("127.0.0.1", 30, 60000);
 */
export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const state = store.get(ip);
  if (!state || state.resetAt <= now) {
    const next: RateState = { count: 1, resetAt: now + windowMs };
    store.set(ip, next);
    return { allowed: true, remaining: limit - 1, resetAt: next.resetAt };
  }
  if (state.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: state.resetAt };
  }
  state.count += 1;
  store.set(ip, state);
  return { allowed: true, remaining: limit - state.count, resetAt: state.resetAt };
}

