import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { AppConfig } from '../../../../shared/infrastructure/config/env.config';
import {
  REFRESH_TOKEN_TYPE,
  RefreshTokenPayload,
  TokenPayload,
  TokenService,
} from '../../application/ports/token-service.port';

/**
 * Access + refresh JWTs share the same secret (simpler ops, one env var)
 * but are distinguished by the `type` claim and by the caller invoking
 * `sign` vs `signRefresh`. Refresh tokens live much longer (default 30d)
 * so users don't need to re-login for weeks of active use.
 */
@Injectable()
export class JwtTokenService implements TokenService {
  private readonly refreshExpiresIn: string;

  constructor(
    private readonly jwt: JwtService,
    @Inject(ConfigService) config: ConfigService<AppConfig, true>,
  ) {
    this.refreshExpiresIn = config.get('jwt', { infer: true }).refreshExpiresIn;
  }

  sign(payload: TokenPayload): Promise<string> {
    return this.jwt.signAsync(payload);
  }

  verify(token: string): Promise<TokenPayload> {
    return this.jwt.verifyAsync<TokenPayload>(token);
  }

  signRefresh(userId: string): Promise<string> {
    const payload: RefreshTokenPayload = { sub: userId, type: REFRESH_TOKEN_TYPE };
    // Cast mirrors AuthModule's signOptions — an "expiresIn" string like
    // "30d" isn't in the @nestjs/jwt strict overload set.
    return this.jwt.signAsync(payload, {
      expiresIn: this.refreshExpiresIn as unknown as number,
    });
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    const decoded = await this.jwt.verifyAsync<Record<string, unknown>>(token);
    if (decoded.type !== REFRESH_TOKEN_TYPE || typeof decoded.sub !== 'string') {
      throw new Error('Not a refresh token');
    }
    return { sub: decoded.sub, type: REFRESH_TOKEN_TYPE };
  }
}
