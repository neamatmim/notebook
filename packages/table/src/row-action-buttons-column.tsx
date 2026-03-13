import type { ColumnDef } from "@tanstack/react-table";
// import { Can } from "@workspace/permission/provider";
// import { Button } from "@workspace/ui/components/button";
// import { cx } from "@workspace/ui/lib/cva";
// import Link from "next/link";

// // type RowActionConfig<T> = {
// // 	title: string;
// // 	icon: React.ComponentType;
// // 	onClick?: (data: T) => () => void;
// // 	href?: string | ((data: T) => string);
// // };

// // Base type for common properties
// type RowActionConfig<T> = {
//   title: string;
//   onClick?: (data: T) => () => void;
//   href?: string | ((data: T) => string);
//   icon?: React.ComponentType;
//   accessorKey?: string | string[];
//   component?: React.ReactNode | ((data: T) => React.ReactNode);
// };

// export function rowActionButtonsColumn<T>(
//   configs: RowActionConfig<T>[],
//   options?: Partial<ColumnDef<T>>,
// ): ColumnDef<T> {
//   return {
//     id: "actions",
//     enableHiding: false,
//     cell: ({ row }) => {
//       const data = row.original;
//       return (
//         <div className="flex justify-end gap-2 pr-2">
//           {configs.map((config) => {
//             if (config.accessorKey) {
//               return (
//                 <Can a={config.accessorKey} I="create" key={config.title}>
//                   <RenderComponent config={config} data={data} />
//                 </Can>
//               );
//             }
//             return (
//               <RenderComponent config={config} data={data} key={config.title} />
//             );
//           })}
//         </div>
//       );
//     },
//     ...options,
//   };
// }

// function RenderComponent<T>({
//   config,
//   data,
// }: {
//   config: RowActionConfig<T>;
//   data: T;
// }) {
//   if (config.component) {
//     return (
//       <div key={config.title}>
//         {typeof config.component === "function"
//           ? config.component(data)
//           : config.component}
//       </div>
//     );
//   }
//   if (config.href) {
//     const href =
//       typeof config.href === "function" ? config.href(data) : config.href;
//     return (
//       <Button
//         asChild
//         className={cx(config.icon && "size-9")}
//         key={href}
//         size={config.icon ? "icon" : "default"}
//         variant="outline"
//       >
//         <Link href={href} title={config.title}>
//           {config.icon ? <config.icon /> : config.title}
//         </Link>
//       </Button>
//     );
//   }
//   return (
//     <Button
//       className={cx(config.icon && "size-9")}
//       key={config.title}
//       onClick={config?.onClick?.(data)}
//       size={config.icon ? "icon" : "default"}
//       title={config.title}
//       variant="outline"
//     >
//       {config.icon ? <config.icon /> : config.title}
//     </Button>
//   );
// }

export function rowActionsColumn<T>(options: ColumnDef<T>) {
  return {
    id: "actions",
    enableHiding: false,
    ...options,
  };
}
