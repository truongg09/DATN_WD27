import { useState } from "react";
import { Alert, Button, Card, Input, Typography, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import api from "../../services/api";

const { Title, Paragraph } = Typography;

interface ForgotForm {
  email: string;
}

function ForgotPassword() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    defaultValues: {
      email: "",
    },
  });

  // Trước đây hàm này chỉ hiện thông báo thành công mà không gọi API nào, khách
  // ngồi chờ mãi không có email. Giờ gọi đúng endpoint /auth/forgot-password.
  const onSubmit = async (values: ForgotForm) => {
    setSubmitting(true);
    try {
      const res = await api.post<unknown, { message?: string }>(
        "/auth/forgot-password",
        { email: values.email },
      );
      setSent(true);
      message.success(
        res?.message ||
          "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi liên kết đặt lại mật khẩu.",
      );
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(
        err.response?.data?.message || "Không gửi được yêu cầu. Vui lòng thử lại.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={() => navigate("/")}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-close" onClick={() => navigate("/")}>
          <CloseOutlined />
        </div>
        <Card>
          <Title level={2}>Quên mật khẩu</Title>
          <Paragraph type="secondary" style={{ marginTop: -8 }}>
            Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
            Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.
          </Paragraph>

          {sent && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message="Đã gửi yêu cầu"
              description="Vui lòng kiểm tra hộp thư (kể cả mục spam). Nếu không thấy, bạn có thể gửi lại sau ít phút."
            />
          )}

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

            <Button type="primary" htmlType="submit" block loading={submitting}>
              {sent ? "Gửi lại liên kết" : "Gửi yêu cầu"}
            </Button>
          </form>

          <br />
          <Link to="/login">Quay lại đăng nhập</Link>
        </Card>
      </div>
    </div>
  );
}

export default ForgotPassword;
