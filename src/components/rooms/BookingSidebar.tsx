import type { Room } from '../../data/rooms'

type BookingSidebarProps = {
  room: Room
}

function BookingSidebar({ room }: BookingSidebarProps) {
  return (
    <aside className="ml-booking-sidebar">
      <h2>${room.price}</h2>
      <span>per night</span>
      <label>
        Check In
        <input type="date" defaultValue="2026-06-12" />
      </label>
      <label>
        Check Out
        <input type="date" defaultValue="2026-06-14" />
      </label>
      <label>
        Guests
        <input min="1" type="number" defaultValue={room.guests} />
      </label>
      <button className="ml-btn ml-btn--primary" type="button">
        Reserve Room
      </button>
    </aside>
  )
}

export default BookingSidebar
