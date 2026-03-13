import { useNavigate, useSearch } from "@tanstack/react-router";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { isFunction } from "es-toolkit/compat";

const REMOVE_MINUS = /^-/;
export function useSorting() {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  const field = searchParams.sort;
  let sorting: SortingState = [];
  if (field) {
    sorting = [
      {
        id: field.replace(REMOVE_MINUS, ""),
        desc: field.startsWith("-"),
      },
    ];
  }
  const onSortingChange: OnChangeFn<SortingState> = (updaterOrValue) => {
    const [sort] = isFunction(updaterOrValue)
      ? updaterOrValue(sorting)
      : updaterOrValue;
    if (!sort) {
      return;
    }
    navigate({
      search: {
        ...searchParams,
        sort: sort.desc ? `-${sort.id}` : sort.id,
        page: undefined,
      },
    });
  };
  return {
    sorting,
    onSortingChange,
  };
}
