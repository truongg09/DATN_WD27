const formatPayment = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    bookingId: row.bookingId,
    roomAmount: Number(row.roomAmount ?? 0),
    serviceAmount: Number(row.serviceAmount ?? 0),
    surchargeAmount: Number(row.surchargeAmount ?? 0),
    discountAmount: Number(row.discountAmount ?? 0),
    depositAmount: Number(row.depositAmount ?? 0),
    paidAmount: Number(row.paidAmount ?? 0),
    remainingAmount: Number(row.remainingAmount ?? 0),
    totalAmount: Number(row.totalAmount ?? 0),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    transactionCode: row.transactionCode || undefined,
    paymentDate: row.paymentDate || undefined,
    customerName: row.customer_name,
    roomNumber: row.room_number,
    bookingStatus: row.booking_status
  };
};

const formatInvoice = (row) => {
  if (!row) return null;

  const roomAmount = Number(row.subtotal ?? row.roomAmount ?? 0);
  const discountAmount = Number(row.discountAmount ?? 0);

  return {
    id: row.id,
    invoiceNumber: row.invoiceCode,
    bookingId: row.bookingId,
    paymentId: row.paymentId,
    userId: row.user_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    roomNumber: row.room_number,
    roomTypeName: row.room_type_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    roomAmount,
    serviceAmount: 0,
    discountAmount,
    totalAmount: Number(row.totalAmount ?? 0),
    status: row.status,
    issuedAt: row.invoiceDate,
    createdAt: row.invoiceDate
  };
};

module.exports = {
  formatPayment,
  formatInvoice
};
