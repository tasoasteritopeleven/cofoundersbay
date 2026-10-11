import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string; // Custom cache key
  tags?: string[]; // Cache tags for invalidation
}

@Injectable()
export class CacheService {
  private readonly redis: Redis;
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTtl: number;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.configService.get('app.redis');
    this.defaultTtl = 300; // 5 minutes default TTL

    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  // Basic cache operations
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache key: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.defaultTtl;
      
      if (expiration > 0) {
        await this.redis.setex(key, expiration, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache key: ${key}`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache key: ${key}`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache key existence: ${key}`, error);
      return false;
    }
  }

  // Advanced cache operations
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.redis.mget(...keys);
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error(`Failed to get multiple cache keys: ${keys.join(', ')}`, error);
      return keys.map(() => null);
    }
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const entry of entries) {
        const serializedValue = JSON.stringify(entry.value);
        const expiration = entry.ttl || this.defaultTtl;
        
        if (expiration > 0) {
          pipeline.setex(entry.key, expiration, serializedValue);
        } else {
          pipeline.set(entry.key, serializedValue);
        }
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to set multiple cache keys`, error);
    }
  }

  // Cache invalidation by tags
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const pattern = `tag:${tag}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} cache keys for tag: ${tag}`);
      }
    } catch (error) {
      this.logger.error(`Failed to invalidate cache by tag: ${tag}`, error);
    }
  }

  // Cache warming
  async warm<T>(key: string, factory: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const cacheKey = this.buildKey(key, options);
    
    // Try to get from cache first
    let cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - generate value
    try {
      const value = await factory();
      await this.set(cacheKey, value, options?.ttl);
      
      // Store tag relationships if tags are provided
      if (options?.tags) {
        await this.storeTagRelationships(cacheKey, options.tags);
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Failed to warm cache for key: ${cacheKey}`, error);
      throw error;
    }
  }

  // Cache with automatic refresh
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const cacheKey = this.buildKey(key, options);
    
    // Try to get from cache first
    let cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - generate and cache value
    try {
      const value = await factory();
      await this.set(cacheKey, value, options?.ttl);
      
      // Store tag relationships if tags are provided
      if (options?.tags) {
        await this.storeTagRelationships(cacheKey, options.tags);
      }
      
      return value;
    } catch (error) {
      this.logger.error(`Failed to get or set cache for key: ${cacheKey}`, error);
      throw error;
    }
  }

  // Increment/decrement operations
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.incrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to increment cache key: ${key}`, error);
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.redis.decrby(key, amount);
    } catch (error) {
      this.logger.error(`Failed to decrement cache key: ${key}`, error);
      throw error;
    }
  }

  // List operations
  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.lpush(key, ...values);
    } catch (error) {
      this.logger.error(`Failed to lpush to cache key: ${key}`, error);
      throw error;
    }
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.redis.rpush(key, ...values);
    } catch (error) {
      this.logger.error(`Failed to rpush to cache key: ${key}`, error);
      throw error;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.redis.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Failed to lrange from cache key: ${key}`, error);
      throw error;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.redis.llen(key);
    } catch (error) {
      this.logger.error(`Failed to get length of cache key: ${key}`, error);
      throw error;
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  // Statistics
  async getInfo(): Promise<any> {
    try {
      return await this.redis.info();
    } catch (error) {
      this.logger.error('Failed to get Redis info', error);
      return null;
    }
  }

  // Helper methods
  private buildKey(key: string, options?: CacheOptions): string {
    if (options?.key) {
      return options.key;
    }
    
    // Add namespace prefix to avoid collisions
    return `cofounderbay:${key}`;
  }

  private async storeTagRelationships(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        // Set expiration for tag key as well
        pipeline.expire(`tag:${tag}`, this.defaultTtl * 2);
      }
      
      await pipeline.exec();
    } catch (error) {
      this.logger.error(`Failed to store tag relationships for key: ${key}`, error);
    }
  }

  // Clear all cache (use with caution)
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.warn('All cache data cleared');
    } catch (error) {
      this.logger.error('Failed to flush all cache', error);
    }
  }
}
