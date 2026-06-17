import { rooms } from '../../data/rooms'
import SectionTitle from '../common/SectionTitle'
import RoomCard from '../rooms/RoomCard'

function FeaturedRooms() {
  return (
    <section className="ml-section">
      <div className="ml-container">
        <SectionTitle
          eyebrow="Rooms"
          title="Rooms and Suites"
          description="A React version of the room slider content, prepared for later API data."
        />
        <div className="ml-room-grid">
          {rooms.slice(0, 3).map((room) => (
            <RoomCard key={room.slug} room={room} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturedRooms
