import fs from 'fs';
import path from 'path';
import handlebars from 'handlebars';
import nodemailer from 'nodemailer';
import logger from '../../utils/logger';
import { env } from '../../config/env';

// Brevo (Sendinblue) SMTP:
// - Host: smtp-relay.brevo.com
// - Port: 587 (TLS)
// - Username: "apikey" (or env.BREVO_EMAIL)
// - Password: <your SMTP key> (env.BREVO_PASSWORD)
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: env.BREVO_EMAIL || 'apikey',
    pass: env.BREVO_PASSWORD,
  },
});

function renderTemplate(fileName: string, context: Record<string, any>) {
  const filePath = path.resolve(process.cwd(), 'src', 'services', 'email', 'templates', fileName);
  const source = fs.readFileSync(filePath, 'utf-8');
  const template = handlebars.compile(source);
  return template(context);
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  template?: { name: string; context: Record<string, any> };
  from?: string;
}) {
  try {
    const html = options.template
      ? renderTemplate(options.template.name, options.template.context)
      : options.html;

    const info = await transporter.sendMail({
      from: options.from || env.BREVO_FROM || 'kamposkonnect@gmail.com',
      to: options.to,
      subject: options.subject,
      text: options.text,
      html,
    });
    logger.debug({ messageId: info.messageId }, 'Email sent');
    return info;
  } catch (err: any) {
    logger.error({ err }, 'Email send failed');
    throw err;
  }
}

export async function sendOTPEmail(to: string, code: string, minutes = 10) {
  return sendMail({
    to,
    subject: 'Your Kampos verification code',
    template: { name: 'OtpEmailTemplate.html', context: { code, minutes } },
  });
}

export async function sendPasswordResetEmail(to: string, code: string, minutes = 10) {
  return sendMail({
    to,
    subject: 'Reset your Kampos password',
    template: { name: 'PasswordResetEmailTemplate.html', context: { code, minutes } },
  });
}
