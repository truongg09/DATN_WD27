import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import RoomList from '../../components/rooms/RoomList'
import { rooms } from '../../data/rooms'

function Rooms() {
  return (
    <>
      <PageBanner title="Rooms and Suites" description="Browse the room catalog prepared for the hotel booking flow." />
      <section className="ml-section">
        <div className="ml-container">
          <SectionTitle
            eyebrow="Stay"
            title="Browse Available Rooms"
            description="Each room card is driven by TypeScript data and can later connect to an API."
          />
          <RoomList rooms={rooms} />
        </div>
      </section>
    </>
  )
}

export default Rooms
