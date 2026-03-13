// import { personalizationMutation } from "@workspace/api/personalization/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notebook/ui/components/select";
// import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { Table } from "@tanstack/react-table";
// import { toast } from "sonner";

interface TablePageSizeProps<TData> {
  table: Table<TData>;
  pageSizeOptions: string[];
  // personalizedKey?: string;
}

export function TablePageSize<TData>({
  table,
  pageSizeOptions,
  // personalizedKey,
}: Readonly<TablePageSizeProps<TData>>) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  // const { mutate } = useMutation(
  //   personalizationMutation.create.mutation({
  //     onSuccess: ({ message }) => {
  //       toast.success(message);
  //     },
  //     onError: (error) => {
  //       toast.error(error.response.data.message);
  //     },
  //   })
  // );
  function onValueChange(value: string) {
    navigate({
      search: {
        ...searchParams,
        limit: value,
        page: undefined,
      },
    });
    // if (personalizedKey) {
    //   mutate({
    //     dataset: personalizedKey,
    //     limit: Number(value),
    //   });
    // }
  }
  return (
    <div className="hidden shrink-0 items-center gap-2 sm:flex">
      <p className="font-medium text-sm">Rows per page</p>
      <Select
        onValueChange={(value) => {
          if (!value) {
            return;
          }
          table.setPageSize(Number(value));
          onValueChange(value);
        }}
        value={table.getState().pagination.pageSize.toString()}
      >
        <SelectTrigger className="h-8 w-auto border border-ghost bg-ghost-surface shadow-none">
          <SelectValue placeholder="Set Row Per Page Size" />
        </SelectTrigger>
        <SelectContent className="min-w-18">
          {pageSizeOptions.map((pageSizeCount) => (
            <SelectItem key={pageSizeCount} value={pageSizeCount.toString()}>
              {pageSizeCount}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
