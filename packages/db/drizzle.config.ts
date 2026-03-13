import { env } from "@notebook/env/server";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: "../../apps/web/.env",
});

export default defineConfig({
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  dialect: "postgresql",
  // casing: "snake_case",
  out: "./src/migrations",
  schema: "./src/schema",
});
