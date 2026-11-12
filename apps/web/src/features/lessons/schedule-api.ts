import type {
  LessonDto,
  PutScheduleRulesRequest,
  PutScheduleRulesResponse,
  ScheduleRuleDto,
} from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/auth/session';
import { apiFetch } from '../../lib/api';

/** Keyed by school for the same reason as the school query (app/school.ts). */
const rulesKey = (schoolId: string | undefined, groupId: string) =>
  ['schedule-rules', schoolId, groupId] as const;
const lessonsKey = (schoolId: string | undefined) => ['lessons', schoolId] as const;

export function useScheduleRules(groupId: string) {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: rulesKey(schoolId, groupId),
    queryFn: () => apiFetch<ScheduleRuleDto[]>(`/groups/${groupId}/schedule-rules`),
    enabled: schoolId !== undefined,
  });
}

/** Dates `from…to` are in the school's time zone, as the API reads them. */
export function useLessons(query: { from: string; to: string; groupId?: string }) {
  const schoolId = useSession().school?.id;
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.groupId) params.set('groupId', query.groupId);
  return useQuery({
    queryKey: [...lessonsKey(schoolId), query],
    queryFn: () => apiFetch<LessonDto[]>(`/lessons?${params.toString()}`),
    enabled: schoolId !== undefined,
  });
}

/** Saving rules regenerates lessons, so every lesson list of the school is refetched. */
export function useSaveScheduleRules(groupId: string) {
  const queryClient = useQueryClient();
  const schoolId = useSession().school?.id;
  return useMutation({
    mutationFn: (data: PutScheduleRulesRequest) =>
      apiFetch<PutScheduleRulesResponse>(`/groups/${groupId}/schedule-rules`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(rulesKey(schoolId, groupId), result.rules);
      return queryClient.invalidateQueries({ queryKey: lessonsKey(schoolId) });
    },
  });
}
