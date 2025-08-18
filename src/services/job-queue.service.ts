import { Queue, Worker } from "bullmq";
import { env } from "../config/env.config";
import logger from "../utils/logger";
import { mailService } from "./mail.service";

const emailQueue = new Queue("email", { connection: { host: env.REDIS_HOST } });

export const addEmailJob = async (emailData: {
  to: string;
  subject: string;
  html: string;
}) => {
  await emailQueue.add("send-email", emailData);
  logger.info(`Added email job for ${emailData.to}`);
};

export const startEmailWorker = () => {
  const worker = new Worker(
    "email",
    async (job) => {
      const mailOptions = {
        from: "kamposkonnect@gmail.com",
        to: job.data.to,
        subject: job.data.subject,
        text: job.data.text || "",
        html: job.data.html,
      };
      await mailService.sendEmail(mailOptions);
      logger.info(`Processed email job for ${job.data.to}`);
    },
    { connection: { host: env.REDIS_HOST } }
  );

  worker.on("failed", (job, err) => {
    logger.error(`Email job failed for ${job?.data.to}: ${err.message}`);
  });
};
