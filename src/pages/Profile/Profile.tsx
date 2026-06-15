import { Avatar, Card, Descriptions, Typography } from "antd";

const { Title } = Typography;

function Profile() {
  const user = {
    fullName: "Nguyễn Văn A",
    email: "user@gmail.com",
    phone: "0123456789",
    role: "customer",
  };

  return (
    <Card>
      <Title level={2}>Hồ sơ cá nhân</Title>

      <Avatar size={100}>A</Avatar>

      <br />
      <br />

      <Descriptions bordered>
        <Descriptions.Item label="Họ tên">{user.fullName}</Descriptions.Item>

        <Descriptions.Item label="Email">{user.email}</Descriptions.Item>

        <Descriptions.Item label="Số điện thoại">
          {user.phone}
        </Descriptions.Item>

        <Descriptions.Item label="Vai trò">{user.role}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
export default Profile;
