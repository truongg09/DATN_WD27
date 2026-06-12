import type { Room } from '../../data/rooms'
import RoomCard from './RoomCard'

type RoomListProps = {
  rooms: Room[]
}

function RoomList({ rooms }: RoomListProps) {
  return (
    <div className="ml-room-grid">
      {rooms.map((room) => (
        <RoomCard key={room.slug} room={room} />
      ))}
    </div>
  )
}

export default RoomList
