import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-linkedin-oauth2';

export interface LinkedInProfile {
  id: string;
  email: string;
  /** LinkedIn's own `email_verified` claim; an unverified address is never used to link an existing account. */
  emailVerified: boolean;
  displayName: string;
  firstName: string;
  lastName: string;
  picture?: string;
}

/**
 * Sign In with LinkedIn using OpenID Connect.
 *
 * LinkedIn stopped granting `r_liteprofile` and `r_emailaddress` to apps
 * created after 1 August 2023; those apps get `openid profile email` and read
 * the member from `/v2/userinfo` with a bearer token. The library's own
 * `userProfile` still calls the retired `/v2/me` projection, so it is
 * replaced here; its authorization and token endpoints are unchanged.
 */
export const LINKEDIN_SCOPES = ['openid', 'profile', 'email'] as const;
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/** The claims `/v2/userinfo` returns for the three scopes above. */
export interface LinkedInUserinfo {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean | string;
  locale?: unknown;
}

export function linkedInProfileFromUserinfo(info: LinkedInUserinfo): LinkedInProfile {
  if (!info?.sub) throw new Error('LinkedIn userinfo has no subject');
  const firstName = info.given_name?.trim() ?? '';
  const lastName = info.family_name?.trim() ?? '';
  return {
    id: info.sub,
    email: info.email?.trim().toLowerCase() ?? '',
    emailVerified: info.email_verified === true || info.email_verified === 'true',
    displayName: info.name?.trim() || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    picture: info.picture || undefined,
  };
}

@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin') {
  constructor(private readonly config: ConfigService) {
    const clientID = config.get<string>('LINKEDIN_CLIENT_ID');
    const clientSecret = config.get<string>('LINKEDIN_CLIENT_SECRET');
    const callbackURL = config.get<string>('LINKEDIN_CALLBACK_URL') || 'http://localhost:3001/api/auth/linkedin/callback';

    super({
      clientID: clientID || 'not-configured',
      clientSecret: clientSecret || 'not-configured',
      callbackURL,
      scope: [...LINKEDIN_SCOPES],
      passReqToCallback: false,
    });
  }

  /** Reads the member from the OIDC userinfo endpoint instead of the retired `/v2/me`. */
  userProfile(accessToken: string, done: (err?: unknown, profile?: unknown) => void): void {
    fetch(LINKEDIN_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`LinkedIn userinfo answered ${res.status}`);
        return (await res.json()) as LinkedInUserinfo;
      })
      .then((info) => done(null, linkedInProfileFromUserinfo(info)))
      .catch((err) => done(err));
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: LinkedInProfile,
    done: (err: unknown, user?: LinkedInProfile) => void,
  ): Promise<void> {
    done(null, profile);
  }
}
