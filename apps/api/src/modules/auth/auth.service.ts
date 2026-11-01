import { Inject, Injectable } from '@nestjs/common';
import type { MeResponse, TelegramLoginRequest } from '@darsi/shared';
import type { User } from '@prisma/client';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  TelegramSignatureError,
  verifyInitData,
  verifyLoginWidget,
  type TelegramUserData,
} from './telegram-signature';
import { ACCESS_TOKEN_TTL_SECONDS, TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

const STAFF_WEB_ROLES = ['owner', 'admin'] as const;

function signatureError(error: unknown): never {
  if (error instanceof TelegramSignatureError) {
    throw error.reason === 'EXPIRED'
      ? new AppError('TELEGRAM_AUTH_EXPIRED', 'Telegram authorization data is too old', 401)
      : new AppError('TELEGRAM_AUTH_INVALID', 'Telegram authorization data is invalid', 401);
  }
  throw error;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  /** Mini App: every launch exchanges fresh initData for an access token (no refresh token). */
  async loginWithInitData(
    initData: string,
  ): Promise<{ accessToken: string; expiresIn: number; startParam: string | null }> {
    let verified;
    try {
      verified = verifyInitData(initData, this.env.BOT_TOKEN);
    } catch (error) {
      signatureError(error);
    }
    const user = await this.upsertTelegramUser(verified.user);
    return {
      accessToken: await this.tokens.issueAccessToken(user.id),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      startParam: verified.startParam,
    };
  }

  /** Web panel: only superadmins and active owners/admins may sign in (TZ FR-3). */
  async loginWithWidget(
    data: TelegramLoginRequest,
    userAgent: string | undefined,
  ): Promise<IssuedTokens> {
    let verified;
    try {
      verified = verifyLoginWidget(data, this.env.BOT_TOKEN);
    } catch (error) {
      signatureError(error);
    }

    const user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(verified.user.id) },
      include: {
        memberships: {
          where: { status: 'active', role: { in: [...STAFF_WEB_ROLES] } },
          select: { id: true },
        },
      },
    });
    if (!user || (!user.isSuperadmin && user.memberships.length === 0)) {
      throw new AppError('NO_WEB_ACCESS', 'This account has no access to the admin panel', 403);
    }

    await this.upsertTelegramUser(verified.user);
    return this.issueSession(user.id, userAgent);
  }

  /** Development only: sign in as any Telegram id without a signature. */
  async devLogin(
    telegramId: number,
    firstName: string,
    userAgent: string | undefined,
  ): Promise<IssuedTokens> {
    const user = await this.upsertTelegramUser({ id: telegramId, first_name: firstName });
    return this.issueSession(user.id, userAgent);
  }

  async refresh(refreshToken: string, userAgent: string | undefined): Promise<IssuedTokens> {
    const rotated = await this.tokens.rotateRefreshToken(refreshToken, userAgent);
    return {
      accessToken: await this.tokens.issueAccessToken(rotated.userId),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: rotated.refreshToken,
    };
  }

  logout(refreshToken: string): Promise<void> {
    return this.tokens.revokeByToken(refreshToken);
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: { not: 'deactivated' } },
          include: { school: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) {
      throw new AppError('UNAUTHORIZED', 'User no longer exists', 401);
    }
    return {
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        locale: user.locale,
        isSuperadmin: user.isSuperadmin,
      },
      memberships: user.memberships.map((m) => ({
        id: m.id,
        schoolId: m.schoolId,
        schoolName: m.school.name,
        role: m.role,
        status: m.status,
      })),
    };
  }

  private async issueSession(userId: string, userAgent: string | undefined): Promise<IssuedTokens> {
    return {
      accessToken: await this.tokens.issueAccessToken(userId),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken: await this.tokens.createRefreshToken(userId, userAgent),
    };
  }

  /** Keeps the profile in sync with Telegram; the language is taken only on first sign-in. */
  private upsertTelegramUser(data: TelegramUserData): Promise<User> {
    const profile = {
      firstName: data.first_name,
      lastName: data.last_name ?? null,
      username: data.username ?? null,
      lastSeenAt: new Date(),
    };
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(data.id) },
      update: profile,
      create: {
        ...profile,
        telegramId: BigInt(data.id),
        locale: data.language_code === 'tg' ? 'tg' : 'ru',
      },
    });
  }
}
