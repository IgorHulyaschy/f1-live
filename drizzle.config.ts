/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./dist/infra/db/schemas/schemas.js",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});