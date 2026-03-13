import { Button } from "@notebook/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@notebook/ui/components/empty";
import { Flex } from "@notebook/ui/components/flex";
import { ScrollArea, ScrollBar } from "@notebook/ui/components/scroll-area";
import { Skeleton } from "@notebook/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notebook/ui/components/table";
// import { NotFoundIcon } from "@notebook/ui/icons/not-found";
import { cn } from "@notebook/ui/lib/utils";
import { useSearch } from "@tanstack/react-router";
import type {
  Column,
  ColumnPinningState,
  Header,
  RowSelectionState,
  Table as TableInstance,
  TableOptions,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  // getExpandedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { isEmpty, range } from "es-toolkit/compat";
import {
  ArrowDownUp,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  RefreshCw,
} from "lucide-react";

import { getPinningStyles } from "./styles";
import { TablePageIndex } from "./table-page-index";
import { TablePageSize } from "./table-page-size";
import { TableToolbar } from "./table-toolbar";
import { useSorting } from "./use-sorting";

interface DataTableProps<TData> extends Omit<
  TableOptions<TData>,
  "getCoreRowModel" | "data"
> {
  data: TData[] | undefined;
  totalCount: number | undefined;
  pageSizeOptions?: string[];
  pageSize: number | undefined;
  isLoading: boolean;
  personalizedKey?: string;
  columnVisibility?: string[] | undefined;
  columnPinning?: ColumnPinningState;
  className?: string;
  toolbarActions?: (table: TableInstance<TData>) => React.ReactNode;
  onSyncClick: () => void;
  rowSelection?: RowSelectionState;
  // expandable?: boolean
}

function getPinningShadow<T>(column: Column<T>) {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  if (isFirstRightPinnedColumn) {
    return "after:content-[''] after:absolute after:left-0 after:top-0 after:h-full after:w-px after:bg-ghost after:shadow-[-1px_0px_3px_0px_rgba(0,0,0,0.16),_-1px_0px_2px_-1px_rgba(0,0,0,0.16)]";
  }
  if (isLastLeftPinnedColumn) {
    return "after:content-[''] after:absolute after:right-0 after:top-0 after:h-full after:w-px after:bg-ghost after:shadow-[1px_0px_3px_0px_rgba(0,0,0,0.16),1px_0px_2px_-1px_rgba(0,0,0,0.16)]";
  }
  return null;
}
const fallback: unknown[] = [];
export function DataTable<TData>({
  columns,
  data,
  totalCount = 0,
  pageSizeOptions = ["10", "20", "30", "40", "50", "75", "100"],
  pageSize,
  personalizedKey,
  columnVisibility,
  toolbarActions,
  rowSelection,
  isLoading,
  className,
  onSyncClick,
  columnPinning,
  ...props
}: Readonly<DataTableProps<TData>>) {
  // const {
  // pagination,
  // onPaginationChange,
  //   sorting,
  //   onSortingChange,
  //   // columnFilters,
  //   // onColumnFiltersChange,
  //   // expanded,
  //   // onExpandedChange,
  // } = useTableControl({});
  // console.log(pagination, personalizedProps);
  // This will not cause an infinite loop of re-renders because `columns` is a stable reference
  // const columns = useMemo(() => [
  //     // ...
  //   ], []);
  // This will not cause an infinite loop of re-renders because `data` is a stable reference
  // const [data, setData] = useState(() => [
  //     // ...
  //   ]);
  const searchParams = useSearch({
    strict: false,
  });
  const pageIndex = searchParams.page ?? 1;
  const { sorting, onSortingChange } = useSorting();
  const table = useReactTable({
    // defaultColumn: {
    //   minSize: 100,
    // },
    data: data ?? (fallback as TData[]),
    columns,
    getCoreRowModel: getCoreRowModel(),
    rowCount: totalCount,
    autoResetPageIndex: true,
    enableMultiSort: false,
    enableSortingRemoval: false,

    // onStateChange: () => {
    //   table.resetRowSelection();
    // },
    // mergeOptions: ({}) => {
    //   const x = false;
    //   return {};
    // },

    // onColumnVisibilityChange: setColumnVisibility,
    // onRowSelectionChange: setRowSelection,
    // ==============================
    // manualSorting: true,
    // onColumnFiltersChange,
    onSortingChange,
    // onPaginationChange,
    // onExpandedChange,
    initialState: {
      columnPinning: {
        right: ["actions"],
        ...columnPinning,
      },
      // sorting: [
      //   {
      //     id: "name",
      //     desc: true, // sort by name in descending order by default
      //   },
      // ],
      ...(columnVisibility && {
        columnVisibility: Object.fromEntries(
          columnVisibility.map((column) => [column, false])
        ),
      }),
    },
    state: {
      sorting,
      ...(rowSelection && {
        rowSelection,
      }),
      pagination: {
        pageIndex: Number(pageIndex),
        pageSize: pageSize ?? Number(pageSizeOptions[0]),
      },
      //   // columnFilters,
      //   columnPinning: {
      //     right: ["actions"],
      //   },
      //   // expanded,
      //   // columnVisibility,
    },
    debugTable: true,
    ...props,
  });
  // console.log(table.getState(), pageSize, "table");
  const notFound = isEmpty(table.getRowModel().rows) && !isLoading;

  return (
    <div className={cn("grid w-full gap-5", className)}>
      <TableToolbar
        isLoading={isLoading}
        onSyncClick={onSyncClick}
        personalizedKey={personalizedKey}
        table={table}
        toolbarActions={toolbarActions}
        totalCount={totalCount}
      />
      {/* <div className="w-full border-ghost border-x"> */}
      <ScrollArea className="w-full overflow-hidden">
        <Table
          style={{
            width: table.getTotalSize(),
          }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="hover:bg-transparent" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    className={cn(
                      header.column.columnDef.meta?.className,
                      getPinningShadow(header.column)
                    )}
                    colSpan={header.colSpan}
                    key={header.id}
                    style={getPinningStyles(header.column)}
                  >
                    {header.isPlaceholder ? null : (
                      <ColumnHeader header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <TableBodyContent
              colSpan={columns.length}
              isLoading={isLoading}
              table={table}
            />
          </TableBody>
          {/* <TableFooter>
          {table.getFooterGroups().map((footerGroup) => (
            <TableRow key={footerGroup.id}>
              {footerGroup.headers.map((header) => {
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    // style={getPinningStyles(header.column)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.footer,
                          header.getContext(),
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableFooter> */}
        </Table>
        {notFound && <div className="block h-2" />}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      {/* </div> */}

      {notFound && (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia>
              {/* <NotFoundIcon className="size-60" /> */}
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={onSyncClick} size="sm" variant="outline">
              <RefreshCw
                className={cn("size-4", {
                  "animate-spin": isLoading,
                })}
              />
              Refetch
            </Button>
          </EmptyContent>
        </Empty>
      )}
      <Flex className="justify-between">
        <TablePageSize
          pageSizeOptions={pageSizeOptions}
          personalizedKey={personalizedKey}
          table={table}
        />
        <TablePageIndex table={table} />
      </Flex>
    </div>
  );
}

interface TableBodyContentProps<TData> {
  colSpan: number;
  isLoading: boolean;
  table: TableInstance<TData>;
}
function TableBodyContent<TData>({
  isLoading,
  table,
}: Readonly<TableBodyContentProps<TData>>) {
  if (isLoading) {
    return range(table.getState().pagination.pageSize).map((row) => (
      <TableRow className="border-ghost border-b" key={row}>
        {table.getVisibleFlatColumns().map((column) => (
          <TableCell
            className={cn(column.columnDef.meta?.className)}
            key={column.id}
          >
            <Skeleton className="h-5 rounded-lg py-4" />
          </TableCell>
        ))}
      </TableRow>
    ));
  }
  return table.getRowModel().rows.map((row) => (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      key={row.id}
      // className={row.getIsSelected() ? 'selected' : null}
      // onClick={row.getToggleSelectedHandler()}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell
          className={cn(
            "relative bg-background",
            cell.column.columnDef.meta?.className,
            cell.column.columnDef.meta?.cellClassName,
            getPinningShadow(cell.column)
            // cell.column.getIsPinned() ? "bg-table-header" : "bg-background"
          )}
          key={cell.id}
          style={getPinningStyles(cell.column)}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  ));
}

interface ColumnHeaderProps<
  TData,
  TValue,
> extends React.HTMLAttributes<HTMLButtonElement> {
  header: Header<TData, TValue>;
}

const SORTING_UI_INDICATOR_ICON_MAP = {
  asc: ArrowUpWideNarrow,
  desc: ArrowDownWideNarrow,
  false: ArrowDownUp,
};
function ColumnHeader<TData, TValue>({
  header,
}: Readonly<ColumnHeaderProps<TData, TValue>>) {
  if (!header.column.getCanSort()) {
    return flexRender(header.column.columnDef.header, header.getContext());
  }
  const SortingUIIndicator =
    SORTING_UI_INDICATOR_ICON_MAP[
      header.column.getIsSorted() as keyof typeof SORTING_UI_INDICATOR_ICON_MAP
    ];
  // console.log(header.column.getNextSortingOrder());
  return (
    <button
      className={cn(
        "flex w-full cursor-pointer select-none items-center justify-start gap-2 font-sans font-semibold text-[13px] uppercase tracking-wide",
        header.column.columnDef.meta?.className
      )}
      onClick={header.column.getToggleSortingHandler()}
      title={
        {
          asc: "Sort ascending",
          desc: "Sort descending",
          false: "Clear sort",
        }[header.column.getNextSortingOrder() as string]
      }
      type="button"
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
      <SortingUIIndicator className="ml-2 size-4 shrink-0 text-content" />
    </button>
  );
}

// function Footer(table) {
//     const footers = table
//         .getFooterGroups()
//         .map((group) => group.headers.map((header) => header.column.columnDef.footer))
//         .flat()
//         .filter(Boolean);

//     if (footers.length === 0) return;

//     return (
//         <tfoot>
//             {table.getFooterGroups().map((footerGroup) => (
//                 <tr key={footerGroup.id}>
//                     {footerGroup.headers.map((header) => (
//                         <th key={header.id}>
//                             {header.isPlaceholder
//                                 ? null
//                                 : flexRender(header.column.columnDef.footer, header.getContext())}
//                         </th>
//                     ))}
//                 </tr>
//             ))}
//         </tfoot>
//     );
// }

// {props.loadingMode === 'skeleton' && isLoading && pagination?.pageSize ? (
//           Array.from({ length: pagination.pageSize }).map((_, rowIndex) => (
//             <DataGridTableBodyRowSkeleton key={rowIndex}>
//               {table.getVisibleFlatColumns().map((column, colIndex) => {
//                 return (
//                   <DataGridTableBodyRowSkeletonCell column={column} key={colIndex}>
//                     {column.columnDef.meta?.skeleton}
//                   </DataGridTableBodyRowSkeletonCell>
//                 );
//               })}
//             </DataGridTableBodyRowSkeleton>
//           ))
//         ) : table.getRowModel().rows.length ? (
//           table.getRowModel().rows.map((row: Row<TData>, index) => {
//             return (
//               <Fragment key={row.id}>
//                 <DataGridTableBodyRow row={row} key={index}>
//                   {row.getVisibleCells().map((cell: Cell<TData, unknown>, colIndex) => {
//                     return (
//                       <DataGridTableBodyRowCell cell={cell} key={colIndex}>
//                         {flexRender(cell.column.columnDef.cell, cell.getContext())}
//                       </DataGridTableBodyRowCell>
//                     );
//                   })}
//                 </DataGridTableBodyRow>
//                 {row.getIsExpanded() && <DataGridTableBodyRowExpandded row={row} />}
//               </Fragment>
//             );
//           })
//         ) : (
//           <DataGridTableEmpty />
//         )}

// placeholderData: keepPreviousData,
