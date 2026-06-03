import { Resend } from "resend";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Email service wrapper around Resend. In dev (no RESEND_API_KEY) emails are
 * logged to stdout instead of sent — useful for testing reset-password and
 * verification flows without burning quota.
 */

let resend: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(env.RESEND_API_KEY);
  return resend;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  /** HTML body. Resend supports both `html` and `text`; we pass HTML only. */
  html: string;
}

/**
 * Send a transactional email. In dev (no API key), logs to console with the
 * full body so you can copy-paste reset tokens etc.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const client = getClient();

  if (!client) {
    // Dev mode — log instead of send. Includes full HTML so reset tokens are visible.
    logger.info(
      {
        to,
        subject,
        bodyPreview: html.substring(0, 400),
      },
      "[Email DEV-STUB] (no RESEND_API_KEY set, email NOT sent)",
    );
    return;
  }

  try {
    const { data, error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    if (error) {
      logger.error({ error, to, subject }, "Resend send failed");
      throw new Error(`Email send failed: ${error.message}`);
    }
    logger.info({ id: data?.id, to, subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to, subject }, "sendEmail error");
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════
// Email templates
// ══════════════════════════════════════════════════════════════

export function resetPasswordEmail(opts: {
  fullName: string;
  resetLink: string;
}): { subject: string; html: string } {
  const { fullName, resetLink } = opts;
  return {
    subject: "Đặt lại mật khẩu PlanGo",
    html: `<!doctype html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0F172A;">
  <div style="text-align: center; padding: 24px 0;">
    <h1 style="color: #0891B2; margin: 0;">PlanGo</h1>
  </div>
  <div style="background: #F8FAFC; border-radius: 16px; padding: 32px;">
    <h2 style="margin: 0 0 16px;">Xin chào ${fullName || "bạn"},</h2>
    <p style="font-size: 15px; line-height: 1.6; color: #475569;">
      Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản PlanGo của bạn.
      Click vào nút bên dưới để tạo mật khẩu mới. Liên kết này có hiệu lực trong <strong>1 giờ</strong>.
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${resetLink}" style="display: inline-block; background: #0891B2; color: #fff; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600;">
        Đặt lại mật khẩu
      </a>
    </div>
    <p style="font-size: 13px; color: #94A3B8; line-height: 1.6;">
      Nếu nút không hoạt động, copy link sau và dán vào trình duyệt:<br>
      <span style="word-break: break-all; color: #0891B2;">${resetLink}</span>
    </p>
    <p style="font-size: 13px; color: #94A3B8; line-height: 1.6; margin-top: 24px;">
      Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.
    </p>
  </div>
  <div style="text-align: center; padding: 24px 0; color: #94A3B8; font-size: 12px;">
    © 2026 PlanGo. All rights reserved.
  </div>
</body></html>`,
  };
}
