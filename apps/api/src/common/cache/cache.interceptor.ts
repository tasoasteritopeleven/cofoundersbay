import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { CacheService } from './cache.service';
import { CACHE_KEY_METADATA, CACHE_TTL_METADATA, CACHE_TAGS_METADATA } from './cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CacheService) private readonly cacheService: CacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cacheKey = this.reflector.get<string>(
      `${context.getHandler().name}_${CACHE_KEY_METADATA}`,
      context.getHandler(),
    );

    // If no cache key is defined, proceed without caching
    if (!cacheKey) {
      return next.handle();
    }

    const ttl = this.reflector.get<number>(
      `${context.getHandler().name}_${CACHE_TTL_METADATA}`,
      context.getHandler(),
    );

    const tags = this.reflector.get<string[]>(
      `${context.getHandler().name}_${CACHE_TAGS_METADATA}`,
      context.getHandler(),
    );

    // Generate cache key based on request parameters
    const request = context.switchToHttp().getRequest();
    const finalCacheKey = this.generateCacheKey(cacheKey, request);

    // Try to get from cache first
    return of(null).pipe(
      switchMap(() => {
        return this.cacheService.get(finalCacheKey);
      }),
      switchMap((cached) => {
        if (cached !== null) {
          // Cache hit - return cached value
          return of(cached);
        }

        // Cache miss - execute method and cache result
        return next.handle().pipe(
          switchMap(async (result) => {
            // Cache the result
            await this.cacheService.set(finalCacheKey, result, ttl);
            
            // Store tag relationships if tags are provided
            if (tags && tags.length > 0) {
              await this.storeTagRelationships(finalCacheKey, tags);
            }
            
            return result;
          }),
          catchError(async (error) => {
            // Don't cache errors
            throw error;
          }),
        );
      }),
    );
  }

  private generateCacheKey(baseKey: string, request: any): string {
    const params = {
      ...request.params,
      ...request.query,
    };

    // Remove sensitive or irrelevant params
    const filteredParams = Object.keys(params)
      .filter(key => !key.includes('password') && !key.includes('token'))
      .sort()
      .reduce((obj, key) => {
        obj[key] = params[key];
        return obj;
      }, {} as Record<string, any>);

    const paramString = Object.keys(filteredParams).length > 0
      ? JSON.stringify(filteredParams)
      : '';

    return `${baseKey}${paramString ? ':' + paramString : ''}`;
  }

  private async storeTagRelationships(key: string, tags: string[]): Promise<void> {
    try {
      const pipeline = this.cacheService['redis'].pipeline();
      
      for (const tag of tags) {
        pipeline.sadd(`tag:${tag}`, key);
        // Set expiration for tag key as well
        pipeline.expire(`tag:${tag}`, 600); // 10 minutes
      }
      
      await pipeline.exec();
    } catch (error) {
      // Tag relationship failure shouldn't break the caching
      console.error('Failed to store tag relationships', error);
    }
  }
}
