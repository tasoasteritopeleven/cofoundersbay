import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_TTL_METADATA = 'cache_ttl';
export const CACHE_TAGS_METADATA = 'cache_tags';

/**
 * Cache decorator for methods
 * @param key Cache key template (can include method parameters)
 * @param ttl Time to live in seconds
 * @param tags Cache tags for invalidation
 */
export function Cache(key: string, ttl?: number, tags?: string[]): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    SetMetadata(`${propertyKey.toString()}_${CACHE_KEY_METADATA}`, key);
    if (ttl) {
      SetMetadata(`${propertyKey.toString()}_${CACHE_TTL_METADATA}`, ttl);
    }
    if (tags) {
      SetMetadata(`${propertyKey.toString()}_${CACHE_TAGS_METADATA}`, tags);
    }
    return descriptor;
  };
}

/**
 * Cache invalidation decorator for methods
 * @param tags Tags to invalidate
 */
export function InvalidateCache(tags: string[]): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache tags after successful execution
      if (this.cacheService && tags.length > 0) {
        await Promise.all(tags.map(tag => this.cacheService.invalidateByTag(tag)));
      }
      
      return result;
    };

    return descriptor;
  };
}
