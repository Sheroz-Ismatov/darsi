import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { TenantFixture } from './tenant-fixture';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface IsolatedEndpoint {
  method: Method;
  /** Path relative to the API prefix; a function may embed ids of records that belong to school A. */
  path: string | ((fixture: TenantFixture) => string);
  /** Test title; defaults to the path when it is a plain string. */
  label?: string;
  body?: (fixture: TenantFixture) => object;
  /**
   * True when the path points at a record of school A: then a member of school B,
   * acting in their own school, must get 404 for it as well.
   */
  targetsSchoolARecord?: boolean;
}

/**
 * The one-line isolation suite every school-scoped module adds (IMPLEMENTATION_PLAN.md T-08):
 *
 *   describeSchoolIsolation('courses', () => ({ app, fixture }), [{ method: 'get', path: '/courses' }]);
 */
export function describeSchoolIsolation(
  name: string,
  context: () => { app: INestApplication; fixture: TenantFixture },
  endpoints: IsolatedEndpoint[],
): void {
  describe(`school isolation: ${name}`, () => {
    for (const endpoint of endpoints) {
      const shownPath =
        endpoint.label ?? (typeof endpoint.path === 'string' ? endpoint.path : '<record of A>');
      const label = `${endpoint.method.toUpperCase()} ${shownPath}`;

      const send = (auth: string, schoolId?: string) => {
        const { app, fixture } = context();
        const path = typeof endpoint.path === 'string' ? endpoint.path : endpoint.path(fixture);
        let req = request(app.getHttpServer())
          [endpoint.method](`/api/v1${path}`)
          .set('Authorization', auth);
        if (schoolId) req = req.set('X-School-Id', schoolId);
        if (endpoint.body) req = req.send(endpoint.body(fixture));
        return req;
      };

      it(`${label}: requires X-School-Id`, async () => {
        const { schoolA } = context().fixture;
        const res = await send(schoolA.owner.auth);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('SCHOOL_ID_REQUIRED');
      });

      it(`${label}: owner of school B cannot act inside school A`, async () => {
        const { schoolA, schoolB } = context().fixture;
        const res = await send(schoolB.owner.auth, schoolA.id);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('SCHOOL_NOT_FOUND');
      });

      it(`${label}: superadmin has no implicit access to school data`, async () => {
        const { schoolA, superadmin } = context().fixture;
        const res = await send(superadmin.auth, schoolA.id);
        expect(res.status).toBe(404);
      });

      if (endpoint.targetsSchoolARecord) {
        it(`${label}: a record of school A is invisible from school B`, async () => {
          const { schoolB } = context().fixture;
          const res = await send(schoolB.owner.auth, schoolB.id);
          expect(res.status).toBe(404);
        });
      }
    }
  });
}
