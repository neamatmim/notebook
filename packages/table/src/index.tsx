import { Button } from "@notebook/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notebook/ui/components/empty";
import { Flex } from "@notebook/ui/components/flex";
import { Skeleton } from "@notebook/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notebook/ui/components/table";
import { cn } from "@notebook/ui/lib/utils";
// import { cn } from "@notebook/ui/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  TableOptions,
  Table as TableInstance,
} from "@tanstack/react-table";
import { range } from "es-toolkit";
import { RefreshCw } from "lucide-react";

import { TablePageIndex } from "./table-page-index";
import { TablePageSize } from "./table-page-size";
interface DataTableProps<TData> extends Omit<
  TableOptions<TData>,
  "getCoreRowModel" | "data"
> {
  data: TData[] | undefined;
  totalCount?: number;
  pageSizeOptions?: string[];
  // pageSize: number | undefined;
  isLoading: boolean;
  emptyMessage?: string;
  // personalizedKey?: string;
  // columnVisibility?: string[] | undefined;
  // columnPinning?: ColumnPinningState;
  className?: string;
  // toolbarActions?: (table: TableInstance<TData>) => React.ReactNode;
  // onSyncClick: () => void;
  // rowSelection?: RowSelectionState;
  // expandable?: boolean
}
const fallback: unknown[] = [];
export function DataTable<TData>({
  data,
  columns,
  isLoading,
  emptyMessage,
  totalCount = 0,
  pageSizeOptions = ["10", "20", "30", "40", "50", "75", "100"],
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data: data ?? (fallback as TData[]),
    columns,
    getCoreRowModel: getCoreRowModel(),
    rowCount: totalCount,
    autoResetPageIndex: true,
  });
  return (
    <div className={cn("grid w-full gap-4", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  // className={cn(
                  //   header.column.columnDef.meta?.className,
                  //   getPinningShadow(header.column)
                  // )}
                  className={header.column.columnDef.meta?.className}
                  colSpan={header.colSpan}
                  key={header.id}
                  // style={getPinningStyles(header.column)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          <TableContent
            table={table}
            isLoading={isLoading}
            emptyMessage={emptyMessage}
          />
        </TableBody>
      </Table>
      <Flex className="justify-between">
        <TablePageSize
          pageSizeOptions={pageSizeOptions}
          // personalizedKey={personalizedKey}
          table={table}
        />
        <TablePageIndex table={table} />
      </Flex>
    </div>
  );
}

function TableContent<TData>({
  table,
  isLoading,
  emptyMessage,
}: {
  table: TableInstance<TData>;
  isLoading: boolean;
  emptyMessage?: string;
}) {
  if (isLoading) {
    return range(table.getState().pagination.pageSize).map((rowCount) => (
      <TableRow key={rowCount}>
        {table.getVisibleFlatColumns().map((column) => (
          <TableCell key={column.id}>
            <Skeleton />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  if (!table.getRowModel().rows.length) {
    // onClick={onSyncClick}
    return (
      <TableRow>
        <TableCell colSpan={table.getVisibleFlatColumns().length}>
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia>
                {/* <NotFoundIcon className="size-60" /> */}
              </EmptyMedia>
              <EmptyTitle>{emptyMessage ?? "No results found"}</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" variant="outline">
                <RefreshCw
                  className={cn("size-4", {
                    "animate-spin": isLoading,
                  })}
                />
                Refetch
              </Button>
            </EmptyContent>
          </Empty>
        </TableCell>
      </TableRow>
    );
  }
  return table.getRowModel().rows.map((row) => (
    <TableRow key={row.id}>
      {row.getVisibleCells().map((cell) => (
        <TableCell
          key={cell.id}
          className={cn(
            cell.column.columnDef.meta?.className,
            cell.column.columnDef.meta?.cellClassName
          )}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

// colSpan={columns.length}
