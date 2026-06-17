export type NavItem = {
  label: string
  to: string
  children?: NavItem[]
}

export const mainNavigation: NavItem[] = [
  { label: 'Home', to: '/' },
  {
    label: 'Rooms',
    to: '/rooms',
    children: [
      { label: 'All Rooms', to: '/rooms' },
      { label: 'Signature Suite', to: '/rooms/presidential-suite' },
      { label: 'Beachfront Room', to: '/rooms/beachfront-bliss' },
    ],
  },
  {
    label: 'Pages',
    to: '/about',
    children: [
      { label: 'About', to: '/about' },
      { label: 'Services', to: '/services' },
      { label: 'Restaurant', to: '/restaurant' },
      { label: 'Gallery', to: '/gallery' },
      { label: 'Events', to: '/events' },
      { label: 'Activities', to: '/activities' },
    ],
  },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
]

export const adminNavigation: NavItem[] = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Room Management', to: '/admin/rooms' },
  { label: 'Bookings', to: '/admin/bookings' },
  { label: 'Customers', to: '/admin/customers' },
]
