import { useParams } from 'react-router-dom'
import EmptyState from '../../components/common/EmptyState'
import PageBanner from '../../components/common/PageBanner'
import BookingSidebar from '../../components/rooms/BookingSidebar'
import RoomAmenities from '../../components/rooms/RoomAmenities'
import RoomGallery from '../../components/rooms/RoomGallery'
import { findRoom } from '../../data/rooms'

function RoomDetail() {
  const { slug } = useParams()
  const room = findRoom(slug)

  if (!room) {
    return (
      <EmptyState
        title="Room not found"
        message="The room you are looking for is not available in the current catalog."
        actionLabel="View Rooms"
        actionTo="/rooms"
      />
    )
  }

  return (
    <>
      <PageBanner title={room.name} description={room.tagline} image={room.image} />
      <section className="ml-section">
        <div className="ml-container ml-detail-layout">
          <article className="ml-room-detail">
            <RoomGallery room={room} />
            <h1>Room Overview</h1>
            <p>{room.longDescription}</p>
            <div className="ml-room-detail__facts">
              <span>{room.size}</span>
              <span>{room.guests} guests</span>
              <span>{room.beds}</span>
            </div>
            <h2>Amenities</h2>
            <RoomAmenities amenities={room.amenities} />
          </article>
          <BookingSidebar room={room} />
        </div>
      </section>
    </>
  )
}

export default RoomDetail
