import type { ColumnDef } from "@tanstack/react-table";
import { TABLE_CELL_PLACEHOLDER } from "@workspace/constants";
import { Button } from "@workspace/ui/components/button";
import { Flex } from "@workspace/ui/components/flex";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Text } from "@workspace/ui/components/text";
import { isEmpty } from "es-toolkit/compat";

export function cellSeeMoreColumn<T>({
  mapKeys = { value: "value", id: "id" },
  visibleCount = 1,
  ...options
}: ColumnDef<T> & {
  mapKeys: { value: string; id: string };
  visibleCount?: number;
}): ColumnDef<T> {
  return {
    enableSorting: false,
    size: 380,
    cell: ({ getValue }) => {
      const value = getValue<[]>();
      if (isEmpty(value)) {
        return <span className="px-2">{TABLE_CELL_PLACEHOLDER}</span>;
      }

      const visibleItems = value.slice(0, visibleCount);
      const remainingItems = value.slice(visibleCount);

      return (
        <Flex className="inline-flex flex-wrap gap-x-1">
          {visibleItems.map((item) => (
            <Text
              className="whitespace-normal after:content-[','] last:after:content-['']"
              key={item[mapKeys.id]}
            >
              {item[mapKeys.value]}
            </Text>
          ))}
          {!!remainingItems.length && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  className="size-auto max-w-full flex-col whitespace-normal px-1.5 py-0.5 text-left"
                  variant="ghost"
                >
                  <Text>+{remainingItems.length}</Text>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" className="min-w-80">
                <Flex className="w-full flex-col items-start gap-y-2">
                  {remainingItems.map((item) => (
                    <Text
                      className="font-normal text-content text-sm"
                      key={item[mapKeys.id]}
                    >
                      {item[mapKeys.value]}
                    </Text>
                  ))}
                </Flex>
              </PopoverContent>
            </Popover>
          )}
        </Flex>
      );
    },
    ...options,
  };
}
