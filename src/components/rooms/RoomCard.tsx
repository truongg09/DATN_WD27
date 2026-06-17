import { Link } from 'react-router-dom'
import type { Room } from '../../data/rooms'

type RoomCardProps = {
  room: Room
}

function RoomCard({ room }: RoomCardProps) {
  return (
    <article className="ml-room-card">
      <Link to={`/rooms/${room.slug}`}>
        <img src={room.image} alt={room.name} />
      </Link>
      <div className="ml-room-card__body">
        <span>From ${room.price}/night</span>
        <h3>
          <Link to={`/rooms/${room.slug}`}>{room.name}</Link>
        </h3>
        <p>{room.description}</p>
        <div className="ml-room-card__meta">
          <span>{room.size}</span>
          <span>{room.guests} guests</span>
          <span>{room.beds}</span>
        </div>
      </div>
    </article>
  )
}

export default RoomCard
