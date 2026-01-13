"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailer = void 0;
exports.sendMail = sendMail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("./env");
exports.mailer = nodemailer_1.default.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
        user: env_1.env.BREVO_EMAIL,
        pass: env_1.env.BREVO_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
});
async function sendMail(opts) {
    const from = opts.from || 'kamposkonnect@gmail.com';
    return exports.mailer.sendMail({ ...opts, from });
}
