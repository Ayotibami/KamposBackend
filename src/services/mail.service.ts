import handlebars from "handlebars";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createOTP, findOTPByEmail, deleteOTPById } from "../modules/otp/otp.model";
import generateOTP from "../utils/generateOTP";
import transporter from "../lib/transporter";
import type { SentMessageInfo, Transporter } from "nodemailer";
import logger from "../utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

class MailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = transporter;
  }

  private static loadTemplate(templateName: string, data: object): string {
    const templatePath = path.join(__dirname, "..", "templates", `${templateName}.html`);
    const templateSource = fs.readFileSync(templatePath, "utf8");
    const compiledTemplate = handlebars.compile(templateSource);
    return compiledTemplate(data);
  }

  public async sendEmail({ to, subject, text, html, from }: EmailOptions): Promise<SentMessageInfo> {
    try {
      const mailOptions = {
        from: from || "kamposkonnect@gmail.com",
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to} with subject "${subject}", messageId: ${info.messageId ?? info.response}`);
      return info;
    } catch (error: any) {
      logger.fatal("Error sending email:", error);
      throw error;
    }
  }

  public async sendOTPViaEmail(email: string, userName: string): Promise<SentMessageInfo> {
    // remove any previous otp for this email
    try {
      const existing = await findOTPByEmail(email);
      if (existing?.id) {
        await deleteOTPById(existing.id);
      }

      const otp = generateOTP();
      await createOTP(email, otp);

      const subject = "OTP Request";
      const date = new Date().toLocaleString();
      const emailText = `Hello ${userName},\n\nYour OTP is: ${otp}`;

      const html = MailService.loadTemplate("OTPTemplate", {
        userName,
        otp,
        date,
      });

      return await this.sendEmail({
        to: email,
        subject,
        text: emailText,
        html,
      });
    } catch (error: any) {
      logger.fatal("Failed to send OTP email:", error);
      throw error;
    }
  }
}

export const mailService = new MailService();
