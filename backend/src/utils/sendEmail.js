import transporter from '../config/email.js';
import logger from './logger.js';

const FROM = process.env.EMAIL_FROM || 'BloodLink <noreply@bloodlink.io>';

/**
 * sendEmail — base mailer. All specific functions call this.
 */
const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    logger.debug(`Email sent to ${to}: ${subject}`);
  } catch (err) {
    // Never throw — email failure should NOT break the main flow
    logger.error(`Email send failed to ${to}: ${err.message}`);
  }
};

// ── Templates ────────────────────────────────────────────────────────────────

export const sendWelcomeEmail = async (user) => {
  await sendEmail({
    to:      user.email,
    subject: '🩸 Welcome to BloodLink!',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#e51d1d">Welcome to BloodLink, ${user.name}!</h2>
        <p>Your account has been created as a <strong>${user.role}</strong>.</p>
        <p>Together we can save lives. Thank you for joining the BloodLink community.</p>
        <hr/>
        <p style="color:#888;font-size:12px">BloodLink — Transparent Giving for a Healthier Tomorrow</p>
      </div>
    `,
  });
};

export const sendDonorAcceptedEmail = async ({ hospitalEmail, hospitalName, donorName, bloodGroup, donationId }) => {
  await sendEmail({
    to:      hospitalEmail,
    subject: `🩸 Donor accepted your ${bloodGroup} blood request`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#e51d1d">A donor has accepted your blood request</h2>
        <p>Hospital: <strong>${hospitalName}</strong></p>
        <p>Donor: <strong>${donorName}</strong></p>
        <p>Blood Group: <strong>${bloodGroup}</strong></p>
        <p>Donation ID: <code>${donationId}</code></p>
        <p>Please coordinate with the donor and enter the blood bag ID once received.</p>
        <hr/>
        <p style="color:#888;font-size:12px">BloodLink</p>
      </div>
    `,
  });
};

export const sendDonorConfirmedEmail = async ({ hospitalEmail, hospitalName, donorName, donationId }) => {
  await sendEmail({
    to:      hospitalEmail,
    subject: '✅ Donor has confirmed their donation',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#16a34a">Donor Confirmation Received</h2>
        <p><strong>${donorName}</strong> has confirmed donation <code>${donationId}</code>.</p>
        <p>Please log in to enter the blood bag ID and confirm receipt to complete the process.</p>
        <hr/>
        <p style="color:#888;font-size:12px">BloodLink</p>
      </div>
    `,
  });
};

export const sendDonationCompletedEmail = async ({ donorEmail, donorName, bdcAwarded, txHash, bloodGroup }) => {
  const etherscanBase = process.env.ETHERSCAN_BASE_URL || 'https://sepolia.etherscan.io/tx/';
  await sendEmail({
    to:      donorEmail,
    subject: `🏆 Donation complete! You earned ${bdcAwarded} BDC`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#e51d1d">Thank you, ${donorName}! 🩸</h2>
        <p>Your <strong>${bloodGroup}</strong> blood donation has been recorded on the blockchain.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr>
            <td style="padding:8px;border:1px solid #eee"><strong>BDC Earned</strong></td>
            <td style="padding:8px;border:1px solid #eee">${bdcAwarded} BDC</td>
          </tr>
          <tr>
            <td style="padding:8px;border:1px solid #eee"><strong>Transaction</strong></td>
            <td style="padding:8px;border:1px solid #eee">
              <a href="${etherscanBase}${txHash}" style="color:#e51d1d">${txHash.slice(0, 20)}...</a>
            </td>
          </tr>
        </table>
        <p>An NFT Donation Certificate has been minted to your wallet. Keep donating!</p>
        <hr/>
        <p style="color:#888;font-size:12px">BloodLink — Transparent Giving for a Healthier Tomorrow</p>
      </div>
    `,
  });
};

export const sendRequestExpiredEmail = async ({ hospitalEmail, hospitalName, bloodGroup, requestId }) => {
  await sendEmail({
    to:      hospitalEmail,
    subject: `⚠️ Your ${bloodGroup} blood request has expired`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2 style="color:#d97706">Blood Request Expired</h2>
        <p>Your <strong>${bloodGroup}</strong> blood request (ID: <code>${requestId}</code>) has expired after 72 hours without being accepted.</p>
        <p>Please post a new request if the need persists.</p>
        <hr/>
        <p style="color:#888;font-size:12px">BloodLink</p>
      </div>
    `,
  });
};

export default sendEmail;
