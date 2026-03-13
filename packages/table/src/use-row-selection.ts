import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { isFunction } from "es-toolkit/compat";
import { useState } from "react";

export function useRowSelection<T>(data: T[] | undefined, isLoading?: boolean) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedRows, setSelectedRowIds] = useState<NonNullable<T>[]>([]);

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = (
    updaterOrValue
  ) => {
    const newSelection = isFunction(updaterOrValue)
      ? updaterOrValue(rowSelection)
      : updaterOrValue;

    setRowSelection(newSelection);

    // Only update selected rows if data is available
    if (!data || isLoading) {
      // Clear selection if data is not available or still loading
      setSelectedRowIds([]);
      return;
    }

    const selectedDataIds = Object.keys(newSelection)
      .filter((key) => newSelection[key])
      .map((index) => {
        const numIndex = Number.parseInt(index, 10);
        // Safely access the data array
        return numIndex < data.length ? data[numIndex] : undefined;
      })
      .filter(
        (row): row is NonNullable<T> => row !== undefined && row !== null
      );

    setSelectedRowIds(selectedDataIds);
  };

  return {
    selectedRows,
    rowSelection,
    onRowSelectionChange,
  };
}
