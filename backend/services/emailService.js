const nodemailer = require('nodemailer');

const formatMoney = (amount) => new Intl.NumberFormat('vi-VN').format(Number(amount || 0)) + '₫';
const formatDate = (date) => date ? new Date(date).toLocaleDateString('vi-VN') : '-';
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
    return await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, subject, html });
  } catch (error) {
    // Email is a notification, not part of the financial transaction. Do not
    // roll back a successful booking/payment because an SMTP server is down.
    console.error('[email] Send failed:', error.message);
    return { failed: true };
  }
};

const bookingSummary = (booking) => `
  <table style="border-collapse:collapse;width:100%;max-width:560px">
    <tr><td style="padding:8px;border-bottom:1px solid #eee">Mã đặt phòng</td><td style="padding:8px;border-bottom:1px solid #eee"><strong>#${booking.id}</strong></td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">Phòng</td><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(booking.room_number)} · ${escapeHtml(booking.room_type_name)}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">Nhận phòng</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(booking.check_in)}</td></tr>
    <tr><td style="padding:8px;border-bottom:1px solid #eee">Trả phòng</td><td style="padding:8px;border-bottom:1px solid #eee">${formatDate(booking.check_out)}</td></tr>
  </table>`;

const sendBookingConfirmation = (booking) => send({
  to: booking.customer_email,
  subject: `HotelHub – Xác nhận đặt phòng #${booking.id}`,
  html: `
    <div style="font-family:Arial,sans-serif;color:#2f2924;line-height:1.55">
      <h2>Chúng tôi đã nhận yêu cầu đặt phòng</h2>
      <p>Xin chào ${escapeHtml(booking.customer_name)},</p>
      <p>Đơn đặt phòng của bạn đang được giữ chỗ. Vui lòng hoàn tất thanh toán theo thời hạn hiển thị trên hệ thống.</p>
      ${bookingSummary(booking)}
      <p><strong>Tổng tiền dự kiến: ${formatMoney(booking.total_price)}</strong></p>
    </div>`
});

const sendPaymentConfirmation = (booking, payment) => {
  const isFullyPaid = payment.paymentStatus === 'paid';
  const paymentLabel = isFullyPaid ? 'đã thanh toán thành công' : 'đã đặt cọc thành công';
  return send({
    to: booking.customer_email,
    subject: `HotelHub – ${isFullyPaid ? 'Xác nhận thanh toán' : 'Xác nhận đặt cọc'} #${booking.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;color:#2f2924;line-height:1.55">
        <h2>Thanh toán ${paymentLabel}</h2>
        <p>Xin chào ${escapeHtml(booking.customer_name)},</p>
        <p>Chúng tôi đã ghi nhận khoản thanh toán cho đơn đặt phòng <strong>#${booking.id}</strong>.</p>
        ${bookingSummary(booking)}
        <p>Số tiền vừa ghi nhận: <strong>${formatMoney(payment.paidAmount)}</strong></p>
        <p>Số tiền còn lại: <strong>${formatMoney(payment.remainingAmount)}</strong></p>
        ${payment.transactionCode ? `<p>Mã giao dịch: <strong>${escapeHtml(payment.transactionCode)}</strong></p>` : ''}
      </div>`
  });
};

module.exports = { sendBookingConfirmation, sendPaymentConfirmation };
