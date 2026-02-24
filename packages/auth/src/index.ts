import { db } from "@notebook/db";
import * as schema from "@notebook/db/schema/auth";
import { env } from "@notebook/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    tanstackStartCookies(),
    organization({
      sendInvitationEmail: async (_invitation) => {
        // Email sending not configured — invite link can be shared manually.
        // Implement with your email provider (e.g. Resend, Nodemailer) here.
      },
    }),
  ],
  trustedOrigins: [env.CORS_ORIGIN],
});
