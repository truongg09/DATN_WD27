const db = require('../config/db');
const HttpError = require('../utils/httpError');

const run = (connection) => connection || db;

const getCustomerIdByAccount = async (accountId, connection = db) => {
  const [rows] = await run(connection).query(
    'SELECT id FROM customers WHERE accountId = ? ORDER BY id LIMIT 2',
    [accountId]
  );
  if (rows.length > 1) {
    throw new HttpError(409, 'Tài khoản có nhiều hồ sơ khách hàng, vui lòng liên hệ khách sạn');
  }
  return rows[0]?.id || null;
};

const getBookingCustomerIdForAccount = async (bookingId, accountId, connection) => {
  if (!connection) {
    throw new Error('getBookingCustomerIdForAccount requires an active database connection');
  }

  const [bookings] = await connection.query(
    'SELECT customerId FROM bookings WHERE id = ? FOR UPDATE',
    [bookingId]
  );
  if (bookings.length === 0) {
    throw new HttpError(404, 'Không tìm thấy đặt phòng');
  }

  const canonicalCustomerId = Number(bookings[0].customerId);
  if (Number.isInteger(canonicalCustomerId) && canonicalCustomerId > 0) {
    const [customers] = await connection.query(
      'SELECT id, accountId FROM customers WHERE id = ? FOR UPDATE',
      [canonicalCustomerId]
    );
    if (customers.length === 0 || Number(customers[0].accountId) !== Number(accountId)) {
      throw new HttpError(409, 'Hồ sơ khách hàng của đơn đặt phòng không khớp tài khoản');
    }
    return canonicalCustomerId;
  }

  // Chỉ fallback cho dữ liệu cũ chưa gán customerId. Không chọn
  // LIMIT 1 mù quáng vì accountId trùng có thể làm trừ nhầm ví.
  const [legacyCustomers] = await connection.query(
    'SELECT id FROM customers WHERE accountId = ? ORDER BY id LIMIT 2 FOR UPDATE',
    [accountId]
  );
  if (legacyCustomers.length === 0) {
    throw new HttpError(404, 'Không tìm thấy hồ sơ ví khách hàng');
  }
  if (legacyCustomers.length > 1) {
    throw new HttpError(409, 'Tài khoản có nhiều hồ sơ khách hàng, vui lòng liên hệ khách sạn');
  }
  return Number(legacyCustomers[0].id);
};

const summarizeTransactions = (transactions) => {
  let credited = 0;
  let withdrawn = 0;
  let bookingPayments = 0;
  let pendingWithdraw = 0;
  let pendingWithdrawalCount = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount) || 0;
    if (transaction.type === 'refund_credit' && transaction.status === 'approved') {
      credited += amount;
    } else if (
      transaction.type === 'withdrawal'
      && ['pending', 'approved'].includes(transaction.status)
    ) {
      withdrawn += amount;
      if (transaction.status === 'pending') {
        pendingWithdraw += amount;
        pendingWithdrawalCount += 1;
      }
    } else if (transaction.type === 'booking_payment' && transaction.status === 'approved') {
      bookingPayments += amount;
    }
  }

  return {
    credited,
    pendingWithdraw,
    bookingPayments,
    pendingWithdrawalCount,
    available: Math.max(credited - withdrawn - bookingPayments, 0)
  };
};

const getBalance = async (customerId, connection = db) => {
  const [transactions] = await run(connection).query(
    `SELECT type, amount, status
       FROM wallet_transactions
      WHERE customerId = ?`,
    [customerId]
  );
  const balance = summarizeTransactions(transactions);
  return {
    credited: balance.credited,
    pendingWithdraw: balance.pendingWithdraw,
    paidFromWallet: balance.bookingPayments,
    available: balance.available
  };
};

