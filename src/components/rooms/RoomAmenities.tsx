type RoomAmenitiesProps = {
  amenities: string[]
}

function RoomAmenities({ amenities }: RoomAmenitiesProps) {
  return (
    <ul className="ml-amenities">
      {amenities.map((amenity) => (
        <li key={amenity}>{amenity}</li>
      ))}
    </ul>
  )
}

export default RoomAmenities
