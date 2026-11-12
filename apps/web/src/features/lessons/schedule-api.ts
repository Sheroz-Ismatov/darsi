import type {
  CancelLessonRequest,
  CreateLessonRequest,
  LessonChangeResponse,
  LessonDetailDto,
  LessonDto,
  PutScheduleRulesRequest,
  PutScheduleRulesResponse,
  RescheduleLessonRequest,
  ScheduleRuleDto,
  UpdateLessonRequest,
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

export interface LessonsQuery {
  /** Dates in the school's time zone, as the API reads them. */
  from: string;
  to: string;
  groupId?: string;
  teacherId?: string;
  courseId?: string;
}

export function useLessons(query: LessonsQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSession().school?.id;
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value) params.set(name, value);
  }
  return useQuery({
    queryKey: [...lessonsKey(schoolId), 'list', params.toString()],
    queryFn: () => apiFetch<LessonDto[]>(`/lessons?${params.toString()}`),
    enabled: schoolId !== undefined && (options.enabled ?? true),
    // A new week keeps the previous one on screen until it arrives, so the grid does not jump;
    // never across schools, or the old school's lessons would flash in the new one.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === schoolId ? previous : undefined,
  });
}

export function useLesson(id: string) {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: [...lessonsKey(schoolId), 'detail', id],
    queryFn: () => apiFetch<LessonDetailDto>(`/lessons/${id}`),
    enabled: schoolId !== undefined,
    retry: false,
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

/**
 * A changed lesson shows up in the calendar, the group's upcoming list and its own card, so
 * every lesson query of the school is refetched before the mutation settles.
 */
function useLessonMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  const schoolId = useSession().school?.id;
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lessonsKey(schoolId) }),
  });
}

const send = <T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> =>
  apiFetch<T>(path, { method, body: JSON.stringify(body) });

export const useCreateLesson = () =>
  useLessonMutation((data: CreateLessonRequest) =>
    send<LessonChangeResponse>('POST', '/lessons', data),
  );

export const useCancelLesson = (id: string) =>
  useLessonMutation((data: CancelLessonRequest) =>
    send<LessonDetailDto>('POST', `/lessons/${id}/cancel`, data),
  );

export const useRescheduleLesson = (id: string) =>
  useLessonMutation((data: RescheduleLessonRequest) =>
    send<LessonChangeResponse>('POST', `/lessons/${id}/reschedule`, data),
  );

export const useUpdateLesson = (id: string) =>
  useLessonMutation((data: UpdateLessonRequest) =>
    send<LessonChangeResponse>('PATCH', `/lessons/${id}`, data),
  );
