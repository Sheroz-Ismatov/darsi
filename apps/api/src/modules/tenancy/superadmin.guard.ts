import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.decorators';

/** Platform endpoints (/platform/*): Darsi team only. Checked against the database on every call. */
@Injectable()
export class SuperadminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { isSuperadmin: true },
    });
    if (!user?.isSuperadmin) {
      throw new AppError('FORBIDDEN', 'Superadmin access required', 403);
    }
    return true;
  }
}
