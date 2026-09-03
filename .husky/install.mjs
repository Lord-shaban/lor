// Git hooks are a local development convenience.
//
// `prepare` runs on every `npm install`, including the production install a
// deploy performs with `--omit=dev`. Husky is a devDependency, so in that
// environment the binary does not exist and `husky` exits 127, taking the whole
// install — and the deployment — down with it.
//
// Skipping on CI and in a production install fixes that without reaching for
// `husky || true`, which would also hide a genuine hook-setup failure locally,
// where the message is worth reading.
if (process.env.CI || process.env.VERCEL || process.env.NODE_ENV === "production") {
  process.exit(0);
}

const husky = (await import("husky")).default;
console.log(husky());
