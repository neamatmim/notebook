import { env } from "@notebook/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
// import { Pool } from "pg";
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL!,
// });
// const db = drizzle({ client: pool });
export const db = drizzle(env.DATABASE_URL, { schema, casing: "snake_case" });
