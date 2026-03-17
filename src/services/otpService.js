/**
 * OTP service - sends OTP via SMS (MSG91) or logs to console in dev.
 * No browser/reCAPTCHA - stays in-app.
 */

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store: { "919876543210": { otp: "123456", expiresAt: timestamp } }
const otpStore = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeMobile(mobile) {
  const cleaned = String(mobile).replace(/\D/g, '');
  if (cleaned.length >= 10) {
    return '91' + cleaned.slice(-10);
  }
  return null;
}

async function sendSms(mobile, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID || 'CHATAP';
  const mobileNum = String(mobile).replace(/\D/g, '').slice(-10);
  const fullMobile = '91' + mobileNum;

  if (authKey) {
    try {
      const url = new URL('https://api.msg91.com/api/sendotp.php');
      url.searchParams.set('authkey', authKey);
      url.searchParams.set('mobile', fullMobile);
      url.searchParams.set('otp', otp);
      url.searchParams.set('sender', senderId);
      url.searchParams.set('otp_expiry', '5');

      const res = await fetch(url.toString());
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { type: 'error', message: text };
      }
      if (data.type === 'error') {
        console.warn('MSG91 error:', data.message);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('MSG91 send failed:', err.message);
      return false;
    }
  }
  // Dev mode: log OTP to console (no SMS provider configured)
  console.log(`[OTP] +91${mobileNum}: ${otp} (valid 5 min) - Set MSG91_AUTH_KEY for real SMS`);
  return true;
}

function storeOtp(mobile, otp) {
  const key = normalizeMobile(mobile);
  if (!key) return false;
  otpStore.set(key, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });
  return true;
}

function verifyOtp(mobile, otp) {
  const key = normalizeMobile(mobile);
  if (!key || !otp) return false;
  const entry = otpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(key);
    return false;
  }
  const match = entry.otp === String(otp).trim();
  if (match) otpStore.delete(key);
  return match;
}

async function sendOtp(mobile) {
  const key = normalizeMobile(mobile);
  if (!key) return { success: false, message: 'Invalid mobile number' };

  const otp = generateOtp();
  storeOtp(mobile, otp);

  const sent = await sendSms(mobile, otp);
  if (!sent) {
    return { success: false, message: 'Failed to send OTP. Try again.' };
  }
  return { success: true, message: 'OTP sent to your mobile' };
}

module.exports = {
  sendOtp,
  verifyOtp,
  normalizeMobile: (m) => {
    const n = normalizeMobile(m);
    return n ? n.slice(-10) : null;
  },
};
