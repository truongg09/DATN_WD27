import { Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

function Login() {
  const { control, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginForm) => {
    console.log("Login data:", data);
    message.success("Đăng nhập (demo) thành công!");
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 400 }}>
        <Title level={2}>Đăng nhập</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
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
            name="password"
            control={control}
            rules={{ required: "Vui lòng nhập mật khẩu" }}
            render={({ field }) => (
              <Input.Password placeholder="Mật khẩu" {...field} />
            )}
          />
          {errors.password && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.password.message}</p>}
          <br />
          <br />

          <Button type="primary" htmlType="submit" block>
            Đăng nhập
          </Button>
        </form>

        <br />

        <Link to="/forgot-password">Quên mật khẩu?</Link>

        <br />

        <Link to="/register">Chưa có tài khoản?</Link>
      </Card>
    </div>
  );
}

export default Login;
