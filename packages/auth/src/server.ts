import { db } from "@notebook/db";
import { env } from "@notebook/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";

export const auth = betterAuth({
  appName: "Notebook",
  // baseURL: "https://example.com",
  database: drizzleAdapter(db, {
    provider: "pg",
    // usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    // disableSignUp: false,
    // autoSignIn: false
  },
  // emailVerification: {
  // 	sendVerificationEmail: async ({ user, url, token }) => {
  // 		// Send verification email to user
  // 	},
  // 	sendOnSignUp: true,
  // 	autoSignInAfterVerification: true,
  // 	expiresIn: 3600 // 1 hour
  // },
  plugins: [tanstackStartCookies(), admin()],
  trustedOrigins: [env.CORS_ORIGIN],
});
