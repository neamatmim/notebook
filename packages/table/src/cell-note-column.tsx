import type { ColumnDef } from "@tanstack/react-table";
import { noteMutation } from "@workspace/api/note/client";
import { Form } from "@workspace/block/note/form";
import { View } from "@workspace/block/note/view";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Separator } from "@workspace/ui/components/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet";
import { FilePlus, FileText } from "lucide-react";
export function cellNoteColumn<T extends { id: string | number }>({
  module,
  invalidateQueryKeys,
  ...options
}: ColumnDef<T> & {
  module: string;
  invalidateQueryKeys?: string[];
}): ColumnDef<T> {
  return {
    cell: ({ row, getValue }) => {
      const { id } = row.original;
      const value = getValue<string>();

      return (
        <Sheet>
          <SheetTrigger asChild>
            <Button className="text-primary" size="sm" variant="ghost">
              {value ? (
                <>
                  <FileText />
                  {value}
                </>
              ) : (
                <>
                  <FilePlus />
                  Add note
                </>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="overflow-y-auto pb-4">
            <SheetHeader className="pb-0">
              <SheetTitle>
                <Badge>ID: {id}</Badge>
              </SheetTitle>
              <SheetDescription className="sr-only">
                It can be used to keep track of important information or to
                remind yourself of something.
              </SheetDescription>
            </SheetHeader>
            <Separator />
            <div className="px-4">
              <Form
                invalidateQueryKeys={invalidateQueryKeys}
                module={module}
                mutationOptions={noteMutation.create.mutation({})}
                param={id.toString()}
              />
            </div>
            <Separator />
            <View
              className="grid-cols-1 px-4"
              invalidateQueryKeys={invalidateQueryKeys}
              module={module}
              param={id.toString()}
            />
          </SheetContent>
        </Sheet>
      );
    },
    size: 150,
    enableSorting: false,
    ...options,
  };
}
