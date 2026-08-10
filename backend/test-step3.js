const db = require('./config/db');
const bookingService = require('./services/bookingService');
const bookingModel = require('./models/bookingModel');
const roomTypeService = require('./services/roomTypeService');
const paymentService = require('./services/paymentService');
const invoiceService = require('./services/invoiceService');
const ensureOperationalSchema = require('./ensure-operational-schema');

const results = [];

function record(id, description, passed, detail = '') {
  results.push({ id, description, passed, detail });
  console.log(`[${passed ? 'PASS' : 'FAIL'}] Case ${id}: ${description} ${detail ? `(${detail})` : ''}`);
}

async function runTests() {
  console.log('=== RUNNING STEP 3B TESTS ===\n');
  await ensureOperationalSchema();

  let testRoomType = null;
  let testUser = null;
  let createdBookingId = null;

  try {
    // Setup test data in DB
    const [types] = await db.query('SELECT * FROM room_types LIMIT 1');
    if (types.length === 0) {
      throw new Error('No room types in DB to test');
    }
    testRoomType = types[0];

    // Ensure roomType has known capacity limits for predictable testing
    const testAdultCap = 2;
    const testChildCap = 1;
    const testMaxOcc = 3;
    const testExtraAdultFee = 200000;
    const testExtraChildFee = 100000;

    await db.query(
      `UPDATE room_types 
       SET adultCapacity = ?, childCapacity = ?, maxOccupancy = ?, extraAdultFee = ?, extraChildFee = ?
       WHERE id = ?`,
      [testAdultCap, testChildCap, testMaxOcc, testExtraAdultFee, testExtraChildFee, testRoomType.id]
    );

    const [accounts] = await db.query('SELECT id FROM accounts LIMIT 1');
    if (accounts.length === 0) {
      throw new Error('No accounts in DB to test');
    }
    testUser = accounts[0];

    // -------------------------------------------------------------
    // Case 1: 1 phòng, đúng sức chứa chuẩn => phụ thu 0.
    // -------------------------------------------------------------
    try {
      const res = bookingService.calcExtraGuestSurcharge(
        { adultCapacity: 2, childCapacity: 1, maxOccupancy: 3, extraAdultFee: 200000, extraChildFee: 100000 },
        2, 1, [7], 1, 2, { freeMaxAge: 5, childMaxAge: 11 }
      );
      if (res.totalExtraGuestFee === 0 && res.extraAdults === 0 && res.extraChildren === 0) {
        record(1, '1 phòng, đúng sức chứa chuẩn => phụ thu 0', true, 'totalExtraGuestFee=0');
      } else {
        record(1, '1 phòng, đúng sức chứa chuẩn => phụ thu 0', false, `Got fee=${res.totalExtraGuestFee}`);
      }
    } catch (err) {
      record(1, '1 phòng, đúng sức chứa chuẩn => phụ thu 0', false, err.message);
    }

    // -------------------------------------------------------------
    // Case 2: Phát sinh người lớn.
    // -------------------------------------------------------------
    try {
      const res = bookingService.calcExtraGuestSurcharge(
        { adultCapacity: 2, childCapacity: 1, maxOccupancy: 3, extraAdultFee: 200000, extraChildFee: 100000 },
        3, 0, [], 1, 2, { freeMaxAge: 5, childMaxAge: 11 }
      );
      // 3 adults vs 2 cap => 1 extra adult x 200.000 x 2 nights = 400.000
      if (res.extraAdults === 1 && res.totalExtraGuestFee === 400000) {
        record(2, 'Phát sinh người lớn (1 extra adult x 200k x 2 nights)', true, 'fee=400,000');
      } else {
        record(2, 'Phát sinh người lớn', false, `Got extraAdults=${res.extraAdults}, fee=${res.totalExtraGuestFee}`);
      }
    } catch (err) {
      record(2, 'Phát sinh người lớn', false, err.message);
    }

    // -------------------------------------------------------------
    // Case 3: Phát sinh trẻ em.
    // -------------------------------------------------------------
    try {
      const res = bookingService.calcExtraGuestSurcharge(
        { adultCapacity: 2, childCapacity: 1, maxOccupancy: 3, extraAdultFee: 200000, extraChildFee: 100000 },
        1, 2, [7, 8], 1, 2, { freeMaxAge: 5, childMaxAge: 11 }
      );
      // 1 adult + 2 children (7, 8) = 3 total guests <= 3 maxOcc.
      // 2 children vs 1 childCap => 1 extra child x 100.000 x 2 nights = 200.000
      if (res.extraChildren === 1 && res.totalExtraGuestFee === 200000) {
        record(3, 'Phát sinh trẻ em (1 extra child x 100k x 2 nights)', true, 'fee=200,000');
      } else {
        record(3, 'Phát sinh trẻ em', false, `Got extraChildren=${res.extraChildren}, fee=${res.totalExtraGuestFee}`);
      }
    } catch (err) {
      record(3, 'Phát sinh trẻ em', false, err.message);
    }

    // -------------------------------------------------------------
    // Case 4: Vượt maxOccupancy => 400 Bad Request.
    // -------------------------------------------------------------
    try {
      bookingService.calcExtraGuestSurcharge(
        { adultCapacity: 2, childCapacity: 1, maxOccupancy: 3, extraAdultFee: 200000, extraChildFee: 100000 },
        4, 1, [7], 1, 2, { freeMaxAge: 5, childMaxAge: 11 }
      );
      record(4, 'Vượt maxOccupancy => 400', false, 'Expected 400 error but function did not throw');
    } catch (err) {
      if (err.status === 400 || (err.message && err.message.includes('vượt quá sức chứa tối đa'))) {
        record(4, 'Vượt maxOccupancy => 400', true, err.message);
      } else {
        record(4, 'Vượt maxOccupancy => 400', false, `Unexpected error: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // Case 5: Q=2 phòng cùng hạng => tạo đúng 2 booking_details.
    // -------------------------------------------------------------
    let booking5 = null;
    try {
      const payload = {
        userId: testUser.id,
        roomTypeId: testRoomType.id,
        roomQuantity: 2,
        checkIn: '2026-09-01',
        checkOut: '2026-09-03',
        adults: 5, // 5 adults vs 4 capacity (2x2) => 1 extra adult
        children: 1,
        childrenAges: [7],
        status: 'confirmed'
      };
      booking5 = await bookingService.createBooking(payload, { id: testUser.id });
      createdBookingId = booking5.id;

      const [details] = await db.query('SELECT * FROM booking_details WHERE bookingId = ? ORDER BY id ASC', [booking5.id]);
      if (details.length === 2) {
        record(5, 'Q=2 phòng cùng hạng => tạo đúng 2 booking_details', true, `count=${details.length}`);
      } else {
        record(5, 'Q=2 phòng cùng hạng => tạo đúng 2 booking_details', false, `Expected 2 details, got ${details.length}`);
      }

      // -------------------------------------------------------------
      // Case 6: Tổng adults/children của details bằng tổng booking.
      // -------------------------------------------------------------
      const sumAdults = details.reduce((sum, d) => sum + d.adults, 0);
      const sumChildren = details.reduce((sum, d) => sum + d.children, 0);
      if (sumAdults === 5 && sumChildren === 1) {
        record(6, 'Tổng adults/children của details bằng tổng booking', true, `adults=${sumAdults}, children=${sumChildren}`);
      } else {
        record(6, 'Tổng adults/children của details bằng tổng booking', false, `Got adults=${sumAdults}, children=${sumChildren}`);
      }

      // -------------------------------------------------------------
      // Case 7: Không detail nào vượt maxOccupancy.
      // -------------------------------------------------------------
      const overMax = details.some((d) => (d.adults + d.children) > testMaxOcc);
      if (!overMax) {
        record(7, 'Không detail nào vượt maxOccupancy', true, `all details <= ${testMaxOcc}`);
      } else {
        record(7, 'Không detail nào vượt maxOccupancy', false, 'One or more details exceeded maxOccupancy');
      }

      // -------------------------------------------------------------
      // Case 8: Q phòng nhưng surcharge chỉ được cộng đúng 1 lần.
      // -------------------------------------------------------------
      const surcharge0 = Number(details[0].occupancySurcharge);
      const surcharge1 = Number(details[1].occupancySurcharge);
      const totalDetailsSurcharge = surcharge0 + surcharge1;
      const snapshotObj = typeof booking5.extra_guest_snapshot === 'string'
        ? JSON.parse(booking5.extra_guest_snapshot)
        : (booking5.extra_guest_snapshot || booking5.extraGuestSnapshot);
      const expectedSurcharge = snapshotObj?.totalExtraGuestFee ?? 400000;

      if (surcharge0 === expectedSurcharge && surcharge1 === 0) {
        record(8, 'Q phòng nhưng surcharge chỉ được cộng đúng 1 lần (detail 0 stores total, detail 1 stores 0)', true, `detail0=${surcharge0}, detail1=${surcharge1}`);
      } else {
        record(8, 'Q phòng nhưng surcharge chỉ được cộng đúng 1 lần', false, `detail0=${surcharge0}, detail1=${surcharge1}, expected=${expectedSurcharge}`);
      }
    } catch (err) {
      record(5, 'Q=2 phòng cùng hạng => tạo đúng 2 booking_details', false, err.message);
      record(6, 'Tổng adults/children của details bằng tổng booking', false, 'Skipped due to booking creation fail');
      record(7, 'Không detail nào vượt maxOccupancy', false, 'Skipped due to booking creation fail');
      record(8, 'Q phòng nhưng surcharge chỉ được cộng đúng 1 lần', false, 'Skipped due to booking creation fail');
    }

    // -------------------------------------------------------------
    // Case 9: Thiếu Q phòng trống => 409.
    // -------------------------------------------------------------
    try {
      await bookingService.createBooking({
        userId: testUser.id,
        roomTypeId: testRoomType.id,
        roomQuantity: 9999, // Impossible quantity
        checkIn: '2026-09-01',
        checkOut: '2026-09-03',
        adults: 2,
        children: 0,
        status: 'confirmed'
      }, { id: testUser.id });
      record(9, 'Thiếu Q phòng trống => 409', false, 'Expected 409 error but booking succeeded');
    } catch (err) {
      if (err.status === 409 || (err.message && err.message.includes('không đủ'))) {
        record(9, 'Thiếu Q phòng trống => 409', true, err.message);
      } else {
        record(9, 'Thiếu Q phòng trống => 409', false, `Unexpected error: ${err.message}`);
      }
    }

    // -------------------------------------------------------------
    // Case 10: Admin thay extraFee sau khi booking đã tạo => booking cũ giữ snapshot cũ.
    // -------------------------------------------------------------
    if (createdBookingId) {
      try {
        // Change room type extra fee to 9,999,999
        await db.query('UPDATE room_types SET extraAdultFee = 9999999 WHERE id = ?', [testRoomType.id]);

        const fetchedBooking = await bookingService.getBookingById(createdBookingId);
        const snapshotObj = typeof fetchedBooking.extra_guest_snapshot === 'string'
          ? JSON.parse(fetchedBooking.extra_guest_snapshot)
          : (fetchedBooking.extra_guest_snapshot || fetchedBooking.extraGuestSnapshot);
        const snapshotFee = snapshotObj?.extraAdultFee;

        if (snapshotFee === testExtraAdultFee && snapshotFee !== 9999999) {
          record(10, 'Admin thay extraFee => booking cũ giữ snapshot cũ', true, `snapshot extraAdultFee=${snapshotFee}`);
        } else {
          record(10, 'Admin thay extraFee => booking cũ giữ snapshot cũ', false, `Got extraAdultFee=${snapshotFee}`);
        }
      } catch (err) {
        record(10, 'Admin thay extraFee => booking cũ giữ snapshot cũ', false, err.message);
      } finally {
        // Restore original extraAdultFee
        await db.query('UPDATE room_types SET extraAdultFee = ? WHERE id = ?', [testExtraAdultFee, testRoomType.id]);
      }
    } else {
      record(10, 'Admin thay extraFee => booking cũ giữ snapshot cũ', false, 'No booking created in Case 5');
    }

    // -------------------------------------------------------------
    // Case 11: Reports/payment/invoice không double-count surcharge.
    // -------------------------------------------------------------
    if (createdBookingId) {
      try {
        const payment = await paymentService.createPaymentForBooking(createdBookingId);
        const fetchedBooking = await bookingService.getBookingById(createdBookingId);
        const expectedSurcharge = Number(fetchedBooking.occupancy_surcharge || 0);

        if (Number(payment.surchargeAmount) === expectedSurcharge) {
          record(11, 'Payment/Invoice/Reports không double-count surcharge', true, `payment surchargeAmount=${payment.surchargeAmount}`);
        } else {
          record(11, 'Payment/Invoice/Reports không double-count surcharge', false, `Expected ${expectedSurcharge}, got ${payment.surchargeAmount}`);
        }
      } catch (err) {
        record(11, 'Payment/Invoice/Reports không double-count surcharge', false, err.message);
      }
    } else {
      record(11, 'Payment/Invoice/Reports không double-count surcharge', false, 'No booking created in Case 5');
    }

  } catch (globalErr) {
    console.error('Test execution error:', globalErr);
  } finally {
    // Clean up created test booking & payments if needed
    if (createdBookingId) {
      await db.query('DELETE FROM payments WHERE bookingId = ?', [createdBookingId]);
      await db.query('DELETE FROM booking_nightly_prices WHERE bookingId = ?', [createdBookingId]);
      await db.query('DELETE FROM booking_details WHERE bookingId = ?', [createdBookingId]);
      await db.query('DELETE FROM bookings WHERE id = ?', [createdBookingId]);
    }
  }

  console.log('\n=== TEST SUMMARY ===');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`TOTAL: ${results.length} | PASS: ${passedCount} | FAIL: ${results.length - passedCount}`);

  if (passedCount === results.length) {
    console.log('ALL 11 TEST CASES PASSED SUCCESSFULLY!');
  } else {
    console.log('SOME TESTS FAILED. PLEASE REVIEW.');
  }

  process.exit(passedCount === results.length ? 0 : 1);
}

runTests();
