const db = require('./config/db');
const bookingService = require('./services/bookingService');
const bookingModel = require('./models/bookingModel');

async function runStep6Tests() {
  console.log('=== RUNNING STEP 6 VERIFICATION TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // Check/Get Standard room type
    const [types] = await db.query("SELECT * FROM room_types WHERE typeName LIKE '%Standard%' LIMIT 1");
    if (types.length === 0) {
      throw new Error("Không tìm thấy hạng phòng Standard trong DB để test");
    }
    const standardType = types[0];
    console.log(`Testing with Room Type: ${standardType.typeName} (ID: ${standardType.id})`);
    console.log(`  adultCapacity=${standardType.adultCapacity}, childCapacity=${standardType.childCapacity}, maxOccupancy=${standardType.maxOccupancy}`);
    console.log(`  extraAdultFee=${standardType.extraAdultFee}, extraChildFee=${standardType.extraChildFee}\n`);

    const childrenPolicy = { freeMaxAge: 5, childMaxAge: 11, surchargePerNight: 200000 };

    // Test 2: 1 Standard, 2 NL (0 TE) -> Extra fee = 0
    {
      const res = bookingService.calcExtraGuestSurcharge(standardType, 2, 0, [], 1, 2, childrenPolicy);
      assert(res.totalExtraGuestFee === 0, 'Test 2: 1 Standard 2 NL => phụ thu 0đ');
      assert(res.snapshot.extraAdults === 0 && res.snapshot.extraChildren === 0, 'Test 2: extraAdults=0, extraChildren=0');
    }

    // Test 3: 1 Standard, 3 NL (0 TE) -> 1 NL phát sinh
    {
      const res = bookingService.calcExtraGuestSurcharge(standardType, 3, 0, [], 1, 2, childrenPolicy);
      const expectedFee = 1 * Number(standardType.extraAdultFee) * 2;
      assert(res.snapshot.extraAdults === 1, 'Test 3: 1 Standard 3 NL => 1 NL phát sinh');
      assert(res.totalExtraGuestFee === expectedFee, `Test 3: Phụ thu = ${expectedFee}đ (${res.totalExtraGuestFee}đ)`);
    }

    // Test 4: 1 Standard, 2 NL + 1 TE 7 tuổi => Phụ thu TE đúng
    {
      const res = bookingService.calcExtraGuestSurcharge(standardType, 2, 1, [7], 1, 2, childrenPolicy);
      const expectedChildFee = 1 * Number(standardType.extraChildFee) * 2;
      assert(res.snapshot.extraChildren === 1, 'Test 4: 1 Standard 2 NL + 1 TE (7t) => 1 TE phát sinh');
      assert(res.totalExtraGuestFee === expectedChildFee, `Test 4: Phụ thu TE = ${expectedChildFee}đ (${res.totalExtraGuestFee}đ)`);
    }

    // Test 5: 1 Standard, 2 NL + 1 TE 4 tuổi => Đúng children_policy backend (0-5t miễn phí)
    {
      const res = bookingService.calcExtraGuestSurcharge(standardType, 2, 1, [4], 1, 2, childrenPolicy);
      assert(res.snapshot.extraChildren === 0, 'Test 5: 1 Standard 2 NL + 1 TE (4t) => 0 TE phát sinh (miễn phí)');
      assert(res.totalExtraGuestFee === 0, 'Test 5: Phụ thu TE = 0đ');
    }

    // Test 6: 5 khách Standard (maxOcc 3) => Q=1 phải bị từ chối
    {
      let errorThrown = false;
      try {
        bookingService.calcExtraGuestSurcharge(standardType, 5, 0, [], 1, 1, childrenPolicy);
      } catch (err) {
        errorThrown = true;
        assert(err.statusCode === 400, 'Test 6: 5 khách Standard với Q=1 bị chặn lỗi 400 vượt sức chứa');
      }
      assert(errorThrown, 'Test 6: calcExtraGuestSurcharge đã ném ngoại lệ khi 5 khách vào Q=1');
    }

    // Test 7 & 8 & 9 & 10: Tạo booking thực tế với Q=2 cho 5 khách (3 NL, 2 TE [7, 8])
    {
      const [accounts] = await db.query("SELECT id FROM accounts WHERE role = 'customer' LIMIT 1");
      const testUserId = accounts.length > 0 ? accounts[0].id : 1;

      const checkIn = '2026-11-20';
      const checkOut = '2026-11-23'; // 3 nights

      const payload = {
        userId: testUserId,
        roomTypeId: standardType.id,
        roomQuantity: 2,
        checkIn,
        checkOut,
        adults: 3,
        children: 2,
        childrenAges: [7, 8],
        guestName: 'Test Step 6',
        guestEmail: 'teststep6@example.com',
        guestPhone: '0987654321',
        status: 'confirmed'
      };

      const result = await bookingService.createBooking(payload, { userId: testUserId, role: 'customer' });
      assert(result.id > 0, `Test 7: createBooking thành công với Q=2, bookingId=${result.id}`);

      const [details] = await db.query("SELECT * FROM booking_details WHERE bookingId = ?", [result.id]);
      assert(details.length === 2, `Test 8: Backend tạo đúng ${details.length}/2 booking_details`);

      const [bookings] = await db.query("SELECT extraGuestSnapshot, totalAmount FROM bookings WHERE id = ?", [result.id]);
      const rawSnapshot = bookings[0].extraGuestSnapshot;
      const snapshot = typeof rawSnapshot === 'string' ? JSON.parse(rawSnapshot) : rawSnapshot;

      assert(snapshot.roomQuantity === 2, 'Test 9: Snapshot lưu roomQuantity = 2');
      assert(snapshot.extraAdults === 0 && snapshot.extraChildren === 2, 'Test 9: Sức chứa 2 phòng là 4 NL + 0 TE (childCap=0), 5 khách (3 NL + 2 TE) => Extra adults = 0, Extra children = 2');

      // Check double-counting on occupancySurcharge:
      assert(Number(details[0].occupancySurcharge) === snapshot.totalExtraGuestFee, `Test 10: detail[0].occupancySurcharge (${details[0].occupancySurcharge}) khớp snapshot (${snapshot.totalExtraGuestFee})`);
      assert(Number(details[1].occupancySurcharge) === 0, `Test 10: detail[1].occupancySurcharge = 0 (tránh double count)`);
    }

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error('Test script error:', err);
  } finally {
    await db.end();
  }
}

runStep6Tests();
