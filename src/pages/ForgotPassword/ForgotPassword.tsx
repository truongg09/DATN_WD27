import { Button, Card, Input, Typography, Alert, message } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { CloseOutlined, CheckCircleFilled, MailOutlined } from "@ant-design/icons";
import { useState } from "react";
import { forgotPasswordRequest } from "../../services/authService";

type ForgotPasswordResponse = {
  message: string;
  delivered?: boolean;
  token?: string;
};

const { Title, Text, Paragraph } = Typography;

interface ForgotForm {
  email: string;
}

function ForgotPassword() {
  const navigate = useNavigate();
  const { control, handleSubmit, formState: { errors } } = useForm<ForgotForm>({
    defaultValues: {
      email: "",
    },
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  void sentEmail;
  const [devToken, setDevToken] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);

  const onSubmit = async (data: ForgotForm) => {
    setServerError(null);
    setLoading(true);
    try {
      const res: ForgotPasswordResponse = await forgotPasswordRequest(data.email);
      setSentEmail(data.email.trim());
      setSent(true);
      if (res.token) {
        setDevToken(res.token);
      }
      message.success("Đã gửi yêu cầu đặt lại mật khẩu");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể gửi yêu cầu. Vui lòng kiểm tra kết nối mạng và thử lại.";
      setServerError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-overlay" onClick={() => navigate("/")}>
      <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-close" onClick={() => navigate("/")}>
          <CloseOutlined />
        </div>
        <Card>
          <Title level={2} style={{ marginTop: 0 }}>
            Quên mật khẩu
          </Title>

          {!sent && (
            <>
              <Paragraph style={{ color: "#5a5047" }}>
                Nhập email bạn đã dùng để đăng ký. Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu cho bạn.
              </Paragraph>

              {serverError && (
                <Alert
                  type="error"
                  title={serverError}
                  showIcon
                  style={{ marginBottom: 16 }}
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
                      message: "Email không hợp lệ",
                    },
                  }}
                  render={({ field }) => (
                    <Input
                      prefix={<MailOutlined style={{ color: "#a98561" }} />}
                      placeholder="Nhập email đã đăng ký"
                      size="large"
                      autoComplete="email"
                      {...field}
                    />
                  )}
                />
                {errors.email && (
                  <p style={{ color: "red", margin: "6px 0 0", fontSize: 13 }}>
                    {errors.email.message}
                  </p>
                )}
                <br />
                <br />

                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  {loading ? "Đang gửi yêu cầu..." : "Gửi yêu cầu đặt lại mật khẩu"}
                </Button>
              </form>
            </>
          )}

          {sent && (
            <div>
              <Alert
                showIcon
                icon={<CheckCircleFilled style={{ color: "#7a5533" }} />}
                title="Đã gửi yêu cầu đặt lại mật khẩu"
                description={
                  <div style={{ lineHeight: 1.7 }}>
                    <Text style={{ fontSize: 14, color: "#4a4139" }}>
                      Vui lòng kiểm tra cả <strong>hộp thư rác / Spam</strong> nếu không nhận được email.
                      Link đặt lại mật khẩu sẽ hết hạn sau 15 phút.
                    </Text>
                    {devToken && (
                      <div
                        style={{
                          marginTop: 12,
                          padding: "12px 14px",
                          background: "#fbf5ec",
                          border: "1px dashed #c2986b",
                          borderRadius: 12,
                          color: "#7a5533",
                          fontSize: 13,
                          wordBreak: "break-all",
                        }}
                      >
                        <strong style={{ color: "#6a4826" }}>DEV:</strong> SMTP chưa cấu hình nên link reset đã được trả về trực tiếp.<br />
                        <Link
                          to={`/reset-password?token=${devToken}`}
                          style={{ color: "#8f6236", textDecoration: "underline", fontWeight: 600 }}
                        >
                          👉 Nhấp vào đây để mở trang đặt lại mật khẩu
                        </Link>
                      </div>
                    )}
                  </div>
                }
                style={{
                  border: "1px solid #d8bd9e",
                  background: "linear-gradient(180deg, #fbf5ec 0%, #f7efe2 100%)",
                  borderRadius: 16,
                  padding: "14px 18px",
                  color: "#3d3229",
                }}
                className="auth-success-alert"
              />

              <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <Button
                  block
                  size="large"
                  style={{
                    height: 52,
                    borderRadius: 14,
                    border: "2px solid #a98561",
                    background: "#ffffff",
                    color: "#a98561",
                    fontWeight: 600,
                    fontSize: 15,
                    flex: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#fbf5ec";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
                  }}
                  onClick={() => navigate("/login")}
                >
                  Quay lại đăng nhập
                </Button>
                <Button
                  block
                  size="large"
                  style={{
                    height: 52,
                    borderRadius: 14,
                    border: "2px solid transparent",
                    background: "#a98561",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: 15,
                    flex: 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#8f6f4f";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#a98561";
                  }}
                  onClick={() => {
                    setSent(false);
                    setDevToken(undefined);
                    setServerError(null);
                  }}
                >
                  Gửi lại với email khác
                </Button>
              </div>
            </div>
          )}

          {!sent && (
            <>
              <br />
              <Link to="/login" style={{ color: "#a98561" }}>
                ← Quay lại đăng nhập
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default ForgotPassword;
