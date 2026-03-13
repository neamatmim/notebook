import type { ColumnDef } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { CopyToClipboard } from "@workspace/ui/components/copy-to-clipboard";

export function cellCopyToClipboardColumn<T>({
  formatter = (value) => value,
  ...options
}: ColumnDef<T> & {
  formatter?: (value: string) => string;
}): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const value = getValue<string>();
      if (!value) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }
      return <CopyToClipboard value={formatter(value)} />;
    },
    size: 150,
    enableSorting: false,
    ...options,
  };
}
