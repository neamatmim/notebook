import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@workspace/ui/components/badge";
import { cn } from "@workspace/ui/lib/utils";
// import { type ColorMapType, getColorMap } from "@workspace/utils/color";
import { startCase } from "es-toolkit/compat";

export function cellStatusColumn<T>({
  colors,
  ...options
}: ColumnDef<T> & {
  colors: Record<string, string>;
}): ColumnDef<T> {
  return {
    cell: ({ getValue }) => {
      const value = getValue<string>();
      if (!value) {
        return "--";
      }
      const color = colors[value];
      return (
        <Badge
          className={cn(color, options.meta?.cellClassName)}
          // color={color}
          // shape="pill"
        >
          {startCase(value)}
        </Badge>
      );
    },
    size: 180,
    ...options,
  };
}
