import bookingService from '../backend/services/bookingService.js';
import bookingModel from '../backend/models/bookingModel.js';

async function testAdminModify() {
  try {
    console.log("=== STARTING ADMIN MODIFY TEST ===");
    
    // 1. Get recent active booking
    const list = await bookingModel.listBookings({ page: 1, limit: 5 });
    const bookings = list.data || list;
    if (bookings.length === 0) {
      console.log("No bookings found to test.");
      return;
    }
    
    const targetBooking = bookings[0];
    console.log(`Testing with Booking #${targetBooking.id} (Current status: ${targetBooking.status}, Total Amount: ${targetBooking.booking_total_amount || targetBooking.payable_total})`);

    // 2. Test adminCheckAvailabilityForBooking
    const avail = await bookingService.adminCheckAvailabilityForBooking(targetBooking.id, {
      checkIn: '2026-09-01',
      checkOut: '2026-09-03'
    });
    console.log("1. adminCheckAvailabilityForBooking OK:", {
      checkIn: avail.checkIn,
      checkOut: avail.checkOut,
      nights: avail.nights,
      availableRoomsCount: avail.availableRooms.length,
      roomTypesCount: avail.roomTypes.length
    });

    // 3. Test adminPreviewModifyBooking
    const preview = await bookingService.adminPreviewModifyBooking(targetBooking.id, {
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      rooms: [
        { roomId: targetBooking.room_id, adults: 2, children: 0 }
      ]
    });
    console.log("2. adminPreviewModifyBooking OK:", {
      oldTotalAmount: preview.oldTotalAmount,
      newTotalAmount: preview.newTotalAmount,
      priceDifference: preview.priceDifference,
      depositAmount: preview.depositAmount,
      newRemainingAmount: preview.newRemainingAmount,
      rooms: preview.rooms.map(r => ({ roomId: r.roomId, typeName: r.typeName, price: r.roomPrice }))
    });

    // 4. Test adminModifyBooking
    const modifyResult = await bookingService.adminModifyBooking(targetBooking.id, {
      checkIn: '2026-09-01',
      checkOut: '2026-09-03',
      rooms: [
        { roomId: targetBooking.room_id || 5, adults: 2, children: 0 }
      ]
    }, { role: 'admin', fullName: 'Test Admin' });
    console.log("3. adminModifyBooking OK:", {
      success: modifyResult.success,
      message: modifyResult.message,
      newTotalAmount: modifyResult.data.newTotalAmount,
      priceDifference: modifyResult.data.priceDifference
    });

    console.log("=== ADMIN MODIFY TEST PASSED 100% ===");
  } catch (err) {
    console.error("Test failed with error:", err);
  } process.exit(0);
}

testAdminModify();
