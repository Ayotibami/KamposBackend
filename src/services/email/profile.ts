// import { pool } from '../../config/db';
// import { sendMail } from './email.service';

// export async function sendWelcomeEmail(account_id: string, opts: { profile_type: 'STUDENT'|'KREATOR'|'KOMPANY'|'SCHOOL'; display_name?: string | null; first_name?: string | null; }) {
//   // Fetch account email
//   const { rows } = await pool.query<{ email: string }>(`SELECT email FROM accounts WHERE account_id = $1`, [account_id]);
//   const to = rows[0]?.email;
//   if (!to) return;

//   const friendly = opts.first_name || opts.display_name || 'there';
//   const subject = `Welcome to Kampos as a ${opts.profile_type}`;
//   const html = `<p>Hi ${friendly},</p>
// <p>Your ${opts.profile_type} profile has been created successfully. Start exploring Kampos now!</p>
// <p>Cheers,<br/>Kampos Team</p>`;

//   await sendMail({ to, subject, html });
// }

import { pool } from "../../config/db";
import { sendMail } from "./email.service";

export async function sendWelcomeEmail(
  account_id: string,
  opts: {
    profile_type: "STUDENT" | "KREATOR" | "KOMPANY" | "SCHOOL";
    display_name?: string | null;
    first_name?: string | null;
  }
) {
  // Fetch account email
  const { rows } = await pool.query<{ email: string }>(
    `SELECT email FROM accounts WHERE account_id = $1`,
    [account_id]
  );
  const to = rows[0]?.email;
  if (!to) return;

  const friendly = opts.first_name || opts.display_name || "there";
  const subject = `${opts.first_name}, Oya come and collect Shawarma jor🌯`;

  const html = `
  <head>
  <link
    href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap"
    rel="stylesheet"
  />
</head>
<body style="font-family: 'Poppins', sans-serif">
  <div>
    <h1>${opts.first_name}, Chop am as e dey hot!😁</h1>
    <img
      src="https://i.postimg.cc/gJRvm79f/Chat-GPT-Image-Dec-1-2025-08-27-15-AM.png"
      alt="Sharwama"
    />
    <h1 style="text-align: center">
      Cuz why not? You are finally a <b style="color: #165abf">Kamposer!🎉</b>
    </h1>
    <p font-size="40px">
      Well, this is the least Kappy and the team could do for you for creating a
      profile on Kampos (na Kappy idea be that!). Your profile na like your
      campus ID — other Kamposers fit know who you be and vibe with you. Oya,
      welcome! This is just the beginning of a cool campus experience. From now,
      your mind no go touch ground!
    </p>
    <p font-size="40px">
      By now, we believe you’ve hopped into the gists, rants, and stories from
      students on your campus. If you haven’t, hop in right away — that’s what
      Kampos is all about: dropping you right in the middle of everything
      happening at your school, anytime, anywhere.
    </p>
    <p font-size="40px">
      If your course rep is moving mad, your course is almost taking your life,
      your lecturer is losing it, or the school calendar is not calendaring, you
      can gist about it here. Sure, Kampos becomes better when you get involved!
    </p>
    <p style="font-style: italic">what else .....</p>
    <p>
      Ehn ehn, abeg no talk wetin you no suppose talk, or gist stuffs wey dey
      improper, explicit, or offensive. Kampos fit suspend or ban your account.
      Seriously, make Kampos a safe space for everybody. You fit review our
      <a
        style="color: #165abf"
        href="https://docs.google.com/document/d/1xItyyu2837w-L8K4kdt3bFNiwklU5K_-qcICKSchD3I/edit?usp=sharing"
        >Terms and Conditions</a
      >
      and
      <a
        style="color: #165abf"
        href="https://docs.google.com/document/d/1ea4DOtGuB7bhbLlbjW0lBh4cWtfVVZjZ2HqslEqgPCo/edit?usp=sharing"
        >Privacy Policy</a
      >.
    </p>
    <p>
      Enough talk, abeg hop into Kampos. That’s where the drama and vibe dey.
      Even our troublesome parrot don already dey catch up.
    </p>
    <img
      src="https://i.postimg.cc/zvp3rsjM/Chat-GPT-Image-Nov-28-2025-06-58-18-AM-(1).jpg"
      alt="Kappy"
      style="align-self: center"
    />
    <p style="margin">Ayobami Masterpiece</p>
    <p style="margin: 0">CEO, Kampos</p>
    <p style="margin: 0">Your Boii</p>
    <div>
      <p style="text-align: center">You no go like follow us ?</p>
      <div style="text-align: center">
        <a href="https://x.com/Kamposhq">
          <img
            src="https://i.postimg.cc/DfCKwhJb/black-brand-new-twitter-x-logo-icon-1129635-1.jpg"
            alt="Twitter"
            width="40"
            style="margin: 0 5px"
          />
        </a>
        <a href="https://www.instagram.com/kamposhq/">
          <img
            src="https://i.postimg.cc/66hpVF7X/instagram_logo_1080029_106.jpg"
            alt="Instagram"
            width="40"
            style="margin: 0 5px"
          />
        </a>
      </div>
    </div>
  </div>

  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0" />
  <p
    style="text-align: center; font-style: italic; font-size: 12px; color: #888"
  >
    Kampos — Your campus life in one app
  </p>
  <p style="text-align: center; font-size: 12px; color: #888; line-height: 1.5">
    &copy; 2025 Ayoti. All rights reserved.
  </p>

  <p style="text-align: center; font-size: 12px; color: #888; line-height: 1.5">
    You are receiving this email because you created a Kampos profile.
  </p>
</body>

`;
  try {
    await sendMail({ to, subject, html });
    console.log("Mail sent!");
  } catch (err) {
    console.error("Mail failed:", err);
  }
}
