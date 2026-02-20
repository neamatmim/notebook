import type { RouterClient } from "@orpc/server";

import { publicProcedure } from "../index";
import { accountingRouter } from "./accounting";
import { inventoryRouter } from "./inventory";
import { investmentRouter } from "./investment";
import { posRouter } from "./pos";

export const appRouter = {
  accounting: accountingRouter,
  healthCheck: publicProcedure.handler(() => "OK"),
  inventory: inventoryRouter,
  investment: investmentRouter,
  pos: posRouter,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
