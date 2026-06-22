const mysql = require('mysql2/promise');
require('dotenv').config();

async function addAmenityDescriptionColumn() {
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

    // Add description column if it doesn't exist
    await connection.query(`
      ALTER TABLE amenities 
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    console.log('✅ Added description column to amenities table');

    // Now update existing amenities with descriptions and our sample data
    const amenitiesUpdates = [
      { id: 1, name: 'Wifi miễn phí', icon: 'faWifi', description: 'Kết nối tốc độ cao khắp mọi nơi' },
      { id: 2, name: 'TV', icon: 'faWifi', description: 'TV màn hình phẳng với nhiều kênh' },
      { id: 3, name: 'Điều hòa', icon: 'faDumbbell', description: 'Điều hòa hiện đại' },
      { id: 4, name: 'Mini Bar', icon: 'faUtensils', description: 'Mini bar với đồ uống miễn phí' },
      { id: 5, name: 'Hồ bơi', icon: 'faSwimmingPool', description: 'Hồ bơi ngoài trời với tầm nhìn đẹp' },
      { id: 6, name: 'Phòng Gym', icon: 'faDumbbell', description: 'Trang thiết bị hiện đại 24/7' },
      { id: 7, name: 'Đậu xe', icon: 'faCar', description: 'Bãi đậu xe rộng rãi, an toàn' },
      { id: 8, name: 'Nhà hàng', icon: 'faUtensils', description: 'Ẩm thực đa dạng và chất lượng' },
      { id: 9, name: 'Bồn tắm', icon: 'faSpa', description: 'Bồn tắm thư giãn' },
      { id: 10, name: 'Ban công', icon: 'faPlaneArrival', description: 'Ban công với view đẹp' }
    ];

    for (const amenity of amenitiesUpdates) {
      await connection.query(
        'UPDATE amenities SET name = ?, icon = ?, description = ? WHERE id = ?',
        [amenity.name, amenity.icon, amenity.description, amenity.id]
      );
      console.log(`✅ Updated amenity ${amenity.id}: ${amenity.name}`);
    }

    // Insert our additional amenities
    const additionalAmenities = [
      { name: 'Spa & Massage', icon: 'faSpa', description: 'Thư giãn với các liệu trình chuyên nghiệp' },
      { name: 'Giặt sấy siêu tốc', icon: 'faSyncAlt', description: 'Dịch vụ giặt ủi nhanh chóng trong 2 giờ' },
      { name: 'Đưa đón sân bay', icon: 'faPlaneArrival', description: 'Xe đưa đón tiện lợi 24/7' }
    ];

    for (const amenity of additionalAmenities) {
      await connection.query(
        'INSERT INTO amenities (name, icon, description) VALUES (?, ?, ?)',
        [amenity.name, amenity.icon, amenity.description]
      );
      console.log(`✅ Inserted additional amenity: ${amenity.name}`);
    }

    console.log('✅ All updates complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addAmenityDescriptionColumn();
