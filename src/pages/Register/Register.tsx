import { Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

function Register() {
  const { control, handleSubmit, formState: { errors } } = useForm<RegisterForm>({
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    console.log("Register data:", data);
    message.success("Đăng ký thành công!");
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 500 }}>
        <Title level={2}>Đăng ký</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller
            name="fullName"
            control={control}
            rules={{ required: "Vui lòng nhập họ tên" }}
            render={({ field }) => (
              <Input placeholder="Họ tên" {...field} />
            )}
          />
          {errors.fullName && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.fullName.message}</p>}
          <br />
          <br />

          <Controller
            name="email"
            control={control}
            rules={{ 
              required: "Vui lòng nhập email",
              pattern: { 
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
                message: "Email không hợp lệ" 
              } 
            }}
            render={({ field }) => (
              <Input placeholder="Email" {...field} />
            )}
          />
          {errors.email && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.email.message}</p>}
          <br />
          <br />

          <Controller
            name="phone"
            control={control}
            rules={{ required: "Vui lòng nhập số điện thoại" }}
            render={({ field }) => (
              <Input placeholder="Số điện thoại" {...field} />
            )}
          />
          {errors.phone && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.phone.message}</p>}
          <br />
          <br />

          <Controller
            name="password"
            control={control}
            rules={{ 
              required: "Vui lòng nhập mật khẩu",
              minLength: { value: 6, message: "Mật khẩu ít nhất 6 ký tự" }
            }}
            render={({ field }) => (
              <Input.Password placeholder="Mật khẩu" {...field} />
            )}
          />
          {errors.password && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.password.message}</p>}
          <br />
          <br />

          <Button type="primary" htmlType="submit" block>
            Đăng ký
          </Button>
        </form>

        <br />
        <Link to="/login">Đăng nhập</Link>
      </Card>
    </div>
  );
}

export default Register;
