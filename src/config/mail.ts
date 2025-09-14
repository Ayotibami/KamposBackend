import nodemailer from 'nodemailer';
import { env } from './env';

export const mailer = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  auth: {
    user: env.BREVO_EMAIL,
    pass: env.BREVO_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

export async function sendMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) {
  const from = opts.from || 'kamposkonnect@gmail.com';
  return mailer.sendMail({ ...opts, from });
}
