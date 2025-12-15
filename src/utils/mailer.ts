import nodemailer from 'nodemailer';

/**
 * Email configuration using nodemailer
 *
 * IMPORTANT: Configure your email credentials in .env:
 * EMAIL_HOST=smtp.gmail.com (for Gmail)
 * EMAIL_PORT=587
 * EMAIL_USER=your-email@gmail.com
 * EMAIL_PASSWORD=your-app-password (for Gmail, use App Password, not regular password)
 * EMAIL_FROM=your-email@gmail.com
 *
 * For Gmail, you need to:
 * 1. Enable 2-Factor Authentication
 * 2. Generate an App Password from Google Account settings
 * 3. Use that App Password in EMAIL_PASSWORD
 */

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Testriser'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: 'Password Reset Request - Testriser',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 10px;">=Ú</div>
                      <h1 style="margin: 0; color: #1e293b; font-size: 24px;">Password Reset Request</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 40px 30px;">
                      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.5;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.5;">
                        We received a request to reset your password for your Testriser account. Click the button below to reset your password:
                      </p>

                      <!-- Button -->
                      <table role="presentation" style="margin: 30px 0;">
                        <tr>
                          <td align="center">
                            <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin: 20px 0; color: #475569; font-size: 14px; line-height: 1.5;">
                        Or copy and paste this URL into your browser:
                      </p>
                      <p style="margin: 0 0 20px; color: #3b82f6; font-size: 14px; word-break: break-all;">
                        ${resetUrl}
                      </p>

                      <p style="margin: 20px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                        <strong>This link will expire in 1 hour.</strong>
                      </p>

                      <p style="margin: 20px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                        If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                        © 2024 Testriser. All rights reserved.<br>
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `
      Password Reset Request

      Hello,

      We received a request to reset your password for your Testriser account.

      Click this link to reset your password: ${resetUrl}

      This link will expire in 1 hour.

      If you didn't request a password reset, you can safely ignore this email.

      © 2024 Testriser
    `,
  };

  await transporter.sendMail(mailOptions);
}

/**
 * Send password change confirmation email
 */
export async function sendPasswordChangeConfirmation(to: string): Promise<void> {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || 'Testriser'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to,
    subject: 'Password Changed Successfully - Testriser',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <div style="font-size: 48px; margin-bottom: 10px;"></div>
                      <h1 style="margin: 0; color: #1e293b; font-size: 24px;">Password Changed Successfully</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 0 40px 30px;">
                      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.5;">
                        Hello,
                      </p>
                      <p style="margin: 0 0 20px; color: #475569; font-size: 16px; line-height: 1.5;">
                        This is to confirm that your password has been successfully changed.
                      </p>

                      <p style="margin: 20px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                        If you didn't make this change, please contact us immediately at support@testriser.com
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                        © 2024 Testriser. All rights reserved.<br>
                        This is an automated email. Please do not reply.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
    text: `
      Password Changed Successfully

      Hello,

      This is to confirm that your password has been successfully changed.

      If you didn't make this change, please contact us immediately.

      © 2024 Testriser
    `,
  };

  await transporter.sendMail(mailOptions);
}

export default transporter;
