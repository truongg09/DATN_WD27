import { Button, Card, Input, Typography } from "antd";
import { useForm } from "react-hook-form";

const { Title } = Typography;

interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}
function Register() {
  const { register, handleSubmit } = useForm<RegisterForm>();

  const onSubmit = (data: RegisterForm) => {
    console.log(data);
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 500 }}>
        <Title level={2}>Đăng ký</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input placeholder="Họ tên" {...register("fullName")} />

          <br />
          <br />

          <Input placeholder="Email" {...register("email")} />

          <br />
          <br />

          <Input placeholder="Số điện thoại" {...register("phone")} />

          <br />
          <br />

          <Input.Password placeholder="Mật khẩu" {...register("password")} />

          <br />
          <br />

          <Button type="primary" htmlType="submit" block>
            Đăng ký
          </Button>
        </form>
      </Card>
    </div>
  );
}
export default Register;
