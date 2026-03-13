import type { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import { Flex } from "@workspace/ui/components/flex";
import { cx } from "@workspace/ui/lib/cva";
import { RefreshCwIcon } from "lucide-react";

import { TableViewOptions } from "./table-view-options";

interface TableToolbarProps<TData> {
  table: Table<TData>;
  totalCount: number;
  personalizedKey?: string;
  onSyncClick: () => void;
  toolbarActions?: (table: Table<TData>) => React.ReactNode;
  isLoading: boolean;
}

export function TableToolbar<TData>({
  table,
  totalCount,
  personalizedKey,
  onSyncClick,
  toolbarActions,
  isLoading,
}: TableToolbarProps<TData>) {
  return (
    <Flex className="justify-between">
      <span className="font-medium font-sans text-content text-sm capitalize sm:whitespace-nowrap">
        {Number(totalCount) > 0 ? totalCount : "No"} results found
      </span>

      <Flex className="gap-2">
        {toolbarActions?.(table)}
        <Button
          onClick={onSyncClick}
          size="icon"
          title="Refresh Table Data"
          type="button"
          variant="secondary"
        >
          <RefreshCwIcon
            className={cx("size-4", {
              "animate-spin": isLoading,
            })}
          />
        </Button>
        {personalizedKey && (
          <TableViewOptions personalizedKey={personalizedKey} table={table} />
        )}
      </Flex>
    </Flex>
  );
}
