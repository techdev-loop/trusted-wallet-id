import { Resend } from "resend";
import { StatusCodes } from "http-status-codes";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export async function sendOtpEmail(email: string, otpCode: string): Promise<void> {
  if (env.EMAIL_PROVIDER === "none") {
    return;
  }

  if (!env.RESEND_API_KEY) {
    throw new HttpError("RESEND_API_KEY is missing for EMAIL_PROVIDER=resend", StatusCodes.SERVICE_UNAVAILABLE);
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: env.OTP_EMAIL_FROM,
    to: [email],
    replyTo: env.OTP_EMAIL_REPLY_TO ? [env.OTP_EMAIL_REPLY_TO] : undefined,
    subject: "Your FIUlink verification code",
    html: `
      <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;">
        <p>Your FIUlink verification code is:</p>
        <p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    `
  });

  if (result.error) {
    throw new HttpError(`Failed to send verification email: ${result.error.message}`, StatusCodes.BAD_GATEWAY);
  }
}
