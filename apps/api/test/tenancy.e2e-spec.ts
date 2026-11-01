import { Controller, Get, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import type { SchoolContext } from '../src/modules/tenancy/tenancy.constants';
import {
  CurrentSchool,
  SchoolRoles,
  SuperadminOnly,
} from '../src/modules/tenancy/tenancy.decorators';
import { createTestApp, hasTestDb } from './helpers/test-app';
import { describeSchoolIsolation } from './isolation/describe-school-isolation';
import { createTenantFixture, type TenantFixture } from './isolation/tenant-fixture';

/** Probe endpoints mounted only in this suite to exercise the guards. */
@Controller('tenancy-probe')
class TenancyProbeController {
  @Get('members')
  @SchoolRoles()
  members(@CurrentSchool() school: SchoolContext): SchoolContext {
    return school;
  }

  @Get('management')
  @SchoolRoles('owner', 'admin')
  management(@CurrentSchool() school: SchoolContext): SchoolContext {
    return school;
  }

  @Get('platform')
  @SuperadminOnly()
  platform(): { ok: true } {
    return { ok: true };
  }
}

describe.skipIf(!hasTestDb)('tenancy guards (e2e)', () => {
  let app: INestApplication;
  let fixture: TenantFixture;
  const get = (path: string, auth: string, schoolId?: string) => {
    const req = request(app.getHttpServer())
      .get(`/api/v1/tenancy-probe/${path}`)
      .set('Authorization', auth);
    return schoolId ? req.set('X-School-Id', schoolId) : req;
  };

  beforeAll(async () => {
    app = await createTestApp({ controllers: [TenancyProbeController] });
    fixture = await createTenantFixture(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describeSchoolIsolation('probe', () => ({ app, fixture }), [
    { method: 'get', path: '/tenancy-probe/members' },
    { method: 'get', path: '/tenancy-probe/management' },
  ]);

  it('resolves the school and all roles of a member', async () => {
    const { schoolA } = fixture;
    const res = await get('members', schoolA.teacher.auth, schoolA.id).expect(200);
    expect(res.body).toEqual({ schoolId: schoolA.id, roles: ['teacher'] });
  });

  it('collects several roles of one person in the same school', async () => {
    const { schoolA } = fixture;
    await app.get(PrismaService).membership.create({
      data: {
        schoolId: schoolA.id,
        userId: schoolA.teacher.userId,
        role: 'parent',
        displayName: 'teacher+parent',
        status: 'active',
      },
    });
    const res = await get('members', schoolA.teacher.auth, schoolA.id).expect(200);
    expect([...res.body.roles].sort()).toEqual(['parent', 'teacher']);
  });

  it('applies the role list: owner and admin pass, teacher and parent do not', async () => {
    const { schoolA } = fixture;
    await get('management', schoolA.owner.auth, schoolA.id).expect(200);
    await get('management', schoolA.admin.auth, schoolA.id).expect(200);
    const parent = await get('management', schoolA.parent.auth, schoolA.id).expect(403);
    expect(parent.body.error.code).toBe('FORBIDDEN_ROLE');
    await get('management', schoolA.teacher.auth, schoolA.id).expect(403);
  });

  it('treats a deactivated member as a stranger', async () => {
    const { schoolB } = fixture;
    await app.get(PrismaService).membership.updateMany({
      where: { schoolId: schoolB.id, userId: schoolB.admin.userId },
      data: { status: 'deactivated' },
    });
    const res = await get('members', schoolB.admin.auth, schoolB.id).expect(404);
    expect(res.body.error.code).toBe('SCHOOL_NOT_FOUND');
  });

  it('blocks every member of a blocked school', async () => {
    const prisma = app.get(PrismaService);
    const { schoolB } = fixture;
    await prisma.school.update({ where: { id: schoolB.id }, data: { status: 'blocked' } });
    const res = await get('members', schoolB.owner.auth, schoolB.id).expect(403);
    expect(res.body.error.code).toBe('SCHOOL_BLOCKED');
    await prisma.school.update({ where: { id: schoolB.id }, data: { status: 'active' } });
  });

  it('rejects a malformed school id', async () => {
    const res = await get('members', fixture.schoolA.owner.auth, 'not-a-uuid').expect(400);
    expect(res.body.error.code).toBe('SCHOOL_ID_REQUIRED');
  });

  it('opens platform endpoints to superadmins only', async () => {
    await get('platform', fixture.superadmin.auth).expect(200);
    const owner = await get('platform', fixture.schoolA.owner.auth).expect(403);
    expect(owner.body.error.code).toBe('FORBIDDEN');
    await get('platform', fixture.outsider.auth).expect(403);
  });
});
