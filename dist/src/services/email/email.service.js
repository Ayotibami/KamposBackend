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
function renderTemplate(fileName, context) {
    const filePath = path.resolve(process.cwd(), 'src', 'services', 'email', 'templates', fileName);
    const source = fs.readFileSync(filePath, 'utf-8');
    const template = handlebars.compile(source);
    return template(context);
}
export async function sendMail(options) {
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
    }
    catch (err) {
        logger.error({ err }, 'Email send failed');
        throw err;
    }
}
export async function sendOTPEmail(to, code, minutes = 10) {
    return sendMail({
        to,
        subject: 'Your Kampos verification code',
        template: { name: 'OtpEmailTemplate.html', context: { code, minutes } },
    });
}
export async function sendPasswordResetEmail(to, code, minutes = 10) {
    return sendMail({
        to,
        subject: 'Reset your Kampos password',
        template: { name: 'PasswordResetEmailTemplate.html', context: { code, minutes } },
    });
}
