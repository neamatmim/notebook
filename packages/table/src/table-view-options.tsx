import { useMutation } from "@tanstack/react-query";
import type { Table } from "@tanstack/react-table";
import { personalizationMutation } from "@workspace/api/personalization/client";
import { Button } from "@workspace/ui/components/button";
import { Checkbox } from "@workspace/ui/components/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Spinner } from "@workspace/ui/components/spinner";
import { startCase } from "es-toolkit/compat";
import { Settings2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface TableViewOptionsProps<TData> {
  table: Table<TData>;
  personalizedKey: string;
}

export function TableViewOptions<TData>({
  table,
  personalizedKey,
}: TableViewOptionsProps<TData>) {
  const [open, setOpen] = useState(false);

  const { mutate, isPending } = useMutation(
    personalizationMutation.create.mutation({
      onSuccess: ({ message }) => {
        toast.success(message);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.response.data.message);
      },
    })
  );
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary">
          <Settings2Icon className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 flex w-full flex-col overflow-hidden rounded-md border bg-popover p-0 text-popover-foreground shadow-md [--anchor-gap:4px] data-[state=closed]:animate-out data-[state=open]:animate-in md:w-[440px]"
      >
        {/* getAllLeafColumns */}
        <ScrollArea className="h-60">
          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
            {table
              .getAllColumns()
              .filter(
                (column) =>
                  column.accessorFn !== undefined &&
                  column.getCanHide()
              )
              .map((column) => (
                  <div
                    className="flex shrink-0 cursor-default select-none items-start space-x-2 rounded-sm text-sm capitalize outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    key={column.id}
                    // className={cn(
                    //       "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    //       className
                    //     )}
                  >
                    <Checkbox
                      checked={column.getIsVisible()}
                      className="mt-px"
                      id={column.id}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    />
                    <label htmlFor={column.id}>
                      {typeof column.columnDef.header === "string"
                        ? column.columnDef.header
                        : startCase(column.id)}
                    </label>
                  </div>
                ))}
          </div>
        </ScrollArea>
        <div className="flex w-full justify-end gap-2 border-t p-4">
          <Button
            className="rounded-sm px-3 font-medium shadow-none"
            disabled={table.getIsAllColumnsVisible()}
            onClick={() => table.toggleAllColumnsVisible(true)}
            size="xs"
            type="button"
          >
            Select All
          </Button>
          <Button
            className="rounded-sm px-3 font-medium"
            onClick={() => table.toggleAllColumnsVisible(false)}
            size="xs"
            type="button"
            variant="outline"
          >
            Select None
          </Button>
          <Button
            className="rounded-sm px-3 font-medium"
            disabled={isPending}
            onClick={() => {
              const visibility = table.getState().columnVisibility;
              mutate({
                dataset: personalizedKey,
                columns: Object.keys(visibility).filter((k) => !visibility[k]),
              });
            }}
            size="xs"
            type="button"
          >
            {isPending && <Spinner />}
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
