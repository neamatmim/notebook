// import { IconCheck, IconCirclePlus } from "@tabler/icons-react";
import type { Column } from "@tanstack/react-table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@workspace/ui/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover";
import { Separator } from "@workspace/ui/components/separator";
import { cx } from "@workspace/ui/lib/cva";
import { Check, CirclePlus } from "lucide-react";

interface TableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

export function TableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: TableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set(column?.getFilterValue() as string[]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="h-8 border-dashed" size="sm" variant="outline">
          <CirclePlus className="mr-2 size-4" />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator className="mx-2 h-4" orientation="vertical" />
              <Badge
                className="rounded-sm px-1 font-normal lg:hidden"
                variant="secondary"
              >
                {selectedValues.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedValues.size > 2 ? (
                  <Badge
                    className="rounded-sm px-1 font-normal"
                    variant="secondary"
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        className="rounded-sm px-1 font-normal"
                        key={option.value}
                        variant="secondary"
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value);
                      } else {
                        selectedValues.add(option.value);
                      }
                      const filterValues = [...selectedValues];
                      column?.setFilterValue(
                        filterValues.length ? filterValues : undefined
                      );
                    }}
                  >
                    <div
                      className={cx(
                        "mr-2 flex size-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="size-4" />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 size-4 text-content-subtle" />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className="ml-auto flex size-4 items-center justify-center font-sans text-xs">
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    className="justify-center text-center"
                    onSelect={() => column?.setFilterValue(undefined)}
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// 'use client';

// import { searchParams } from '@/lib/searchparams';
// import { useQueryState } from 'nuqs';
// import { useCallback, useMemo } from 'react';

// export const CATEGORY_OPTIONS = [
//   { value: 'Electronics', label: 'Electronics' },
//   { value: 'Furniture', label: 'Furniture' },
//   { value: 'Clothing', label: 'Clothing' },
//   { value: 'Toys', label: 'Toys' },
//   { value: 'Groceries', label: 'Groceries' },
//   { value: 'Books', label: 'Books' },
//   { value: 'Jewelry', label: 'Jewelry' },
//   { value: 'Beauty Products', label: 'Beauty Products' }
// ];
// export function useProductTableFilters() {
//   const [searchQuery, setSearchQuery] = useQueryState(
//     'q',
//     searchParams.q
//       .withOptions({ shallow: false, throttleMs: 1000 })
//       .withDefault('')
//   );

//   const [categoriesFilter, setCategoriesFilter] = useQueryState(
//     'categories',
//     searchParams.categories.withOptions({ shallow: false }).withDefault('')
//   );

//   const [page, setPage] = useQueryState(
//     'page',
//     searchParams.page.withDefault(1)
//   );

//   const resetFilters = useCallback(() => {
//     setSearchQuery(null);
//     setCategoriesFilter(null);

//     setPage(1);
//   }, [setSearchQuery, setCategoriesFilter, setPage]);

//   const isAnyFilterActive = useMemo(() => {
//     return !!searchQuery || !!categoriesFilter;
//   }, [searchQuery, categoriesFilter]);

//   return {
//     searchQuery,
//     setSearchQuery,
//     page,
//     setPage,
//     resetFilters,
//     isAnyFilterActive,
//     categoriesFilter,
//     setCategoriesFilter
//   };
// }
