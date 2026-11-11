import type { SchoolDto, UpdateSchoolSettingsRequest } from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { useSession } from './auth/session';

/**
 * Keyed by the school id: switching schools only removes cached queries, and an open page
 * keeps showing what it has until its key changes.
 */
const schoolKey = (schoolId: string | undefined) => ['school', schoolId] as const;

/** The current school: time zone for schedules, currency for money (GET /school, owner and admin). */
export function useSchool() {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: schoolKey(schoolId),
    queryFn: () => apiFetch<SchoolDto>('/school'),
    enabled: schoolId !== undefined,
    staleTime: 5 * 60 * 1000,
  });
}

/** PATCH /school (owner only); the answer replaces the cached school. */
export function useUpdateSchoolSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSchoolSettingsRequest) =>
      apiFetch<SchoolDto>('/school', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (school) => queryClient.setQueryData(schoolKey(school.id), school),
  });
}
