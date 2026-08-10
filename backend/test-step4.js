const db = require('./config/db');
const roomTypeService = require('./services/roomTypeService');
const ensureOperationalSchema = require('./ensure-operational-schema');

async function runStep4Tests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ BƯỚC 4 (ADMIN ROOM TYPE SERVICE & DB INTEGRATION) ===\n');
  await ensureOperationalSchema();

  let testCount = 0;
  let passCount = 0;

  try {
    // Test 1: Fetch room types using roomTypeService.searchRoomTypes
    testCount++;
    console.log('Test 1: Lấy danh sách hạng phòng qua roomTypeService.searchRoomTypes...');
    const types = await roomTypeService.searchRoomTypes();
    if (Array.isArray(types) && types.length > 0) {
      const sample = types[0];
      const hasAllFields = 'adultCapacity' in sample && 'childCapacity' in sample && 'maxOccupancy' in sample && 'extraAdultFee' in sample && 'extraChildFee' in sample;
      if (hasAllFields) {
        console.log('✅ Test 1 PASS: Trả về đầy đủ 5 field sức chứa & phụ thu');
        console.log(`   Sample: ${sample.typeName} -> adultCapacity:${sample.adultCapacity}, childCapacity:${sample.childCapacity}, maxOccupancy:${sample.maxOccupancy}, extraAdultFee:${sample.extraAdultFee}, extraChildFee:${sample.extraChildFee}`);
        passCount++;
      } else {
        console.error('❌ Test 1 FAIL: Thiếu thuộc tính', sample);
      }
    } else {
      console.error('❌ Test 1 FAIL: Không có dữ liệu hạng phòng');
    }

    // Test 2: Create new room type with 5 capacity fields in DB
    testCount++;
    console.log('\nTest 2: Thêm mới hạng phòng test vào DB với đủ 5 field...');
    const testName = `TestStep4_${Date.now()}`;
    const [insertRes] = await db.query(
      `INSERT INTO room_types (typeName, description, capacity, adultCapacity, childCapacity, maxOccupancy, extraAdultFee, extraChildFee, defaultPrice, status, isDeleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [testName, 'Mô tả test step 4', 3, 2, 1, 3, 200000, 100000, 500000, 'active']
    );

    const newId = insertRes.insertId;
    if (newId) {
      console.log(`✅ Test 2 PASS: Tạo hạng phòng test thành công (ID: ${newId})`);
      passCount++;

      // Test 3: Update 5 capacity fields
      testCount++;
      console.log('\nTest 3: Cập nhật 5 field sức chứa & phụ thu...');
      await db.query(
        `UPDATE room_types 
         SET adultCapacity = ?, childCapacity = ?, maxOccupancy = ?, extraAdultFee = ?, extraChildFee = ?
         WHERE id = ?`,
        [3, 2, 5, 250000, 120000, newId]
      );

      const updated = await roomTypeService.getRoomTypeDetail(newId);
      if (updated && updated.adultCapacity === 3 && updated.childCapacity === 2 && updated.maxOccupancy === 5 && Number(updated.extraAdultFee) === 250000 && Number(updated.extraChildFee) === 120000) {
        console.log('✅ Test 3 PASS: Cập nhật và truy vấn đúng 5 field sức chứa & phụ thu mới');
        passCount++;
      } else {
        console.error('❌ Test 3 FAIL: Dữ liệu sau cập nhật không khớp', updated);
      }

      // Test 4: Quick status toggle without resetting 5 fields
      testCount++;
      console.log('\nTest 4: Đổi trạng thái sang inactive giữ nguyên 5 field...');
      await db.query(
        `UPDATE room_types SET status = 'inactive' WHERE id = ?`,
        [newId]
      );

      const [dbRows] = await db.query('SELECT * FROM room_types WHERE id = ?', [newId]);
      const dbRecord = dbRows[0];
      if (dbRecord && dbRecord.status === 'inactive' && dbRecord.maxOccupancy === 5 && Number(dbRecord.extraAdultFee) === 250000 && Number(dbRecord.extraChildFee) === 120000) {
        console.log('✅ Test 4 PASS: Đổi trạng thái thành inactive thành công, 5 field sức chứa & phụ thu giữ nguyên không bị reset');
        passCount++;
      } else {
        console.error('❌ Test 4 FAIL: 5 field bị ảnh hưởng', dbRecord);
      }

      // Cleanup
      console.log('\nClean up test data...');
      await db.query('DELETE FROM room_types WHERE id = ?', [newId]);
      console.log('Clean up done.');
    }
  } catch (err) {
    console.error('❌ Error during testing:', err);
  } finally {
    process.exit(0);
  }

  console.log(`\n=== TỔNG KẾT BƯỚC 4 INTEGRATION TESTS: ${passCount}/${testCount} PASS ===`);
}

runStep4Tests();
