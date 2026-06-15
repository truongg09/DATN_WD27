import { Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface ForgotForm {
  email: string;
}

function ForgotPassword() {
  const { control, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotForm) => {
    console.log("Forgot password data:", data);
    message.success("Yêu cầu đặt lại mật khẩu (demo) đã được gửi!");
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 400 }}>
        <Title level={2}>Quên mật khẩu</Title>

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
              <Input placeholder="Nhập email" {...field} />
            )}
          />
          {errors.email && <p style={{ color: "red", margin: "4px 0 0" }}>{errors.email.message}</p>}
          <br />
          <br />

          <Button type="primary" htmlType="submit" block>
            Gửi yêu cầu
          </Button>
        </form>

        <br />
        <Link to="/login">Quay lại đăng nhập</Link>
      </Card>
    </div>
  );
}

export default ForgotPassword;
