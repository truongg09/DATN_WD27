import { Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { login as loginService } from "../../services/authService";

const { Title } = Typography;

interface LoginForm {
  email: string;
  password: string;
}

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    control,
    handleSubmit,
    formState: { 
      errors, 
      isSubmitting 
    }
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      console.log('Attempting login with:', data);
      const response = await loginService(data);
      console.log('Login response:', response);
      console.log('User role:', response.user.role);
      login({ user: response.user, token: response.token });
      message.success("Đăng nhập thành công!");
      if (response.user.role === "admin") {
        console.log('Navigating to admin...');
        navigate("/admin");
      } else {
        console.log('Navigating to home...');
        navigate("/");
      }
    } catch (error: any) {
      console.error('Login error:', error);
      message.error(error.response?.data?.message || "Đăng nhập thất bại!");
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={() => navigate("/")}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-close" onClick={() => navigate("/")}>
          <CloseOutlined />
        </div>
        <Card>
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

            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              Đăng nhập
            </Button>
          </form>

          <br />

          <Link to="/forgot-password">Quên mật khẩu?</Link>

          <br />

          <Link to="/register">Chưa có tài khoản?</Link>
        </Card>
      </div>
    </div>
  );
}

export default Login;
