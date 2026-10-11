import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { OptionalJwtAuthGuard } from './guards/jwt-optional.guard';
import { VerificationService } from './verification.service';
import { RolesGuard } from './guards/roles.guard';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { MailerModule } from '../mailer/mailer.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    MailerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const secret =
          config.get<string>('JWT_ACCESS_SECRET') ||
          (process.env.NODE_ENV !== 'production'
            ? 'dev-only-secret-min-32-characters-long'
            : undefined);
        return {
          secret,
          signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, OAuthController, TwoFactorController],
  providers: [
    AuthService,
    OAuthService,
    TwoFactorService,
    JwtStrategy,
    GoogleStrategy,
    LinkedInStrategy,
    OptionalJwtAuthGuard,
    VerificationService,
    RolesGuard,
  ],
  exports: [AuthService, OAuthService, TwoFactorService, JwtModule, OptionalJwtAuthGuard, VerificationService, RolesGuard],
})
export class AuthModule {}
