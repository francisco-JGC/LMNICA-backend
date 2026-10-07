export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenPayload {
  sub: string;
  username: string;
  role: string;
}

/**
 * Valor del claim `type` que marca un refresh token. Access y refresh se
 * firman con el mismo secreto, así que este discriminador es lo único que
 * los separa: sin él un refresh token (30d de vida) pasaría como
 * credencial de acceso. Vive acá para que emisor y verificadores compartan
 * literalmente el mismo valor.
 */
export const REFRESH_TOKEN_TYPE = 'refresh';

export interface RefreshTokenPayload {
  sub: string;
  type: typeof REFRESH_TOKEN_TYPE;
}

export interface TokenService {
  sign(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
  /** Long-lived token whose only purpose is minting new access tokens. */
  signRefresh(userId: string): Promise<string>;
  verifyRefresh(token: string): Promise<RefreshTokenPayload>;
}
