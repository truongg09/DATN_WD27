const nodemailer = require('nodemailer');

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN').format(Number(amount || 0))}₫`;
const formatDate = (date) => date
  ? new Date(date).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  : '-';
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const isConfigured = () => Boolean(
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM
);

let transporter;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }
  return transporter;
};

const send = async ({ to, subject, html }) => {
  if (!to || !isConfigured()) {
    console.info('[email] Skipped: recipient or SMTP configuration is missing.');
    return { skipped: true };
  }
  try {
    const from = process.env.SMTP_FROM.includes('@')
      ? process.env.SMTP_FROM
      : `"${process.env.SMTP_FROM}" <${process.env.SMTP_USER}>`;
    return await getTransporter().sendMail({ from, to, subject, html });
  } catch (error) {
    // Email is a notification, not part of the financial transaction. Do not
    // roll back a successful booking/payment because an SMTP server is down.
    console.error('[email] Send failed:', error.message);
    return { failed: true };
  }
};

const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'info@hotelhub.com';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '+84 123 456 789';

const emailLayout = ({ previewText, eyebrow, title, intro, content, bookingId }) => `
  <!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f1ed;font-family:Arial,'Helvetica Neue',sans-serif;color:#2f2924">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ed">
        <tr>
          <td align="center" style="padding:32px 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
              style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(64,48,34,.08)">
              <tr>
                <td style="background:#a98561;padding:26px 34px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color:#fff;font-size:25px;font-weight:700;letter-spacing:-.5px">HotelHub</td>
                      <td align="right" style="color:#f8eee4;font-size:12px">ĐẶT PHÒNG TRỰC TUYẾN</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:38px 34px 14px">
                  <div style="color:#a98561;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">
                    ${escapeHtml(eyebrow)}
                  </div>
                  <h1 style="margin:10px 0 12px;font-size:27px;line-height:1.25;color:#201b17">${escapeHtml(title)}</h1>
                  <p style="margin:0;color:#655b53;font-size:15px;line-height:1.7">${intro}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 8px">${content}</td>
              </tr>
              <tr>
                <td align="center" style="padding:24px 34px 38px">
                  <a href="${FRONTEND_URL}/booking/${Number(bookingId)}"
                    style="display:inline-block;background:#a98561;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 24px;border-radius:10px">
                    Xem chi tiết đặt phòng
                  </a>
                </td>
              </tr>
              <tr>
                <td style="background:#faf8f5;border-top:1px solid #eee7df;padding:24px 34px;color:#81766d;font-size:12px;line-height:1.7">
                  Cần hỗ trợ? Liên hệ <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#8d6b4d">${escapeHtml(SUPPORT_EMAIL)}</a>
                  hoặc <a href="tel:${escapeHtml(SUPPORT_PHONE.replace(/\s/g, ''))}" style="color:#8d6b4d">${escapeHtml(SUPPORT_PHONE)}</a>.<br>
                  Đây là email tự động từ HotelHub, vui lòng không trả lời trực tiếp email này.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

const summaryRow = (label, value, emphasized = false) => `
  <tr>
    <td style="padding:11px 0;border-bottom:1px solid #eee9e4;color:#81766d;font-size:14px">${escapeHtml(label)}</td>
    <td align="right" style="padding:11px 0;border-bottom:1px solid #eee9e4;color:#2f2924;font-size:14px;${emphasized ? 'font-weight:700' : ''}">
      ${value}
    </td>
  </tr>`;

const bookingSummary = (booking) => `
  <table role="presentation" style="border-collapse:collapse;width:100%">
    ${summaryRow('Mã đặt phòng', `<strong>#${Number(booking.id)}</strong>`)}
    ${summaryRow('Phòng', `${escapeHtml(booking.room_number || '-')} · ${escapeHtml(booking.room_type_name || '-')}`)}
    ${summaryRow('Nhận phòng', formatDate(booking.check_in))}
    ${summaryRow('Trả phòng', formatDate(booking.check_out))}
  </table>`;

const customerSummary = (booking) => `
  <div style="margin-bottom:18px">
    <div style="margin-bottom:9px;color:#2f2924;font-size:14px;font-weight:700">Thông tin khách hàng</div>
    <div style="border:1px solid #eee7df;border-radius:12px;padding:8px 20px">
      <table role="presentation" style="border-collapse:collapse;width:100%">
        ${summaryRow('Họ và tên', escapeHtml(booking.customer_name || '—'), true)}
        ${summaryRow(
          'Email',
          booking.customer_email
            ? `<a href="mailto:${escapeHtml(booking.customer_email)}" style="color:#8d6b4d;text-decoration:none">${escapeHtml(booking.customer_email)}</a>`
            : '—'
        )}
        ${summaryRow(
          'Số điện thoại',
          booking.customer_phone
            ? `<a href="tel:${escapeHtml(String(booking.customer_phone).replace(/\s/g, ''))}" style="color:#8d6b4d;text-decoration:none">${escapeHtml(booking.customer_phone)}</a>`
            : '—'
        )}
      </table>
    </div>
  </div>`;

const bookingInformation = (booking) => `
  <div style="margin-bottom:9px;color:#2f2924;font-size:14px;font-weight:700">Thông tin đặt phòng</div>
  <div style="border:1px solid #eee7df;border-radius:12px;padding:8px 20px">
    ${bookingSummary(booking)}
  </div>`;

const sendBookingConfirmation = (booking) => send({
  to: booking.customer_email,
  subject: `[HotelHub] Xác nhận đặt phòng #${booking.id}`,
  html: emailLayout({
    previewText: `HotelHub đã tiếp nhận đơn đặt phòng #${booking.id}.`,
    eyebrow: 'Đã tiếp nhận yêu cầu',
    title: 'Đặt phòng của bạn đang được giữ chỗ',
    intro: `Xin chào <strong>${escapeHtml(booking.customer_name || 'Quý khách')}</strong>, HotelHub đã tiếp nhận yêu cầu của bạn. Vui lòng hoàn tất thanh toán trong thời gian giữ phòng.`,
    bookingId: booking.id,
    content: `
      ${customerSummary(booking)}
      ${bookingInformation(booking)}
      <div style="margin-top:18px;background:#f7f1eb;border-radius:12px;padding:18px 20px">
        <div style="color:#81766d;font-size:13px">Tổng tiền dự kiến</div>
        <div style="margin-top:5px;color:#8d6240;font-size:24px;font-weight:700">${formatMoney(booking.total_price)}</div>
      </div>`
  })
});

