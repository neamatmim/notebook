import {
  PaginationEllipsis,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@notebook/ui/components/pagination";
import { useNavigate, useSearch } from "@tanstack/react-router";
import type { Table } from "@tanstack/react-table";
import RCPagination from "rc-pagination";

interface TablePageIndexProps<TData> {
  table: Table<TData>;
}

export function TablePageIndex<TData>({
  table,
}: Readonly<TablePageIndexProps<TData>>) {
  const navigate = useNavigate();
  const searchParams = useSearch({ strict: false });
  function onValueChange(value: string) {
    navigate({
      search: {
        ...searchParams,
        page: value,
      },
    });
  }
  // <div className="hidden shrink-0 items-center gap-2 sm:flex">
  return (
    <nav
      aria-label="pagination"
      // className={cn("mx-auto flex w-full justify-center", className)}
      data-slot="pagination"
    >
      <RCPagination
        align="center"
        className="flex items-center gap-1"
        current={table.getState().pagination.pageIndex}
        itemRender={(current, type, element) => {
          if (type === "page") {
            return (
              <PaginationLink
                className="w-auto min-w-9 px-2"
                isActive={current === table.getState().pagination.pageIndex}
              >
                {current}
              </PaginationLink>
            );
          }
          return element;
        }}
        jumpNextIcon={<PaginationEllipsis />}
        jumpPrevIcon={<PaginationEllipsis />}
        locale={{
          next_page: "Next Page",
          prev_page: "Previous Page",
        }}
        // defaultPageSize={table.getState().pagination.pageSize}
        // hideOnSinglePage={true}
        nextIcon={<PaginationNext />}
        onChange={(page) => {
          table.setPageIndex(page);
          onValueChange(page.toString());
        }}
        pageSize={table.getState().pagination.pageSize}
        // pageSizeOptions={pageSizeOptions}
        prevIcon={<PaginationPrevious />}
        total={table.getRowCount()}
      />
    </nav>
  );
}
