"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMail = sendMail;
exports.sendOTPEmail = sendOTPEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const handlebars_1 = __importDefault(require("handlebars"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../../utils/logger"));
const env_1 = require("../../config/env");
// Brevo (Sendinblue) SMTP:
// - Host: smtp-relay.brevo.com
// - Port: 587 (TLS)
// - Username: "apikey" (or env.BREVO_EMAIL)
// - Password: <your SMTP key> (env.BREVO_PASSWORD)
const transporter = nodemailer_1.default.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 2525,
    secure: false,
    auth: {
        user: env_1.env.BREVO_EMAIL,
        pass: env_1.env.BREVO_PASSWORD,
    },
});
function renderTemplate(fileName, context) {
    const filePath = path_1.default.resolve(process.cwd(), 'src', 'services', 'email', 'templates', fileName);
    const source = fs_1.default.readFileSync(filePath, 'utf-8');
    const template = handlebars_1.default.compile(source);
    return template(context);
}
async function sendMail(options) {
    try {
        const html = options.template
            ? renderTemplate(options.template.name, options.template.context)
            : options.html;
        const info = await transporter.sendMail({
            from: options.from || env_1.env.BREVO_FROM || 'kamposkonnect@gmail.com',
            to: options.to,
            subject: options.subject,
            text: options.text,
            html,
        });
        logger_1.default.debug({ messageId: info.messageId }, 'Email sent');
        return info;
    }
    catch (err) {
        logger_1.default.error({ err }, 'Email send failed');
        throw err;
    }
}
async function sendOTPEmail(to, code, minutes = 10) {
    return sendMail({
        to,
        subject: 'Your Kampos verification code',
        template: { name: 'OtpEmailTemplate.html', context: { code, minutes } },
    });
}
async function sendPasswordResetEmail(to, code, minutes = 10) {
    return sendMail({
        to,
        subject: 'Reset your Kampos password',
        template: { name: 'PasswordResetEmailTemplate.html', context: { code, minutes } },
    });
}