const sendPaymentConfirmation = (booking, payment) => {
  const isFullyPaid = payment.paymentStatus === 'paid';
  return send({
    to: booking.customer_email,
    subject: `[HotelHub] ${isFullyPaid ? 'Thanh toán thành công' : 'Đặt cọc thành công'} #${booking.id}`,
    html: emailLayout({
      previewText: isFullyPaid
        ? `Đơn #${booking.id} đã được thanh toán đầy đủ.`
        : `HotelHub đã ghi nhận tiền cọc cho đơn #${booking.id}.`,
      eyebrow: isFullyPaid ? 'Thanh toán hoàn tất' : 'Đặt cọc thành công',
      title: isFullyPaid ? 'Thanh toán của bạn đã thành công' : 'Phòng của bạn đã được giữ',
      intro: `Xin chào <strong>${escapeHtml(booking.customer_name || 'Quý khách')}</strong>, chúng tôi đã ghi nhận thanh toán cho đơn <strong>#${Number(booking.id)}</strong>.`,
      bookingId: booking.id,
      content: `
        ${customerSummary(booking)}
        ${bookingInformation(booking)}
        <div style="margin-top:18px;background:${isFullyPaid ? '#edf8f1' : '#f7f1eb'};border-radius:12px;padding:18px 20px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <div style="color:#81766d;font-size:13px">Tổng đã thanh toán</div>
                <div style="margin-top:5px;color:${isFullyPaid ? '#237a49' : '#8d6240'};font-size:23px;font-weight:700">
                  ${formatMoney(payment.paidAmount)}
                </div>
              </td>
              <td align="right">
                <div style="color:#81766d;font-size:13px">Còn lại</div>
                <div style="margin-top:5px;color:#2f2924;font-size:18px;font-weight:700">
                  ${formatMoney(payment.remainingAmount)}
                </div>
              </td>
            </tr>
          </table>
        </div>
        ${payment.transactionCode ? `
          <div style="margin-top:16px;color:#81766d;font-size:13px">
            Mã giao dịch: <strong style="color:#2f2924">${escapeHtml(payment.transactionCode)}</strong>
          </div>` : ''}`
    })
  });
};

