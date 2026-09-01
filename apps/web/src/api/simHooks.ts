import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "./client.js";
import type { SimStateDTO } from "./types.js";

const SIM_STATE_KEY = ["sim-state"];

export function useSimState() {
  return useQuery({
    queryKey: SIM_STATE_KEY,
    queryFn: () => apiGet<SimStateDTO>("/api/sim/state"),
    refetchInterval: 2000,
  });
}

/** Every mutation refetches sim state on success — this is a dev tool, not a hot path. */
function useSimMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SIM_STATE_KEY });
    },
  });
}

export function useDepositIdr() {
  return useSimMutation((input: { userId: string; amount: string }) =>
    apiPost("/api/sim/deposit-idr", input),
  );
}

export function useWithdrawIdr() {
  return useSimMutation((input: { userId: string; amount: string }) =>
    apiPost("/api/sim/withdraw-idr", input),
  );
}

export function useBuy() {
  return useSimMutation(
    (input: { userId: string; coinId: string; idrAmount: string; price: string }) =>
      apiPost("/api/sim/buy", input),
  );
}

export function useSell() {
  return useSimMutation(
    (input: { userId: string; coinId: string; coinAmount: string; price: string }) =>
      apiPost("/api/sim/sell", input),
  );
}

export function useBulkGenerate() {
  return useSimMutation(
    (input: {
      count: number;
      hours: number;
      buyBias: number;
      coinIds?: string[];
      idrAmountMin?: number;
      idrAmountMax?: number;
    }) => apiPost("/api/sim/bulk", input),
  );
}

export function useTimeAdvance() {
  return useSimMutation((input: { ms: number }) => apiPost("/api/sim/time/advance", input));
}

export function useTimeSet() {
  return useSimMutation((input: { timestamp: string }) => apiPost("/api/sim/time/set", input));
}

export function useClosePeriod() {
  return useSimMutation(() => apiPost("/api/sim/period/close"));
}

export function useSetFxRate() {
  return useSimMutation((input: { rateIdrPerUsd: string }) => apiPost("/api/sim/fx", input));
}

export function useSetLpState() {
  return useSimMutation(
    (input: {
      id?: string;
      name: string;
      usdtHeld: string;
      usdtAllocated: string;
      coverage: string[];
    }) => apiPost("/api/sim/lp", input),
  );
}

export function useSetGateAsset() {
  return useSimMutation((input: { coinId: string; amount: string }) =>
    apiPost("/api/sim/gate-assets", input),
  );
}

export function useSetWithdrawalVault() {
  return useSimMutation((input: { amount: string }) => apiPost("/api/sim/withdrawal-vault", input));
}

export function useSeedScenario() {
  return useSimMutation((name: string) => apiPost(`/api/sim/scenario/${name}`));
}

export function useResetSim() {
  return useSimMutation(() => apiPost("/api/sim/reset"));
}
