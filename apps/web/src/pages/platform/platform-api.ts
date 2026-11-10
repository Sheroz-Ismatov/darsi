import type {
  CreatePlanRequest,
  CreateSchoolRequest,
  OwnerInviteResponse,
  PlanDto,
  PlatformSchoolDto,
  UpdatePlanRequest,
  UpdateSchoolRequest,
} from '@darsi/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';

const PLATFORM = ['platform'] as const;
const SCHOOLS = [...PLATFORM, 'schools'] as const;
const PLANS = [...PLATFORM, 'plans'] as const;

const send = <T>(method: 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const useSchools = () =>
  useQuery({
    queryKey: SCHOOLS,
    queryFn: () => apiFetch<PlatformSchoolDto[]>('/platform/schools'),
  });

export const usePlans = () =>
  useQuery({ queryKey: PLANS, queryFn: () => apiFetch<PlanDto[]>('/platform/plans') });

/** Schools show their plan and plans count their schools, so every change refreshes both lists. */
function usePlatformMutation<Input, Output>(mutationFn: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // Not awaited: dialogs close on the server's answer, the lists refresh in the background.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: PLATFORM }),
  });
}

export const useCreateSchool = () =>
  usePlatformMutation((data: CreateSchoolRequest) =>
    send<PlatformSchoolDto>('POST', '/platform/schools', data),
  );

export const useUpdateSchool = () =>
  usePlatformMutation(({ id, ...data }: UpdateSchoolRequest & { id: string }) =>
    send<PlatformSchoolDto>('PATCH', `/platform/schools/${id}`, data),
  );

export const useIssueOwnerInvite = () =>
  usePlatformMutation((schoolId: string) =>
    send<OwnerInviteResponse>('POST', `/platform/schools/${schoolId}/owner-invite`),
  );

export const useSavePlan = () =>
  usePlatformMutation(({ id, ...data }: CreatePlanRequest & { id?: string }) =>
    id
      ? send<PlanDto>('PATCH', `/platform/plans/${id}`, data satisfies UpdatePlanRequest)
      : send<PlanDto>('POST', '/platform/plans', data),
  );