const resetPasswordLayout = ({ previewText, eyebrow, title, intro, resetLink, expiresText }) => `
  <!doctype html>
  <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f1ed;font-family:Arial,'Helvetica Neue',sans-serif;color:#2f2924">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(previewText)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ed">
        <tr>
          <td align="center" style="padding:32px 12px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
              style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(64,48,34,.08)">
              <tr>
                <td style="background:#a98561;padding:26px 34px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color:#fff;font-size:25px;font-weight:700;letter-spacing:-.5px">HotelHub</td>
                      <td align="right" style="color:#f8eee4;font-size:12px">BẢO MẬT TÀI KHOẢN</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:38px 34px 14px">
                  <div style="color:#a98561;font-size:12px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase">
                    ${escapeHtml(eyebrow)}
                  </div>
                  <h1 style="margin:10px 0 12px;font-size:27px;line-height:1.25;color:#201b17">${escapeHtml(title)}</h1>
                  <p style="margin:0;color:#655b53;font-size:15px;line-height:1.7">${intro}</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:18px 34px 8px">
                  <a href="${resetLink}"
                    style="display:inline-block;background:#a98561;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 28px;border-radius:10px">
                    Đặt lại mật khẩu
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 18px;color:#655b53;font-size:14px;line-height:1.7">
                  <div style="padding:14px 18px;background:#fff7e6;border-left:4px solid #e6a23c;border-radius:8px">
                    <strong style="color:#b5670b">Lưu ý:</strong> Link đặt lại mật khẩu này sẽ hết hạn sau ${escapeHtml(expiresText)}.
                    Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background:#faf8f5;border-top:1px solid #eee7df;padding:24px 34px;color:#81766d;font-size:12px;line-height:1.7">
                  Cần hỗ trợ? Liên hệ <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#8d6b4d">${escapeHtml(SUPPORT_EMAIL)}</a>
                  hoặc <a href="tel:${escapeHtml(SUPPORT_PHONE.replace(/\s/g, ''))}" style="color:#8d6b4d">${escapeHtml(SUPPORT_PHONE)}</a>.<br>
                  Đây là email tự động từ HotelHub, vui lòng không trả lời trực tiếp email này.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;

const sendResetPasswordEmail = ({ to, fullName, token, expiresMinutes = 15 }) => {
  const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const expiresText = `${Number(expiresMinutes)} phút`;
  return send({
    to,
    subject: '[HotelHub] Đặt lại mật khẩu tài khoản',
    html: resetPasswordLayout({
      previewText: `Đặt lại mật khẩu tài khoản HotelHub - hết hạn ${expiresText}`,
      eyebrow: 'Yêu cầu đặt lại mật khẩu',
      title: 'Đặt lại mật khẩu của bạn',
      intro: `Xin chào <strong>${escapeHtml(fullName || 'Quý khách')}</strong>, bạn vừa gửi yêu cầu đặt lại mật khẩu cho tài khoản <strong>${escapeHtml(to)}</strong>. Nhấp nút bên dưới để đặt lại mật khẩu.`,
      resetLink,
      expiresText,
    })
  });
};

module.exports = { sendBookingConfirmation, sendPaymentConfirmation, sendResetPasswordEmail };
