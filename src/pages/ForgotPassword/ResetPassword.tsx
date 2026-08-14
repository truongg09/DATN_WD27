import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography, message } from "antd";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CloseOutlined } from "@ant-design/icons";
import api from "../../services/api";

const { Title, Paragraph } = Typography;

// Trang khách mở từ liên kết trong email đặt lại mật khẩu. Token nằm ở query
// string và chỉ dùng được một lần, backend kiểm tra hạn dùng ở /auth/reset-password.
function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form] = Form.useForm();

  const handleFinish = async (values: { newPassword: string }) => {
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        token,
        newPassword: values.newPassword,
      });
      setDone(true);
      message.success("Đặt lại mật khẩu thành công!");
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(
        err.response?.data?.message ||
          "Không đặt lại được mật khẩu. Vui lòng yêu cầu liên kết mới.",
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
          <Title level={2}>Đặt lại mật khẩu</Title>

          {!token ? (
            <Alert
              type="error"
              showIcon
              message="Liên kết không hợp lệ"
              description={
                <>
                  Liên kết thiếu mã đặt lại. Vui lòng mở lại đường dẫn trong email,
                  hoặc <Link to="/forgot-password">yêu cầu liên kết mới</Link>.
                </>
              }
            />
          ) : done ? (
            <Alert
              type="success"
              showIcon
              message="Đã đổi mật khẩu"
              description={
                <>
                  Mật khẩu mới đã được lưu.{" "}
                  <Link to="/login">Đăng nhập ngay</Link>.
                </>
              }
            />
          ) : (
            <>
              <Paragraph type="secondary" style={{ marginTop: -8 }}>
                Nhập mật khẩu mới cho tài khoản của bạn.
              </Paragraph>
              <Form form={form} layout="vertical" onFinish={handleFinish}>
                <Form.Item
                  name="newPassword"
                  label="Mật khẩu mới"
                  rules={[
                    { required: true, message: "Vui lòng nhập mật khẩu mới" },
                    { min: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
                  ]}
                >
                  <Input.Password size="large" placeholder="Nhập mật khẩu mới" />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label="Xác nhận mật khẩu"
                  dependencies={["newPassword"]}
                  rules={[
                    { required: true, message: "Vui lòng nhập lại mật khẩu mới" },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("newPassword") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(
                          new Error("Hai lần nhập mật khẩu chưa khớp"),
                        );
                      },
                    }),
                  ]}
                >
                  <Input.Password size="large" placeholder="Nhập lại mật khẩu mới" />
                </Form.Item>

                <Button type="primary" htmlType="submit" block loading={submitting}>
                  Xác nhận
                </Button>
              </Form>
            </>
          )}

          <br />
          <Link to="/login">Quay lại đăng nhập</Link>
        </Card>
      </div>
    </div>
  );
}

export default ResetPassword;
