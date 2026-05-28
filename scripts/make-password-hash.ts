import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
if (args[0] === "--") {
  args.shift();
}
const password = args[0];
if (!password) {
  console.error("Usage: pnpm tsx scripts/make-password-hash.ts <password>");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
console.log(hash);
