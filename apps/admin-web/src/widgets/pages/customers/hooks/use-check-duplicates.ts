import { useMutation } from "@tanstack/react-query";
import type { DuplicateCandidate } from "@/shared/types/customers";

interface CheckDuplicatesInput {
  name: string;
  contacts?: { value: string }[];
  excludeId?: string;
}

export function useCheckDuplicates() {
  return useMutation({
    mutationFn: async (input: CheckDuplicatesInput): Promise<DuplicateCandidate[]> => {
      const res = await fetch("/api/customers/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data ?? [];
    },
  });
}
