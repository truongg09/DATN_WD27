const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertSampleAmenities() {
  let connection;
  try {
    console.log('=== Connecting to database...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Connected to database');

    const amenities = [
      {
        name: 'Hồ bơi',
        icon: 'faSwimmingPool',
        description: 'Hồ bơi ngoài trời với tầm nhìn đẹp'
      },
      {
        name: 'Spa & Massage',
        icon: 'faSpa',
        description: 'Thư giãn với các liệu trình chuyên nghiệp'
      },
      {
        name: 'Nhà hàng',
        icon: 'faUtensils',
        description: 'Ẩm thực đa dạng và chất lượng'
      },
      {
        name: 'Phòng Gym',
        icon: 'faDumbbell',
        description: 'Trang thiết bị hiện đại 24/7'
      },
      {
        name: 'Wifi miễn phí',
        icon: 'faWifi',
        description: 'Kết nối tốc độ cao khắp mọi nơi'
      },
      {
        name: 'Đậu xe',
        icon: 'faCar',
        description: 'Bãi đậu xe rộng rãi, an toàn'
      },
      {
        name: 'Giặt sấy siêu tốc',
        icon: 'faSyncAlt',
        description: 'Dịch vụ giặt ủi nhanh chóng trong 2 giờ'
      },
      {
        name: 'Đưa đón sân bay',
        icon: 'faPlaneArrival',
        description: 'Xe đưa đón tiện lợi 24/7'
      }
    ];

    for (const amenity of amenities) {
      const [existing] = await connection.query(
        'SELECT id FROM amenities WHERE name = ?',
        [amenity.name]
      );
      
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO amenities (name, icon, description) VALUES (?, ?, ?)',
          [amenity.name, amenity.icon, amenity.description]
        );
        console.log(`✅ Inserted amenity: ${amenity.name}`);
      } else {
        console.log(`⚠️ Amenity ${amenity.name} already exists, skipping...`);
      }
    }

    console.log('✅ All sample amenities processed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

insertSampleAmenities();
