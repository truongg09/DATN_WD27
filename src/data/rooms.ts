import { images } from './assets'

export type Room = {
  slug: string
  name: string
  tagline: string
  description: string
  longDescription: string
  price: number
  size: string
  guests: number
  beds: string
  image: string
  gallery: string[]
  amenities: string[]
}

export const rooms: Room[] = [
  {
    slug: 'mountain-view-room',
    name: 'Mountain View Room',
    tagline: 'Quiet comfort with a wide landscape view.',
    description: 'A calm room for guests who want warm materials, soft light, and a balcony view.',
    longDescription:
      'The Mountain View Room keeps the Moonlit balance of classic resort comfort and practical travel needs. It includes a queen bed, workspace, lounge chair, walk-in shower, and a private balcony for morning coffee.',
    price: 180,
    size: '36 m2',
    guests: 2,
    beds: '1 Queen Bed',
    image: images.room1,
    gallery: [images.room1, images.room2, images.gallery1],
    amenities: ['Private balcony', 'Mountain view', 'Free Wi-Fi', 'Breakfast included', 'Smart TV'],
  },
  {
    slug: 'presidential-suite',
    name: 'Presidential Suite',
    tagline: 'The signature suite for premium stays.',
    description: 'A spacious suite with separate living room, refined finishes, and premium services.',
    longDescription:
      'The Presidential Suite is designed for special trips and executive stays. Guests get a generous bedroom, separate living area, deep soaking bath, curated minibar, and dedicated concierge support throughout the stay.',
    price: 520,
    size: '82 m2',
    guests: 4,
    beds: '1 King Bed',
    image: images.room2,
    gallery: [images.room2, images.room3, images.heroAlt],
    amenities: ['Private balcony', 'Ocean view', 'Concierge service', 'Premium minibar', 'Airport transfer'],
  },
  {
    slug: 'beachfront-bliss',
    name: 'Beachfront Bliss',
    tagline: 'Step from your room toward the sea.',
    description: 'A bright coastal room with direct beach atmosphere and generous daylight.',
    longDescription:
      'Beachfront Bliss is built around easy resort living. The room has warm neutral tones, large windows, outdoor seating, and direct access to the most relaxed part of the property.',
    price: 260,
    size: '44 m2',
    guests: 3,
    beds: '1 King Bed',
    image: images.room3,
    gallery: [images.room3, images.gallery2, images.gallery3],
    amenities: ['Private balcony', 'Beach access', 'Rain shower', 'Free Wi-Fi', 'Daily housekeeping'],
  },
  {
    slug: 'premier-deluxe-room',
    name: 'Premier Deluxe Room',
    tagline: 'A flexible favorite for short and long stays.',
    description: 'A polished deluxe room with practical storage, soft bedding, and city-resort styling.',
    longDescription:
      'Premier Deluxe Room gives travelers a comfortable, dependable base. It includes a large bed, writing desk, lounge corner, and a bathroom planned for daily convenience.',
    price: 210,
    size: '40 m2',
    guests: 2,
    beds: '1 King Bed',
    image: images.room4,
    gallery: [images.room4, images.room5, images.room1],
    amenities: ['City view', 'Workspace', 'Free Wi-Fi', 'Coffee machine', 'Room service'],
  },
  {
    slug: 'metropolitan-suite',
    name: 'Metropolitan Suite',
    tagline: 'Urban resort styling with extra room to settle in.',
    description: 'A suite made for guests who need more space without losing the boutique feel.',
    longDescription:
      'The Metropolitan Suite combines a comfortable bedroom, a semi-private lounge, extra wardrobe space, and a calm palette for guests staying several nights.',
    price: 340,
    size: '60 m2',
    guests: 3,
    beds: '1 King Bed',
    image: images.room5,
    gallery: [images.room5, images.room6, images.about],
    amenities: ['Separate lounge', 'Bath tub', 'Free Wi-Fi', 'Breakfast included', 'Late checkout'],
  },
  {
    slug: 'four-seasons-hotels',
    name: 'Four Seasons Hotels',
    tagline: 'Classic resort comfort for family travel.',
    description: 'A larger room setup with flexible bedding and an easy connection to hotel facilities.',
    longDescription:
      'This family-ready room focuses on flexibility. Guests can use twin or king bedding, request a crib, and stay close to the pool, restaurant, and activity desk.',
    price: 300,
    size: '56 m2',
    guests: 4,
    beds: '2 Twin Beds',
    image: images.room6,
    gallery: [images.room6, images.gallery1, images.gallery2],
    amenities: ['Family layout', 'Pool access', 'Free Wi-Fi', 'Laundry service', 'Breakfast included'],
  },
]

export function findRoom(slug: string | undefined) {
  return rooms.find((room) => room.slug === slug)
}
