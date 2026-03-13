import { useSearch } from "@tanstack/react-router";

export function useSearchableParams() {
  return useSearch({ strict: false });
}
