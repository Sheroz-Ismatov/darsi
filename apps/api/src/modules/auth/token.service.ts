import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface AccessTokenPayload {
  sub: string;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const unauthorized = (code: string, message: string) => new AppError(code, message, 401);

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  issueAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId } satisfies AccessTokenPayload);
  }

  async verifyAccessToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      return payload.sub;
    } catch {
      throw unauthorized('ACCESS_TOKEN_INVALID', 'Access token is invalid or expired');
    }
  }

  /** Returns the raw token; only its SHA-256 hash is stored. */
  async createRefreshToken(
    userId: string,
    userAgent: string | undefined,
    familyId: string = randomUUID(),
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        familyId,
        userAgent: userAgent?.slice(0, 512),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return token;
  }

  /**
   * Single-use rotation. Presenting an already rotated token means it leaked:
   * the whole family is revoked and the user has to sign in again.
   */
  async rotateRefreshToken(
    token: string,
    userAgent: string | undefined,
  ): Promise<{ userId: string; refreshToken: string }> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!stored) {
      throw unauthorized('REFRESH_TOKEN_INVALID', 'Refresh token is invalid');
    }
    if (stored.expiresAt <= new Date()) {
      throw unauthorized('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired');
    }

    // Atomic claim: of two concurrent rotations only one wins.
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count === 0) {
      await this.revokeFamily(stored.familyId);
      throw unauthorized('REFRESH_TOKEN_REUSED', 'Refresh token was already used');
    }

    const refreshToken = await this.createRefreshToken(stored.userId, userAgent, stored.familyId);
    return { userId: stored.userId, refreshToken };
  }

  /** Logout: revokes the token's family; unknown tokens are ignored. */
  async revokeByToken(token: string): Promise<void> {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { familyId: true },
    });
    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
