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
  port: 2525,
  secure: false,
  auth: {
    user: env.BREVO_EMAIL,
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

// Handlebars escapes `{{message}}` automatically, but AdminMessageTemplate.html
// uses the unescaped `{{{message}}}` so line breaks can render as real <br>
// tags instead of showing up as literal \n — which means THIS function has to
// do its own HTML-escaping first (same characters handlebars would have
// escaped for us: & < > " '), before ever converting newlines. Skipping the
// escape step would let an admin's message inject arbitrary HTML into an
// email actually sent from Kampos's own address.
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * One-off admin -> user email (see idiot/users.controller.ts's
 * sendMessage) — free-form subject/message an admin types on the Account
 * Detail page, e.g. following up on a report or answering a question. Not
 * a template for a specific system event like the two above; the subject
 * line is genuinely the admin's own.
 */
export async function sendAdminMessageEmail(to: string, subject: string, message: string) {
  const html = escapeHtml(message).replace(/\n/g, '<br>');
  return sendMail({
    to,
    subject,
    template: { name: 'AdminMessageTemplate.html', context: { subject, message: html } },
  });
}
