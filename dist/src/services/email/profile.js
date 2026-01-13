import { pool } from '../../config/db';
import { sendMail } from './email.service';
export async function sendWelcomeEmail(account_id, opts) {
    // Fetch account email
    const { rows } = await pool.query(`SELECT email FROM accounts WHERE account_id = $1`, [account_id]);
    const to = rows[0]?.email;
    if (!to)
        return;
    const friendly = opts.first_name || opts.display_name || 'there';
    const subject = `Welcome to Kampos as a ${opts.profile_type}`;
    const html = `<p>Hi ${friendly},</p>
<p>Your ${opts.profile_type} profile has been created successfully. Start exploring Kampos now!</p>
<p>Cheers,<br/>Kampos Team</p>`;
    await sendMail({ to, subject, html });
}
