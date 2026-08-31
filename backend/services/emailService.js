const nodemailer = require('nodemailer');

const formatMoney = (amount) => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(amount || 0))}₫`;
const formatDate = (date) => date
  ? new Date(date).toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
  : '-';
const formatRequestedDateTime = (date, time, dayOffset = 0) => {
  if (!date) return '-';
  const offset = Number(dayOffset || 0);
  const adjustedDate = offset > 0
    ? new Date(new Date(date).getTime() + offset * 24 * 60 * 60 * 1000)
    : date;
  const requestedTime = time ? String(time).slice(0, 5) : null;
  return requestedTime
    ? `${escapeHtml(requestedTime)} - ${formatDate(adjustedDate)}`
    : formatDate(adjustedDate);
};
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

// ctaUrl/ctaLabel để trống thì nút vẫn trỏ về trang chi tiết đặt phòng như cũ;
// email không gắn với booking (VD email tặng voucher) truyền URL riêng vào.
const emailLayout = ({ previewText, eyebrow, title, intro, content, bookingId, ctaUrl, ctaLabel }) => `
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
                  <a href="${ctaUrl || `${FRONTEND_URL}/booking/${Number(bookingId)}`}"
                    style="display:inline-block;background:#a98561;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 24px;border-radius:10px">
                    ${escapeHtml(ctaLabel || 'Xem chi tiết đặt phòng')}
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

const formatBookingServices = (services) => {
  const usedServices = Array.isArray(services)
    ? services.filter((service) => service.status === 'used')
    : [];
  if (usedServices.length === 0) return 'Không sử dụng';
  return usedServices
    .map((service) => `${escapeHtml(service.serviceName || 'Dịch vụ')} × ${Number(service.quantity || 1)}`)
    .join('<br>');
};

const bookingSummary = (booking, payment = null) => `
  <table role="presentation" style="border-collapse:collapse;width:100%">
    ${summaryRow('Mã đặt phòng', `<strong>#${Number(booking.id)}</strong>`)}
    ${summaryRow('Hạng phòng', escapeHtml(booking.room_type_name || '—'))}
    ${summaryRow(
      'Check-in',
      formatRequestedDateTime(
        booking.check_in,
        booking.requested_check_in_time,
        booking.requested_check_in_day_offset
      )
    )}
    ${summaryRow(
      'Check-out',
      formatRequestedDateTime(booking.check_out, booking.requested_check_out_time)
    )}
    ${summaryRow('Dịch vụ', formatBookingServices(booking.services))}
    ${summaryRow('Tổng giá', `<strong>${formatMoney(payment?.totalAmount ?? booking.total_price)}</strong>`)}
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

const bookingInformation = (booking, payment = null) => `
  <div style="margin-bottom:9px;color:#2f2924;font-size:14px;font-weight:700">Thông tin đặt phòng</div>
  <div style="border:1px solid #eee7df;border-radius:12px;padding:8px 20px">
    ${bookingSummary(booking, payment)}
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
        ${bookingInformation(booking, payment)}
        ${!isFullyPaid ? `
          <div style="margin-top:18px;background:#fff7e8;border:1px solid #f0d7ad;border-radius:12px;padding:14px 18px;color:#704b28;font-size:14px;line-height:1.6">
            <strong>Đã ghi nhận tiền cọc.</strong><br>
            Bạn còn phải thanh toán <strong>${formatMoney(payment.remainingAmount)}</strong> trước khi nhận phòng.
          </div>` : ''}
        <div style="margin-top:18px;background:${isFullyPaid ? '#edf8f1' : '#f7f1eb'};border-radius:12px;padding:18px 20px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td>
                <div style="color:#81766d;font-size:13px">${isFullyPaid ? 'Tổng đã thanh toán' : 'Đã đặt cọc'}</div>
                <div style="margin-top:5px;color:${isFullyPaid ? '#237a49' : '#8d6240'};font-size:23px;font-weight:700">
                  ${formatMoney(payment.paidAmount)}
                </div>
              </td>
              <td align="right">
                <div style="color:#81766d;font-size:13px">Còn phải thanh toán</div>
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

const sendCheckoutThankYou = (booking, payment) => send({
  to: booking.customer_email,
  subject: `[HotelHub] Cảm ơn bạn đã lưu trú cùng chúng tôi #${booking.id}`,
  html: emailLayout({
    previewText: 'HotelHub chân thành cảm ơn bạn đã lựa chọn và lưu trú cùng chúng tôi.',
    eyebrow: 'Hẹn gặp lại bạn',
    title: 'Cảm ơn bạn đã lựa chọn HotelHub',
    intro: `Xin chào <strong>${escapeHtml(booking.customer_name || 'Quý khách')}</strong>, bạn đã hoàn tất thủ tục trả phòng. HotelHub chân thành cảm ơn bạn đã tin tưởng và lựa chọn chúng tôi cho kỳ nghỉ vừa qua.`,
    bookingId: booking.id,
    content: `
      ${bookingInformation(booking, payment)}
      <div style="margin-top:18px;background:#f7f1eb;border-radius:12px;padding:20px;color:#655b53;font-size:15px;line-height:1.75">
        Kính chúc bạn và gia đình luôn mạnh khỏe, nhiều niềm vui và có thật nhiều hành trình đáng nhớ.<br><br>
        Chúng tôi hy vọng đã mang đến cho bạn một kỳ nghỉ thoải mái và rất mong được chào đón bạn trở lại HotelHub trong thời gian gần nhất.
      </div>`
  })
});

