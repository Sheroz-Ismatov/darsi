import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  devLoginRequestSchema,
  telegramLoginRequestSchema,
  tmaAuthRequestSchema,
  type AuthTokenResponse,
  type DevLoginRequest,
  type MeResponse,
  type TelegramLoginRequest,
  type TmaAuthRequest,
  type TmaAuthResponse,
} from '@darsi/shared';
import type { Request, Response } from 'express';
import { API_PREFIX } from '../../app.setup';
import { ENV } from '../../common/config/config.module';
import type { Env } from '../../common/config/env';
import { AppError } from '../../common/errors/app-error';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, Public, type AuthUser } from './auth.decorators';
import { AuthService, type IssuedTokens } from './auth.service';
import { REFRESH_TOKEN_TTL_MS } from './token.service';

export const REFRESH_COOKIE = 'darsi_rt';
const REFRESH_COOKIE_PATH = `/${API_PREFIX}/auth`;

@Controller()
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly auth: AuthService,
  ) {}

  @Public()
  @Post('auth/tma')
  @HttpCode(HttpStatus.OK)
  loginTma(
    @Body(new ZodValidationPipe(tmaAuthRequestSchema)) body: TmaAuthRequest,
  ): Promise<TmaAuthResponse> {
    return this.auth.loginWithInitData(body.initData);
  }

  @Public()
  @Post('auth/telegram-login')
  @HttpCode(HttpStatus.OK)
  async loginWeb(
    @Body(new ZodValidationPipe(telegramLoginRequestSchema)) body: TelegramLoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    return this.startSession(res, await this.auth.loginWithWidget(body, req.get('user-agent')));
  }

  @Public()
  @Post('auth/dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(
    @Body(new ZodValidationPipe(devLoginRequestSchema)) body: DevLoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    // Invisible unless explicitly enabled; env validation forbids it in production.
    if (!this.env.AUTH_DEV_BYPASS) throw new NotFoundException();
    const tokens = await this.auth.devLogin(body.telegramId, body.firstName, req.get('user-agent'));
    return this.startSession(res, tokens);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const token = this.readRefreshCookie(req);
    if (!token) {
      throw new AppError('REFRESH_TOKEN_MISSING', 'No refresh token', 401);
    }
    try {
      return this.startSession(res, await this.auth.refresh(token, req.get('user-agent')));
    } catch (error) {
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      throw error;
    }
  }

  @Public()
  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = this.readRefreshCookie(req);
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }

  private readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /** Refresh token lives only in an httpOnly cookie scoped to /auth; the body carries the access token. */
  private startSession(res: Response, tokens: IssuedTokens): AuthTokenResponse {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: this.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_TTL_MS,
    });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  }
}