// Dùng customers làm mutex cố định cho mỗi ví. Khóa riêng các dòng
// wallet_transactions là chưa đủ khi ví chưa có dòng nào, và cũng khó
// phối hợp an toàn giữa thanh toán hai booking khác nhau.
const lockWalletAndGetBalance = async (customerId, connection) => {
  if (!connection) {
    throw new Error('lockWalletAndGetBalance requires an active database connection');
  }

  const [customers] = await connection.query(
    'SELECT id FROM customers WHERE id = ? FOR UPDATE',
    [customerId]
  );
  if (customers.length === 0) {
    throw new HttpError(404, 'Không tìm thấy ví khách hàng');
  }

  const [transactions] = await connection.query(
    `SELECT id, type, amount, status
       FROM wallet_transactions
      WHERE customerId = ?
      ORDER BY id
      FOR UPDATE`,
    [customerId]
  );
  return summarizeTransactions(transactions);
};

const balanceDelta = (transaction) => {
  const amount = Number(transaction.amount) || 0;
  if (transaction.type === 'refund_credit') {
    return transaction.status === 'approved' ? amount : 0;
  }
  if (transaction.type === 'withdrawal') {
    return ['pending', 'approved'].includes(transaction.status) ? -amount : 0;
  }
  if (transaction.type === 'booking_payment') {
    return transaction.status === 'approved' ? -amount : 0;
  }
  return 0;
};

const withRunningBalance = (transactionsNewestFirst) => {
  const oldestFirst = [...transactionsNewestFirst].reverse();
  let running = 0;

  const enriched = oldestFirst.map((transaction) => {
    const delta = balanceDelta(transaction);
    const balanceBefore = running;
    running += delta;
    return {
      ...transaction,
      balanceBefore,
      balanceAfter: running,
      balanceDelta: delta
    };
  });

  return enriched.reverse();
};

const getBookingPaymentByIdempotencyKey = async (customerId, idempotencyKey, connection) => {
  const [rows] = await run(connection).query(
    `SELECT * FROM wallet_transactions
      WHERE customerId = ? AND idempotencyKey = ? AND type = 'booking_payment'
      LIMIT 1
      FOR UPDATE`,
    [customerId, idempotencyKey]
  );
  return rows[0] || null;
};

const createBookingPayment = async (
  { customerId, paymentId, bookingId, amount, idempotencyKey, note },
  connection
) => {
  const [result] = await run(connection).query(
    `INSERT INTO wallet_transactions
       (customerId, paymentId, bookingId, type, amount, status, idempotencyKey, note, processedAt)
     VALUES (?, ?, ?, 'booking_payment', ?, 'approved', ?, ?, NOW())`,
    [customerId, paymentId, bookingId, amount, idempotencyKey, note || null]
  );
  return result.insertId;
};

const createRefundCredit = async (
  { customerId, refundId = null, paymentId = null, bookingId, amount, note },
  connection
) => {
  const [result] = await run(connection).query(
    `INSERT INTO wallet_transactions
       (customerId, refundId, paymentId, bookingId, type, amount, status, note, processedAt)
     VALUES (?, ?, ?, ?, 'refund_credit', ?, 'approved', ?, NOW())`,
    [customerId, refundId, paymentId, bookingId, amount, note || null]
  );
  return result.insertId;
};

const getTransactionBalanceSnapshot = async (customerId, transactionId, connection = db) => {
  const [transactions] = await run(connection).query(
    `SELECT * FROM wallet_transactions
      WHERE customerId = ?
      ORDER BY createdAt DESC, id DESC`,
    [customerId]
  );
  return withRunningBalance(transactions).find(
    (transaction) => Number(transaction.id) === Number(transactionId)
  ) || null;
};

module.exports = {
  getCustomerIdByAccount,
  getBookingCustomerIdForAccount,
  getBalance,
  lockWalletAndGetBalance,
  balanceDelta,
  withRunningBalance,
  getBookingPaymentByIdempotencyKey,
  createBookingPayment,
  createRefundCredit,
  getTransactionBalanceSnapshot
};
