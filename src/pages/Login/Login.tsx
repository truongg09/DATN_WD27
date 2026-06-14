import { Button, Card, Input, Typography } from "antd";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

function Login(){
    const { register, handleSubmit } =
    useForm<LoginForm>();

  const onSubmit = (data: LoginForm) => {
    console.log(data);
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 400 }}>
        <Title level={2}>Đăng nhập</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input
            placeholder="Email"
            {...register("email")}
          />

          <br />
          <br />

          <Input.Password
            placeholder="Mật khẩu"
            {...register("password")}
          />

          <br />
          <br />

          <Button
            type="primary"
            htmlType="submit"
            block
          >
            Đăng nhập
          </Button>
        </form>

        <br />

        <Link to="/auth/forgot-password">
          Quên mật khẩu?
        </Link>

        <br />

        <Link to="/auth/register">
          Chưa có tài khoản?
        </Link>
      </Card>
    </div>
  );
};
export default Login;