// Email đặt lại mật khẩu không gắn với đơn nào nên dùng bố cục riêng, không tái
// sử dụng emailLayout (bố cục đó luôn kèm nút "Xem chi tiết đặt phòng").
// Diễn giải mức giảm giống hệt chữ nghĩa của thông báo trong web (xem
// buildVoucherNotification ở routes/vouchers.js) để khách đọc email và mở app
// thấy cùng một nội dung.
const formatVoucherDiscount = (voucher) => (voucher.discountType === 'percentage'
  ? `Giảm ${Number(voucher.discountValue)}%${voucher.maxDiscount ? ` (tối đa ${formatMoney(voucher.maxDiscount)})` : ''}`
  : `Giảm ${formatMoney(voucher.discountValue)}`);

const voucherDetails = (voucher) => `
  <div style="margin-bottom:9px;color:#2f2924;font-size:14px;font-weight:700">Thông tin ưu đãi</div>
  <div style="border:1px solid #eee7df;border-radius:12px;padding:8px 20px">
    <table role="presentation" style="border-collapse:collapse;width:100%">
      ${summaryRow('Mức giảm', `<strong>${escapeHtml(formatVoucherDiscount(voucher))}</strong>`)}
      ${summaryRow('Đơn tối thiểu', voucher.minBookingAmount ? formatMoney(voucher.minBookingAmount) : 'Không yêu cầu')}
      ${summaryRow('Hiệu lực', `${formatDate(voucher.startDate)} - ${formatDate(voucher.endDate)}`)}
      ${summaryRow('Hạng phòng áp dụng', voucher.roomTypeNames ? escapeHtml(voucher.roomTypeNames) : 'Tất cả hạng phòng')}
    </table>
  </div>`;

