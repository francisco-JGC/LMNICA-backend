import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { UseCase } from '../../../../shared/application/use-case';
import {
  USERS_REPOSITORY,
  type UsersRepository,
} from '../../../users/domain/repositories/users.repository';
import type { RefreshOutput } from '../dtos/auth.output';
import { TOKEN_SERVICE, type TokenService } from '../ports/token-service.port';

export interface RefreshAccessTokenInput {
  refreshToken: string;
}

/**
 * Exchange a valid refresh JWT for a fresh access token. Verifies the
 * refresh token signature + expiry, reloads the user (to catch role
 * changes and deactivations that happened since login), and issues a
 * new short-lived access token.
 */
@Injectable()
export class RefreshAccessToken
  implements UseCase<RefreshAccessTokenInput, RefreshOutput>
{
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    @Inject(USERS_REPOSITORY) private readonly users: UsersRepository,
  ) {}

  async execute(input: RefreshAccessTokenInput): Promise<RefreshOutput> {
    let payload;
    try {
      payload = await this.tokens.verifyRefresh(input.refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      // Deleted mid-session — force re-login.
      throw new UnauthorizedException('Usuario no encontrado');
    }
    if (!user.isActive) {
      throw new ForbiddenException(
        'Tu acceso a la app fue restringido. Contacta a un administrador.',
      );
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.tokens.sign({
        sub: user.id,
        username: user.username,
        role: user.role,
      }),
      this.tokens.signRefresh(user.id),
    ]);

    return { accessToken, refreshToken };
  }
}
