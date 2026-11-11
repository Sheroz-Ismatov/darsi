import type {
  CreateStaffRequest,
  InviteLinkResponse,
  StaffListResponse,
  StaffMemberDto,
  UpdateStaffRequest,
} from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../app/auth/session';
import { apiFetch } from '../../lib/api';

/** Keyed by school for the same reason as the school query (app/school.ts). */
const staffKey = (schoolId: string | undefined) => ['staff', schoolId] as const;

const send = <T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export function useStaff() {
  const schoolId = useSession().school?.id;
  return useQuery({
    queryKey: staffKey(schoolId),
    queryFn: () => apiFetch<StaffListResponse>('/staff'),
    enabled: schoolId !== undefined,
  });
}

/**
 * Every change moves the seat counter or an invite date, so the list is refetched. The returned
 * promise keeps the mutation pending until then: dialogs close onto an up-to-date list.
 */
function useStaffMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  const schoolId = useSession().school?.id;
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKey(schoolId) }),
  });
}

export const useCreateStaff = () =>
  useStaffMutation((data: CreateStaffRequest) => send<StaffMemberDto>('POST', '/staff', data));

export const useUpdateStaff = () =>
  useStaffMutation(({ id, ...data }: UpdateStaffRequest & { id: string }) =>
    send<StaffMemberDto>('PATCH', `/staff/${id}`, data),
  );

export const useIssueStaffInvite = () =>
  useStaffMutation((id: string) => send<InviteLinkResponse>('POST', `/staff/${id}/invite`));
