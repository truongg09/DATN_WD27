import { useMemo, useState } from 'react'
import PageBanner from '../../components/common/PageBanner'
import SectionTitle from '../../components/common/SectionTitle'
import RoomList from '../../components/rooms/RoomList'
import { rooms } from '../../data/rooms'

type SortOption = 'featured' | 'price-asc' | 'price-desc' | 'capacity-desc'

function Rooms() {
  const [searchTerm, setSearchTerm] = useState('')
  const [guestCount, setGuestCount] = useState('all')
  const [priceRange, setPriceRange] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('featured')

  const filteredRooms = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase()

    return rooms
      .filter((room) => {
        const matchesSearch =
          !normalizedSearchTerm ||
          [room.name, room.tagline, room.description, room.beds, ...room.amenities].some((value) =>
            value.toLowerCase().includes(normalizedSearchTerm),
          )

        const matchesGuests = guestCount === 'all' || room.guests >= Number(guestCount)

        const matchesPrice =
          priceRange === 'all' ||
          (priceRange === 'under-250' && room.price < 250) ||
          (priceRange === '250-400' && room.price >= 250 && room.price <= 400) ||
          (priceRange === 'over-400' && room.price > 400)

        return matchesSearch && matchesGuests && matchesPrice
      })
      .toSorted((firstRoom, secondRoom) => {
        if (sortBy === 'price-asc') {
          return firstRoom.price - secondRoom.price
        }

        if (sortBy === 'price-desc') {
          return secondRoom.price - firstRoom.price
        }

        if (sortBy === 'capacity-desc') {
          return secondRoom.guests - firstRoom.guests
        }

        return rooms.indexOf(firstRoom) - rooms.indexOf(secondRoom)
      })
  }, [guestCount, priceRange, searchTerm, sortBy])

  const resetFilters = () => {
    setSearchTerm('')
    setGuestCount('all')
    setPriceRange('all')
    setSortBy('featured')
  }

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
          <div className="ml-room-tools" aria-label="Room filters">
            <label>
              Search rooms
              <input
                type="search"
                value={searchTerm}
                placeholder="Room name, bed, amenity..."
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <label>
              Guests
              <select value={guestCount} onChange={(event) => setGuestCount(event.target.value)}>
                <option value="all">Any guests</option>
                <option value="2">2+ guests</option>
                <option value="3">3+ guests</option>
                <option value="4">4+ guests</option>
              </select>
            </label>

            <label>
              Price
              <select value={priceRange} onChange={(event) => setPriceRange(event.target.value)}>
                <option value="all">Any price</option>
                <option value="under-250">Under $250</option>
                <option value="250-400">$250 - $400</option>
                <option value="over-400">Over $400</option>
              </select>
            </label>

            <label>
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
                <option value="featured">Featured</option>
                <option value="price-asc">Lowest price</option>
                <option value="price-desc">Highest price</option>
                <option value="capacity-desc">Most guests</option>
              </select>
            </label>
          </div>

          <div className="ml-room-results">
            <p>
              Showing <strong>{filteredRooms.length}</strong> of <strong>{rooms.length}</strong> rooms
            </p>
            {(searchTerm || guestCount !== 'all' || priceRange !== 'all' || sortBy !== 'featured') && (
              <button className="ml-room-reset" type="button" onClick={resetFilters}>
                Reset filters
              </button>
            )}
          </div>

          {filteredRooms.length > 0 ? (
            <RoomList rooms={filteredRooms} />
          ) : (
            <div className="ml-empty-state ml-empty-state--compact">
              <h1>No rooms found</h1>
              <p>Try changing the search term, guest count, or price range.</p>
              <button className="ml-btn ml-btn--primary" type="button" onClick={resetFilters}>
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Rooms
