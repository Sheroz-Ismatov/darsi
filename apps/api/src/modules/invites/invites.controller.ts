import { Body, Controller, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import {
  acceptInviteRequestSchema,
  schoolCodeSchema,
  type AcceptInviteRequest,
  type AcceptInviteResponse,
  type JoinSchoolResponse,
} from '@darsi/shared';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { CurrentUser, type AuthUser } from '../auth/auth.decorators';
import { InvitesService } from './invites.service';

/** Any signed-in user; no X-School-Id: the school comes from the token or the code. */
@Controller()
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Post('invites/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Body(new ZodValidationPipe(acceptInviteRequestSchema)) body: AcceptInviteRequest,
    @CurrentUser() user: AuthUser,
  ): Promise<AcceptInviteResponse> {
    return this.invites.accept(user.id, body.token);
  }

  @Post('schools/by-code/:code/join')
  async join(
    @Param('code', new ZodValidationPipe(schoolCodeSchema)) code: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<JoinSchoolResponse> {
    const result = await this.invites.joinByCode(user.id, code);
    res.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return result;
  }
}