// Một mẫu email dùng cho ba hoàn cảnh khác nhau, chỉ đổi giọng văn:
//  - mặc định: admin tặng voucher cho khách
//  - isCompensation: hệ thống tự cấp voucher đền bù khi đơn bị hủy/no-show,
//    khách nhận trong hoàn cảnh không vui nên phải mở lời xin lỗi
//  - isUpdate: admin sửa thông tin voucher khách đang giữ, cần báo lại điều kiện mới
const sendVoucherGrantedEmail = ({
  to,
  customerName,
  voucher,
  isCompensation = false,
  isUpdate = false,
  previousCode = null
}) => {
  const subjectPrefix = isUpdate
    ? 'Cập nhật ưu đãi'
    : (isCompensation ? 'Mã giảm giá đền bù' : 'Bạn nhận được mã giảm giá');

  const eyebrow = isUpdate
    ? 'Ưu đãi vừa được cập nhật'
    : (isCompensation ? 'Lời xin lỗi từ HotelHub' : 'Ưu đãi dành riêng cho bạn');

  const title = isUpdate
    ? 'Mã giảm giá của bạn vừa được cập nhật'
    : (isCompensation ? 'Mã giảm giá đền bù cho đơn của bạn' : 'Bạn vừa nhận được một mã giảm giá');

  const greeting = `Xin chào <strong>${escapeHtml(customerName || 'Quý khách')}</strong>`;
  const intro = isUpdate
    ? `${greeting}, HotelHub vừa cập nhật thông tin mã giảm giá bạn đang giữ. Dưới đây là điều kiện áp dụng mới nhất.`
    : (isCompensation
      ? `${greeting}, HotelHub rất tiếc vì sự bất tiện với đơn đặt phòng vừa qua. Chúng tôi gửi bạn mã giảm giá dưới đây như một lời xin lỗi.`
      : `${greeting}, HotelHub gửi tặng riêng bạn mã giảm giá dưới đây. Mã đã có sẵn trong tài khoản, bạn chỉ cần chọn khi thanh toán.`);

  // Đổi mã là thay đổi dễ gây nhầm nhất: khách có thể đã lưu mã cũ ở đâu đó,
  // nên phải nói thẳng mã cũ không còn dùng được.
  const codeChangedNote = isUpdate && previousCode && previousCode !== voucher.code
    ? `<div style="margin-bottom:18px;background:#fdf3ef;border:1px solid #f0d3c6;border-radius:12px;padding:14px 18px;color:#8a4b33;font-size:13px;line-height:1.7">
         Mã cũ <strong>${escapeHtml(previousCode)}</strong> đã được thay bằng mã mới bên dưới. Vui lòng dùng mã mới khi đặt phòng.
       </div>`
    : '';

  return send({
    to,
    subject: `[HotelHub] ${subjectPrefix} ${voucher.code}`,
    html: emailLayout({
      previewText: `${formatVoucherDiscount(voucher)} với mã ${voucher.code}, dùng đến hết ${formatDate(voucher.endDate)}.`,
      eyebrow,
      title,
      intro,
      ctaUrl: `${FRONTEND_URL}/profile?tab=vouchers`,
      ctaLabel: 'Xem ưu đãi của tôi',
      content: `
        ${codeChangedNote}
        <div style="margin-bottom:18px;background:#f7f1eb;border:1px dashed #d8bfa2;border-radius:12px;padding:20px;text-align:center">
          <div style="color:#81766d;font-size:13px">Mã giảm giá của bạn</div>
          <div style="margin:8px 0 6px;color:#8d6240;font-size:30px;font-weight:700;letter-spacing:2px">${escapeHtml(voucher.code)}</div>
          <div style="color:#655b53;font-size:14px">${escapeHtml(formatVoucherDiscount(voucher))}</div>
        </div>
        ${voucherDetails(voucher)}
        <div style="margin-top:18px;color:#81766d;font-size:13px;line-height:1.7">
          ${isUpdate
            ? 'Thông tin phía trên là điều kiện áp dụng mới nhất, thay thế cho email trước đó.'
            : 'Mã này được cấp riêng cho tài khoản của bạn và chỉ dùng được một lần.'}
          Hãy áp dụng trước ngày ${escapeHtml(formatDate(voucher.endDate))} để không bỏ lỡ ưu đãi.
        </div>`
    })
  });
};

const sendPasswordResetEmail = ({ to, name, resetUrl, expiresInMinutes }) => send({
  to,
  subject: '[HotelHub] Đặt lại mật khẩu',
  html: `
  <!doctype html>
  <html lang="vi">
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Đặt lại mật khẩu</title></head>
    <body style="margin:0;padding:0;background:#f4f1ed;font-family:Arial,'Helvetica Neue',sans-serif;color:#2f2924">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ed">
        <tr><td align="center" style="padding:32px 12px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
            style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(64,48,34,.08)">
            <tr><td style="background:#a98561;padding:26px 34px;color:#fff;font-size:25px;font-weight:700">HotelHub</td></tr>
            <tr><td style="padding:38px 34px 8px">
              <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;color:#201b17">Đặt lại mật khẩu</h1>
              <p style="margin:0;color:#655b53;font-size:15px;line-height:1.7">
                Xin chào <strong>${escapeHtml(name || 'Quý khách')}</strong>, chúng tôi nhận được yêu cầu đặt lại mật khẩu
                cho tài khoản này. Nhấn nút bên dưới để chọn mật khẩu mới. Liên kết có hiệu lực trong
                <strong>${Number(expiresInMinutes)} phút</strong> và chỉ dùng được một lần.
              </p>
            </td></tr>
            <tr><td align="center" style="padding:26px 34px">
              <a href="${resetUrl}"
                style="display:inline-block;background:#a98561;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 26px;border-radius:10px">
                Đặt lại mật khẩu
              </a>
            </td></tr>
            <tr><td style="padding:0 34px 30px;color:#81766d;font-size:13px;line-height:1.7">
              Nếu nút không bấm được, hãy sao chép liên kết sau vào trình duyệt:<br>
              <span style="color:#8d6b4d;word-break:break-all">${escapeHtml(resetUrl)}</span>
            </td></tr>
            <tr><td style="background:#faf8f5;border-top:1px solid #eee7df;padding:24px 34px;color:#81766d;font-size:12px;line-height:1.7">
              Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.<br>
              Cần hỗ trợ? Liên hệ <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#8d6b4d">${escapeHtml(SUPPORT_EMAIL)}</a>.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>`
});

module.exports = {
  sendBookingConfirmation,
  sendPaymentConfirmation,
  sendCheckoutThankYou,
  sendPasswordResetEmail,
  sendVoucherGrantedEmail,
  isEmailConfigured: isConfigured
};