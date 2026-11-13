import type {
  AddGuardianRequest,
  CreateStudentRequest,
  EnrollmentDto,
  EnrollStudentRequest,
  InviteLinkResponse,
  LeaveEnrollmentRequest,
  StudentDetailDto,
  StudentGuardianChangeResponse,
  StudentListResponse,
  TransferEnrollmentRequest,
  UpdateStudentRequest,
} from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/auth/session';
import { apiFetch } from '../../lib/api';

/** Keyed by school for the same reason as the school query (app/school.ts). */
const studentsKey = (schoolId: string | undefined) => ['students', schoolId] as const;

const send = <T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface StudentsQuery {
  search?: string;
  courseId?: string;
  groupId?: string;
  archived?: boolean;
  page?: number;
}

export function useStudents(query: StudentsQuery, options: { enabled?: boolean } = {}) {
  const schoolId = useSession().school?.id;
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.courseId) params.set('courseId', query.courseId);
  if (query.groupId) params.set('groupId', query.groupId);
  if (query.archived) params.set('archived', 'true');
  if (query.page && query.page > 1) params.set('page', String(query.page));
  return useQuery({
    queryKey: [...studentsKey(schoolId), 'list', params.toString()],
    queryFn: () => apiFetch<StudentListResponse>(`/students?${params.toString()}`),
    enabled: schoolId !== undefined && (options.enabled ?? true),
    // Typing in the search keeps the previous rows on screen; never across schools.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === schoolId ? previous : undefined,
  });
}

export function useStudent(id: string) {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: [...studentsKey(schoolId), 'detail', id],
    queryFn: () => apiFetch<StudentDetailDto>(`/students/${id}`),
    enabled: schoolId !== undefined,
    retry: false,
  });
}

/**
 * A student change shows up in the list, the card and the seat counters of groups and courses,
 * so all of them are refetched before the mutation settles.
 */
function useStudentMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  const schoolId = useSession().school?.id;
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: studentsKey(schoolId) }),
        queryClient.invalidateQueries({ queryKey: ['groups', schoolId] }),
        queryClient.invalidateQueries({ queryKey: ['courses', schoolId] }),
      ]),
  });
}

export const useCreateStudent = () =>
  useStudentMutation((data: CreateStudentRequest) =>
    send<StudentGuardianChangeResponse>('POST', '/students', data),
  );

export const useUpdateStudent = () =>
  useStudentMutation(({ id, ...data }: UpdateStudentRequest & { id: string }) =>
    send<StudentDetailDto>('PATCH', `/students/${id}`, data),
  );

export const useArchiveStudent = () =>
  useStudentMutation(({ id, archived }: { id: string; archived: boolean }) =>
    send<StudentDetailDto>('POST', `/students/${id}/${archived ? 'archive' : 'unarchive'}`),
  );

export const useAddGuardian = () =>
  useStudentMutation(({ studentId, ...data }: AddGuardianRequest & { studentId: string }) =>
    send<StudentGuardianChangeResponse>('POST', `/students/${studentId}/guardians`, data),
  );

export const useRemoveGuardian = () =>
  useStudentMutation(({ studentId, guardianId }: { studentId: string; guardianId: string }) =>
    send<StudentDetailDto>('DELETE', `/students/${studentId}/guardians/${guardianId}`),
  );

/** A new link shows its expiry in the card, so the student is refetched too. */
export const useIssueGuardianInvite = () =>
  useStudentMutation(({ studentId, guardianId }: { studentId: string; guardianId: string }) =>
    send<InviteLinkResponse>('POST', `/students/${studentId}/invite`, { guardianId }),
  );

export const useEnroll = () =>
  useStudentMutation(({ studentId, ...data }: EnrollStudentRequest & { studentId: string }) =>
    send<EnrollmentDto>('POST', `/students/${studentId}/enrollments`, data),
  );

export const useLeaveEnrollment = () =>
  useStudentMutation(({ id, ...data }: LeaveEnrollmentRequest & { id: string }) =>
    send<EnrollmentDto>('POST', `/enrollments/${id}/leave`, data),
  );

export const useTransferEnrollment = () =>
  useStudentMutation(({ id, ...data }: TransferEnrollmentRequest & { id: string }) =>
    send<EnrollmentDto>('POST', `/enrollments/${id}/transfer`, data),
  );
