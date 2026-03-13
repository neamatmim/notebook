/**
 * Interactive CLI to create an admin user.
 *
 * Usage (from packages/db):
 *   bun run create-admin
 */

export function createAdmin() {
  console.log("create admin");
}
// import "dotenv/config";
// import { randomBytes, scrypt } from "node:crypto";
// import { createInterface } from "node:readline";
// import { promisify } from "node:util";
// import postgres from "postgres";

// const scryptAsync = promisify(scrypt);

// // ── helpers ───────────────────────────────────────────────────────────────────

// function ask(
//   rl: ReturnType<typeof createInterface>,
//   question: string
// ): Promise<string> {
//   return new Promise((resolve) => rl.question(question, resolve));
// }

// function askHidden(question: string): Promise<string> {
//   return new Promise((resolve) => {
//     process.stdout.write(question);
//     const { stdin } = process;
//     stdin.setRawMode(true);
//     stdin.resume();
//     stdin.setEncoding("utf8");

//     let input = "";
//     const onData = (char: string) => {
//       if (char === "\r" || char === "\n") {
//         stdin.setRawMode(false);
//         stdin.pause();
//         stdin.removeListener("data", onData);
//         process.stdout.write("\n");
//         resolve(input);
//       } else if (char === "\u0003") {
//         process.stdout.write("\n");
//         process.exit(0);
//       } else if (char === "\u007F" || char === "\b") {
//         if (input.length > 0) {
//           input = input.slice(0, -1);
//           process.stdout.write("\b \b");
//         }
//       } else {
//         input += char;
//         process.stdout.write("*");
//       }
//     };
//     stdin.on("data", onData);
//   });
// }

// async function hashPassword(password: string): Promise<string> {
//   const salt = randomBytes(16).toString("hex");
//   const key = (await scryptAsync(password.normalize("NFKC"), salt, 64, {
//     N: 16_384,
//     r: 16,
//     p: 1,
//     maxmem: 128 * 16_384 * 16 * 2,
//   })) as Buffer;
//   return `${salt}:${key.toString("hex")}`;
// }

// // ── main ──────────────────────────────────────────────────────────────────────

// const { DATABASE_URL } = process.env;
// if (!DATABASE_URL) {
//   console.error("ERROR: DATABASE_URL is not set.");
//   process.exit(1);
// }

// const rl = createInterface({ input: process.stdin, output: process.stdout });

// console.log("\n  Create Admin User\n  -----------------");

// const name = (await ask(rl, "  Name     : ")).trim();
// if (!name) {
//   console.error("Name is required.");
//   rl.close();
//   process.exit(1);
// }

// const email = (await ask(rl, "  Email    : ")).trim().toLowerCase();
// if (!email.includes("@")) {
//   console.error("Valid email is required.");
//   rl.close();
//   process.exit(1);
// }

// rl.close();

// const password = await askHidden("  Password : ");
// if (password.length < 8) {
//   console.error("Password must be at least 8 characters.");
//   process.exit(1);
// }

// const sql = postgres(DATABASE_URL, { onnotice: () => {} });

// // If user already exists, just promote them
// const [existing] =
//   await sql`SELECT id, role FROM "user" WHERE email = ${email}`;

// if (existing) {
//   if (existing.role === "admin") {
//     console.log(`\n  ${email} is already an admin.`);
//   } else {
//     await sql`UPDATE "user" SET role = 'admin' WHERE id = ${existing.id}`;
//     console.log(`\n  ✓ Existing user ${email} promoted to admin.`);
//   }
//   await sql.end();
//   process.exit(0);
// }

// const userId = crypto.randomUUID();
// const accountId = crypto.randomUUID();
// const now = new Date();
// const hashed = await hashPassword(password);

// await sql.begin(async (tx) => {
//   await tx`
//     INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
//     VALUES (${userId}, ${name}, ${email}, true, 'admin', ${now}, ${now})
//   `;
//   await tx`
//     INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
//     VALUES (${accountId}, ${email}, 'credential', ${userId}, ${hashed}, ${now}, ${now})
//   `;
// });

// console.log(`\n  ✓ Admin user created successfully.`);
// console.log(`    Name  : ${name}`);
// console.log(`    Email : ${email}\n`);

// await sql.end();
