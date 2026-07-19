import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.env.INIT_CWD || process.cwd(), ".env") });
import { Worker } from "bullmq";
import { processBatch } from "./index";

interface AiProcessJobData {
  rawPostIds?: string[];
}

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};
const bullPrefix = process.env.BULL_PREFIX || "{fb-store}";

const worker = new Worker<AiProcessJobData>(
  "ai-process",
  async (job) => {
    const result = await processBatch(job.data.rawPostIds);
    return result;
  },
  {
    connection,
    concurrency: 1,
    prefix: bullPrefix,
  },
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completado:`, job.returnvalue);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} falló:`, err.message);
});

console.log("🔄 AI Processor Worker iniciado — esperando trabajos...");
