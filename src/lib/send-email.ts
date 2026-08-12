import nodemailer from "nodemailer";
import type { EmailAccountInternal } from "@/lib/data/email-accounts";

export async function sendEmailFromAccount(
  account: EmailAccountInternal,
  message: { to: string; subject: string; text: string; fromName?: string }
) {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.emailAddress, pass: account.password }
  });

  const info = await transporter.sendMail({
    from: message.fromName ? `"${message.fromName}" <${account.emailAddress}>` : account.emailAddress,
    to: message.to,
    subject: message.subject,
    text: message.text
  });

  return info.messageId;
}

export async function verifyAccountConnection(account: EmailAccountInternal) {
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.emailAddress, pass: account.password }
  });
  await transporter.verify();
}
