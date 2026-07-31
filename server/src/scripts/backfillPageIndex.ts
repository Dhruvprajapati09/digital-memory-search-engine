/**
 * Backfill PageIndex from documents with completed extraction.
 *
 * Usage:
 *   npx tsx src/scripts/backfillPageIndex.ts
 *   npx tsx src/scripts/backfillPageIndex.ts --userId=<mongoUserId>
 */
import mongoose from "mongoose";
import { env } from "../config/env";
import { backfillPageIndex } from "../services/documentSearch/pageIndexWriter";

async function main() {
  const userArg = process.argv.find((arg) => arg.startsWith("--userId="));
  const userId = userArg?.slice("--userId=".length);

  await mongoose.connect(env.MONGO_URI);
  console.log("Connected. Backfilling PageIndex...");

  const result = await backfillPageIndex(userId ? { userId } : undefined);
  console.log(
    `Done. documents=${result.documents} pages=${result.pages}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
