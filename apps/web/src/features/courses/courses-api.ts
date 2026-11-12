import type {
  CourseDto,
  CreateCourseRequest,
  CreateGroupRequest,
  GroupDto,
  StaffListResponse,
  UpdateCourseRequest,
  UpdateGroupRequest,
} from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/auth/session';
import { apiFetch } from '../../lib/api';

/** Keyed by school for the same reason as the school query (app/school.ts). */
const coursesKey = (schoolId: string | undefined) => ['courses', schoolId] as const;
const groupsKey = (schoolId: string | undefined) => ['groups', schoolId] as const;

const send = <T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export function useCourses(archived: boolean) {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: [...coursesKey(schoolId), { archived }],
    queryFn: () => apiFetch<CourseDto[]>(`/courses?archived=${archived}`),
    enabled: schoolId !== undefined,
  });
}

export function useGroup(id: string) {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: [...groupsKey(schoolId), id],
    queryFn: () => apiFetch<GroupDto>(`/groups/${id}`),
    enabled: schoolId !== undefined,
    retry: false,
  });
}

/** Teachers a group can get: deactivated ones are left out (T-15, decision 6). */
export function useTeachers() {
  const schoolId = useSession().school?.id;
  return useQuery({
    // Under the staff key, so staff changes refresh this list too.
    queryKey: ['staff', schoolId, { role: 'teacher' }],
    queryFn: () => apiFetch<StaffListResponse>('/staff?role=teacher'),
    enabled: schoolId !== undefined,
    select: (data) => data.items.filter((member) => member.status !== 'deactivated'),
  });
}

/**
 * A course and its groups show up on both pages, so any change refetches both. The returned
 * promise keeps the mutation pending until then: dialogs close onto fresh data.
 */
function useCatalogMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  const schoolId = useSession().school?.id;
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: coursesKey(schoolId) }),
        queryClient.invalidateQueries({ queryKey: groupsKey(schoolId) }),
        // Archiving and new group dates regenerate lessons on the server.
        queryClient.invalidateQueries({ queryKey: ['lessons', schoolId] }),
      ]),
  });
}

export const useCreateCourse = () =>
  useCatalogMutation((data: CreateCourseRequest) => send<CourseDto>('POST', '/courses', data));

export const useUpdateCourse = () =>
  useCatalogMutation(({ id, ...data }: UpdateCourseRequest & { id: string }) =>
    send<CourseDto>('PATCH', `/courses/${id}`, data),
  );

export const useArchiveCourse = () =>
  useCatalogMutation(({ id, archived }: { id: string; archived: boolean }) =>
    send<CourseDto>('POST', `/courses/${id}/${archived ? 'archive' : 'unarchive'}`),
  );

export const useDeleteCourse = () =>
  useCatalogMutation((id: string) => send<void>('DELETE', `/courses/${id}`));

export const useCreateGroup = () =>
  useCatalogMutation((data: CreateGroupRequest) => send<GroupDto>('POST', '/groups', data));

export const useUpdateGroup = () =>
  useCatalogMutation(({ id, ...data }: UpdateGroupRequest & { id: string }) =>
    send<GroupDto>('PATCH', `/groups/${id}`, data),
  );

export const useArchiveGroup = () =>
  useCatalogMutation(({ id, archived }: { id: string; archived: boolean }) =>
    send<GroupDto>('POST', `/groups/${id}/${archived ? 'archive' : 'unarchive'}`),
  );
