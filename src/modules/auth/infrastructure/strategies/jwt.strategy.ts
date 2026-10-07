import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfig } from '../../../../shared/infrastructure/config/env.config';
import { UserRole } from '../../../users/domain/value-objects/user-role';
import {
  REFRESH_TOKEN_TYPE,
  TokenPayload,
} from '../../application/ports/token-service.port';

export interface RequestUser {
  id: string;
  username: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).secret,
    });
  }

  validate(payload: TokenPayload & { type?: string }): RequestUser {
    // Access y refresh comparten secreto y se distinguen por el claim
    // `type`. Sin este chequeo un refresh token sirve como credencial de
    // acceso a toda la API.
    if (payload.type === REFRESH_TOKEN_TYPE) {
      throw new UnauthorizedException('Token inválido');
    }
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role as UserRole,
    };
  }
}
