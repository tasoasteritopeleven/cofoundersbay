import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  jwt: {
    accessTokenSecret: string;
    accessTokenTtl: string;
    refreshTokenTtl: string;
  };
  database: {
    url: string;
    ssl: boolean;
    poolSize: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  search: {
    host: string;
    port: number;
    apiKey?: string;
  };
  storage: {
    provider: 'local' | 's3';
    bucket?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  email: {
    provider: 'smtp' | 'sendgrid' | 'ses';
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user: string;
      pass: string;
    };
    apiKey?: string;
    from?: string;
  };
  monitoring: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
  };
  features: {
    registration: boolean;
    emailVerification: boolean;
    profileVerification: boolean;
    messaging: boolean;
    events: boolean;
    groups: boolean;
    mentoring: boolean;
    jobs: boolean;
    billing: boolean;
  };
}

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_SECRET || 'default-secret-change-in-production',
    accessTokenTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTokenTtl: process.env.JWT_REFRESH_TTL || '7d',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/cofounderbay',
    ssl: process.env.DATABASE_SSL === 'true',
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '20', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  search: {
    host: process.env.MEILISEARCH_HOST || 'localhost',
    port: parseInt(process.env.MEILISEARCH_PORT || '7700', 10),
    apiKey: process.env.MEILISEARCH_MASTER_KEY,
  },
  storage: {
    provider: (process.env.STORAGE_PROVIDER as 'local' | 's3') || 'local',
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  email: {
    provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'sendgrid' | 'ses') || 'smtp',
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
    apiKey: process.env.SENDGRID_API_KEY || process.env.SES_ACCESS_KEY_ID,
    from: process.env.EMAIL_FROM || 'noreply@cofounderbay.com',
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    structured: process.env.STRUCTURED_LOGGING === 'true',
  },
  features: {
    registration: process.env.FEATURE_REGISTRATION !== 'false',
    emailVerification: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
    profileVerification: process.env.FEATURE_PROFILE_VERIFICATION === 'true',
    messaging: process.env.FEATURE_MESSAGING !== 'false',
    events: process.env.FEATURE_EVENTS !== 'false',
    groups: process.env.FEATURE_GROUPS !== 'false',
    mentoring: process.env.FEATURE_MENTORING !== 'false',
    jobs: process.env.FEATURE_JOBS !== 'false',
    billing: process.env.FEATURE_BILLING === 'true',
  },
}));
