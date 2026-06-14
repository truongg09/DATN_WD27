import type { Room } from '../../data/rooms'

type RoomGalleryProps = {
  room: Room
}

function RoomGallery({ room }: RoomGalleryProps) {
  return (
    <div className="ml-room-gallery">
      {room.gallery.map((image) => (
        <img key={image} src={image} alt={room.name} />
      ))}
    </div>
  )
}

export default RoomGallery
