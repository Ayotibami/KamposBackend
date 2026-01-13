"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWelcomeEmail = sendWelcomeEmail;
const db_1 = require("../../config/db");
const email_service_1 = require("./email.service");
async function sendWelcomeEmail(account_id, opts) {
    // Fetch account email
    const { rows } = await db_1.pool.query(`SELECT email FROM accounts WHERE account_id = $1`, [account_id]);
    const to = rows[0]?.email;
    if (!to)
        return;
    const friendly = opts.first_name || opts.display_name || 'there';
    const subject = `Welcome to Kampos as a ${opts.profile_type}`;
    const html = `<p>Hi ${friendly},</p>
<p>Your ${opts.profile_type} profile has been created successfully. Start exploring Kampos now!</p>
<p>Cheers,<br/>Kampos Team</p>`;
    await (0, email_service_1.sendMail)({ to, subject, html });
}
