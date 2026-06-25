export interface Room {
  id: number;
  name: string;
  type: string;
  image: string;
  images: string[];
  beds: string;
  baths: string;
  area: string;
  maxGuests: number;
  price: number;
  originalPrice?: number;
  available: boolean;
  description: string;
  amenities: string[];
  reviews: number;
  rating: number;
}

export const roomsData: Room[] = [
  {
    id: 1,
    name: 'Phòng Standard',
    type: 'standard',
    image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600',
    images: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200',
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=1200',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200'
    ],
    beds: '1 giường đơn',
    baths: '1 phòng tắm',
    area: '28m²',
    maxGuests: 1,
    price: 750000,
    available: true,
    description: 'Phòng Standard là sự lựa chọn hoàn hảo và tiết kiệm cho những chuyến đi ngắn ngày hoặc du khách đơn lẻ. Phòng được trang bị đầy đủ tiện nghi cơ bản như điều hòa, tivi màn hình phẳng, bàn làm việc nhỏ và phòng tắm sạch sẽ.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Bàn làm việc', 'Ấm đun nước', 'Máy sấy tóc'],
    reviews: 45,
    rating: 4.5
  },
  {
    id: 2,
    name: 'Phòng Superior',
    type: 'superior',
    image: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=600',
    images: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200'
    ],
    beds: '1 giường đôi',
    baths: '1 phòng tắm',
    area: '35m²',
    maxGuests: 2,
    price: 950000,
    available: true,
    description: 'Phòng Superior mang lại không gian ấm cúng, thoải mái cho cặp đôi. Với thiết kế hiện đại, cửa sổ lớn đón ánh sáng tự nhiên và tầm nhìn thoáng đãng, mang đến cảm giác thư thái dễ chịu cho cả kỳ nghỉ.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar', 'Két sắt', 'Ấm đun nước', 'Máy sấy tóc', 'Gối êm'],
    reviews: 82,
    rating: 4.6
  },
  {
    id: 3,
    name: 'Phòng Deluxe',
    type: 'deluxe',
    image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=600',
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200'
    ],
    beds: '2 giường đơn',
    baths: '1 phòng tắm',
    area: '40m²',
    maxGuests: 2,
    price: 1200000,
    available: true,
    description: 'Phòng Deluxe của chúng tôi mang đến không gian rộng rãi và cao cấp hơn với tầm nhìn tuyệt đẹp hướng ra trung tâm thành phố. Phòng được bày trí tinh tế với nội thất gỗ cao cấp, phù hợp cho du khách đi công tác hoặc nghỉ dưỡng.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar', 'Két sắt', 'Bàn làm việc', 'Ấm đun nước', 'Áo choàng tắm', 'Máy sấy tóc', 'Gối êm'],
    reviews: 128,
    rating: 4.8
  },
  {
    id: 4,
    name: 'Phòng Family',
    type: 'family',
    image: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600',
    images: [
      'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=1200',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200'
    ],
    beds: '2 giường đôi',
    baths: '2 phòng tắm',
    area: '55m²',
    maxGuests: 4,
    price: 2100000,
    available: true,
    description: 'Phòng Family được thiết kế đặc biệt dành riêng cho gia đình hoặc nhóm bạn thân 4 người. Với 2 giường đôi lớn cực kỳ êm ái, 2 nhà tắm riêng biệt tiện lợi, không gian phòng rộng mở kết hợp các gam màu ấm cúng, đem lại sự thân thuộc như ở nhà.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar', 'Két sắt', 'Sofa tiếp khách', 'Máy pha cà phê', 'Áo choàng tắm', 'Máy sấy tóc'],
    reviews: 64,
    rating: 4.7
  },
  {
    id: 5,
    name: 'Phòng Suite',
    type: 'suite',
    image: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600',
    images: [
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200',
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200',
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=1200'
    ],
    beds: '1 giường king',
    baths: '2 phòng tắm',
    area: '60m²',
    maxGuests: 2,
    price: 2500000,
    available: true,
    description: 'Hạng phòng Suite sở hữu ban công riêng ngắm toàn cảnh, phòng khách độc lập sang trọng cùng đầy đủ các thiết bị công nghệ hiện đại. Đây là lựa chọn cao cấp để nâng tầm chuyến nghỉ dưỡng của bạn thành trải nghiệm đẳng cấp thượng lưu.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'TV màn hình phẳng', 'Mini bar VIP', 'Két sắt an toàn', 'Phòng khách riêng', 'Ban công panorama', 'Bồn tắm nằm', 'Loa Bluetooth'],
    reviews: 95,
    rating: 4.9
  },
  {
    id: 6,
    name: 'Bungalow Hướng Biển',
    type: 'bungalow',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600',
    images: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200',
      'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=1200',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200'
    ],
    beds: '1 giường đôi lớn',
    baths: '1 phòng tắm ngoài trời',
    area: '70m²',
    maxGuests: 2,
    price: 3200000,
    available: true,
    description: 'Trải nghiệm kỳ nghỉ độc đáo tại Bungalow gỗ thiết kế theo phong cách mộc mạc hòa quyện thiên nhiên. Nằm sát bờ biển cát trắng, quý khách có thể lắng nghe tiếng sóng vỗ rì rào từ hiên nhà và ngâm mình dưới bồn tắm lộ thiên lãng mạn.',
    amenities: ['Wifi miễn phí', 'Điều hòa không khí', 'Smart TV', 'Mini bar', 'Két sắt', 'Hiên tắm nắng', 'Lối đi riêng ra biển', 'Bồn tắm lộ thiên'],
    reviews: 38,
    rating: 4.8
  },
  {
    id: 7,
    name: 'Presidential Suite',
    type: 'presidential',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600',
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200',
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200'
    ],
    beds: '2 giường king',
    baths: '3 phòng tắm',
    area: '100m²',
    maxGuests: 4,
    price: 5000000,
    originalPrice: 5500000,
    available: true,
    description: 'Presidential Suite tái định nghĩa về sự xa hoa và quyền lực. Không gian rộng lớn với phòng ngủ hoàng gia, phòng ăn riêng, quầy bar và phòng tắm jacuzzi dát vàng. Nơi đây từng đón tiếp nhiều nguyên thủ quốc gia và người nổi tiếng.',
    amenities: ['Wifi tốc độ cao', 'Điều hòa trung tâm', 'Hệ thống âm thanh hi-end', 'Quầy bar riêng', 'Bàn ăn 6 người', 'Bồn tắm Jacuzzi dát vàng', 'Dịch vụ quản gia 24/7'],
    reviews: 210,
    rating: 5.0
  },
  {
    id: 8,
    name: 'Presidential Penthouse VIP',
    type: 'presidential',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200'
    ],
    beds: '3 giường king',
    baths: '4 phòng tắm',
    area: '250m²',
    maxGuests: 6,
    price: 10000000,
    available: true,
    description: 'Nằm tại tầng cao nhất của khách sạn với tầm nhìn 360 độ ngắm toàn thành phố và bờ biển rộng lớn. Căn Penthouse VVIP sở hữu hồ bơi vô cực riêng trên sân thượng, rạp chiếu phim mini, khu bếp đầy đủ tiện nghi và quản gia riêng phục vụ suốt kỳ nghỉ.',
    amenities: ['Wifi tốc độ cao', 'Hồ bơi vô cực riêng', 'Hiên phơi nắng riêng', 'Rạp phim mini tại gia', 'Khu bếp hoàng gia', 'Dịch vụ quản gia 24/7', 'Bồn tắm Jacuzzi ngoài trời'],
    reviews: 15,
    rating: 5.0
  }
];
