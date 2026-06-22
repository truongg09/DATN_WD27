const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixAmenityIcons() {
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

    const amenitiesFixes = [
      { id: 1, name: 'Wifi miễn phí', icon: 'faWifi', description: 'Kết nối tốc độ cao khắp mọi nơi' },
      { id: 2, name: 'TV', icon: 'faTv', description: 'TV màn hình phẳng với nhiều kênh' },
      { id: 3, name: 'Điều hòa', icon: 'faSnowflake', description: 'Điều hòa hiện đại' },
      { id: 4, name: 'Mini Bar', icon: 'faGlassWhiskey', description: 'Mini bar với đồ uống miễn phí' },
      { id: 5, name: 'Hồ bơi', icon: 'faSwimmingPool', description: 'Hồ bơi ngoài trời với tầm nhìn đẹp' },
      { id: 6, name: 'Phòng Gym', icon: 'faDumbbell', description: 'Trang thiết bị hiện đại 24/7' },
      { id: 7, name: 'Đậu xe', icon: 'faCar', description: 'Bãi đậu xe rộng rãi, an toàn' },
      { id: 8, name: 'Nhà hàng', icon: 'faUtensils', description: 'Ẩm thực đa dạng và chất lượng' },
      { id: 9, name: 'Bồn tắm', icon: 'faBath', description: 'Bồn tắm thư giãn' },
      { id: 10, name: 'Ban công', icon: 'faImage', description: 'Ban công với view đẹp' },
      { id: 11, name: 'Spa & Massage', icon: 'faSpa', description: 'Thư giãn với các liệu trình chuyên nghiệp' },
      { id: 12, name: 'Giặt sấy siêu tốc', icon: 'faSyncAlt', description: 'Dịch vụ giặt ủi nhanh chóng trong 2 giờ' },
      { id: 13, name: 'Đưa đón sân bay', icon: 'faPlaneArrival', description: 'Xe đưa đón tiện lợi 24/7' }
    ];

    for (const amenity of amenitiesFixes) {
      await connection.query(
        'UPDATE amenities SET name = ?, icon = ?, description = ? WHERE id = ?',
        [amenity.name, amenity.icon, amenity.description, amenity.id]
      );
      console.log(`✅ Fixed amenity ${amenity.id}: ${amenity.name} (${amenity.icon})`);
    }

    console.log('✅ All icons fixed!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

fixAmenityIcons();
