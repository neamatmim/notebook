import { toCurrency } from "@notebook/utils/currency.formatter";
import type { ColumnDef } from "@tanstack/react-table";

export function cellCurrencyColumn<T>(options: ColumnDef<T>): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const amount = getValue<string>();
      const formatted = toCurrency(Number(amount));
      return <div className="text-right font-mono">{formatted}</div>;
    },
    // meta: {
    //   className: "text-right justify-end",
    // },
    ...options,
  };
}
