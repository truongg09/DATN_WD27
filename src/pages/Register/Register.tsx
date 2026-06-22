import { Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { register as registerService } from "../../services/authService";

const { Title } = Typography;

interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { control, handleSubmit, formState: { errors, isSubmitting } }= useForm<RegisterForm>({
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
    },
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const response = await registerService({
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        password: data.password,
      });
      login({ user: response.user, token: response.token });
      message.success("Đăng ký thành công!");
      if (response.user.role === "admin") {
        navigate("/admin");
      } else if (response.user.role === "employee") {
        navigate("/employee");
      } else {
        navigate("/");
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || "Đăng ký thất bại!");
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={() => navigate("/")}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-close" onClick={() => navigate("/")}>
          <CloseOutlined />
        </div>
        <Card>
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

            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              Đăng ký
            </Button>
          </form>

          <br />
          <Link to="/login">Đăng nhập</Link>
        </Card>
      </div>
    </div>
  );
}

export default Register;
