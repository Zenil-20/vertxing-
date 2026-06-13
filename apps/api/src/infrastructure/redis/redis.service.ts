/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/api/src/infrastructure/redis/redis.service.ts
 * Layer:   Infrastructure / Cache & Realtime State
 * Purpose: Own the Redis connection and expose the small set of operations the
 *          domain actually needs. Redis is where VOLATILE, hot-path state lives:
 *            • refresh-token allow-list (rotation + revocation)
 *            • live presence sets ("who is in room X right now")
 *          Composition over inheritance — we hold an ioredis client rather than
 *          extending it, so the public surface stays intentional and mockable.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { AppConfig } from '../../config/configuration';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(config: ConfigService) {
    const { url } = config.getOrThrow<AppConfig['redis']>('redis');
    // lazyConnect: we connect explicitly in onModuleInit for deterministic boot.
    // maxRetriesPerRequest: null keeps commands queued through brief blips.
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    this.client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Connected to Redis');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }

  // ── Generic key/value with TTL (used by the refresh-token allow-list) ──────

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  // ── Presence sets ("who is currently in this room") ────────────────────────

  async addToSet(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member);
  }

  async removeFromSet(key: string, member: string): Promise<void> {
    await this.client.srem(key, member);
  }

  async setMembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async setSize(key: string): Promise<number> {
    return this.client.scard(key);
  }

  async setHas(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  // ── Hashes (used by the waiting room: identity → display name) ──────────────

  async hashSet(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hashDelete(key: string, field: string): Promise<void> {
    await this.client.hdel(key, field);
  }

  async hashGetAll(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /** Set a TTL on any key (seconds). Used to auto-expire stale waiting state. */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  // ── Atomic primitives (the race-safety foundation for Direct Calls) ─────────

  /**
   * Atomic SET-if-absent with TTL. Returns true iff WE created the key. Used as
   * a per-pair call lock so two simultaneous invites (glare) can't both win —
   * exactly one acquires it; the other is told "busy".
   */
  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const res = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }

  /** Set many hash fields at once (store a call's metadata in one round-trip). */
  async hashSetObject(key: string, obj: Record<string, string>): Promise<void> {
    await this.client.hset(key, obj);
  }

  /**
   * Atomic compare-and-set on a single hash field via Lua. The state-machine
   * primitive: a transition only succeeds from the EXPECTED prior state, so two
   * racing events (e.g. accept vs. cancel at the same instant) can't both win.
   */
  async compareAndSetHashField(
    key: string,
    field: string,
    expected: string,
    next: string,
  ): Promise<boolean> {
    const script =
      "local cur = redis.call('HGET', KEYS[1], ARGV[1]) " +
      "if cur == ARGV[2] then redis.call('HSET', KEYS[1], ARGV[1], ARGV[3]) return 1 else return 0 end";
    const res = await this.client.eval(script, 1, key, field, expected, next);
    return res === 1;
  }

  /** Delete a key only if it still holds the expected value (safe lock release). */
  async deleteIfEquals(key: string, expected: string): Promise<void> {
    const script =
      "if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end return 1";
    await this.client.eval(script, 1, key, expected);
  }

  /** Atomic counters — used for ref-counted presence across multiple sockets. */
  async increment(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decrement(key: string): Promise<number> {
    return this.client.decr(key);
  }
}
