import { Button, Card, Input, Typography, Alert, message, Progress } from "antd";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CloseOutlined, KeyOutlined, LockOutlined, CheckCircleFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { resetPassword } from "../../services/authService";

const { Title, Text, Paragraph } = Typography;

interface ResetForm {
  password: string;
  confirmPassword: string;
}

const getPasswordStrength = (pw: string): { score: number; label: string; color: string } => {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 6) score += 25;
  if (pw.length >= 10) score += 15;
  if (/[A-Z]/.test(pw)) score += 15;
  if (/[0-9]/.test(pw)) score += 15;
  if (/[^A-Za-z0-9]/.test(pw)) score += 15;
  if (score >= 85) return { score: 100, label: "Rất mạnh", color: "#52c41a" };
  if (score >= 60) return { score: 70, label: "Mạnh", color: "#1890ff" };
  if (score >= 35) return { score: 45, label: "Trung bình", color: "#faad14" };
  return { score: 20, label: "Yếu", color: "#ff4d4f" };
};

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<ResetForm>({
    mode: "onChange",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });
  const password = watch("password");
  const confirmPassword = watch("confirmPassword");
  const strength = useMemo(() => getPasswordStrength(password || ""), [password]);

  const [token] = useState<string | null>(tokenFromUrl);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setServerError("Thiếu token đặt lại mật khẩu. Vui lòng kiểm tra lại link từ email hoặc gửi lại yêu cầu mới.");
    }
  }, [token]);

  const onSubmit = async (data: ResetForm) => {
    if (!token) return;
    setServerError(null);
    setLoading(true);
    try {
      const res = await resetPassword(token, data.password);
      setSuccess(true);
      message.success(res.message || "Đặt lại mật khẩu thành công");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể đặt lại mật khẩu. Vui lòng thử lại hoặc gửi lại yêu cầu mới.";
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
            Đặt lại mật khẩu
          </Title>

          {!token && (
            <div>
              <Alert
                type="error"
                showIcon
                title="Link không hợp lệ"
                description={
                  <div style={{ lineHeight: 1.7 }}>
                    Link đặt lại mật khẩu thiếu token hoặc không đúng định dạng.<br />
                    Vui lòng gửi lại yêu cầu đặt lại mật khẩu mới.
                  </div>
                }
              />
              <br />
              <Link to="/forgot-password">
                <Button type="primary" block size="large">
                  Gửi lại yêu cầu đặt lại mật khẩu
                </Button>
              </Link>
            </div>
          )}

          {token && !success && (
            <>
              <Paragraph style={{ color: "#5a5047" }}>
                Vui lòng nhập mật khẩu mới (ít nhất 6 ký tự). Để bảo mật cao, hãy kết hợp chữ hoa, số và ký tự đặc biệt.
              </Paragraph>

              {serverError && (
                <Alert type="error" showIcon title={serverError} style={{ marginBottom: 16 }} />
              )}

              <form onSubmit={handleSubmit(onSubmit)}>
                <div>
                  <Controller
                    name="password"
                    control={control}
                    rules={{
                      required: "Vui lòng nhập mật khẩu mới",
                      minLength: { value: 6, message: "Mật khẩu phải có ít nhất 6 ký tự" },
                    }}
                    render={({ field }) => (
                      <Input.Password
                        prefix={<LockOutlined style={{ color: "#a98561" }} />}
                        placeholder="Mật khẩu mới"
                        size="large"
                        autoComplete="new-password"
                        {...field}
                      />
                    )}
                  />
                  {errors.password && (
                    <p style={{ color: "red", margin: "6px 0 0", fontSize: 13 }}>
                      {errors.password.message}
                    </p>
                  )}
                  {password && (
                    <div style={{ marginTop: 8 }}>
                      <Progress
                        percent={strength.score}
                        showInfo={false}
                        strokeColor={strength.color}
                        size="small"
                        style={{ marginBottom: 4 }}
                      />
                      <Text style={{ fontSize: 12, color: strength.color }}>
                        Độ mạnh mật khẩu: <strong>{strength.label}</strong>
                      </Text>
                    </div>
                  )}
                </div>
                <br />

                <div>
                  <Controller
                    name="confirmPassword"
                    control={control}
                    rules={{
                      required: "Vui lòng xác nhận lại mật khẩu",
                      validate: (v) =>
                        !password || v === password || "Xác nhận mật khẩu không khớp với mật khẩu mới",
                    }}
                    render={({ field }) => (
                      <Input.Password
                        prefix={<KeyOutlined style={{ color: "#a98561" }} />}
                        placeholder="Xác nhận mật khẩu mới"
                        size="large"
                        autoComplete="new-password"
                        {...field}
                      />
                    )}
                  />
                  {errors.confirmPassword && (
                    <p style={{ color: "red", margin: "6px 0 0", fontSize: 13 }}>
                      {errors.confirmPassword.message}
                    </p>
                  )}
                  {confirmPassword && password && confirmPassword === password && (
                    <p style={{ color: "#52c41a", margin: "6px 0 0", fontSize: 13 }}>
                      <CheckCircleFilled /> Xác nhận mật khẩu khớp
                    </p>
                  )}
                </div>
                <br />
                <br />

                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={loading}
                  disabled={!isValid}
                >
                  {loading ? "Đang xác nhận..." : "Xác nhận đặt lại mật khẩu"}
                </Button>
              </form>
            </>
          )}

          {token && success && (
            <div>
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleFilled />}
                title="Đặt lại mật khẩu thành công"
                description={
                  <div style={{ lineHeight: 1.7 }}>
                    Mật khẩu của bạn đã được cập nhật. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.
                  </div>
                }
              />
              <br />
              <Link to="/login">
                <Button type="primary" block size="large">
                  Đến trang đăng nhập
                </Button>
              </Link>
            </div>
          )}

          <br />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Link to="/login" style={{ color: "#a98561" }}>
              ← Đăng nhập
            </Link>
            <Link to="/forgot-password" style={{ color: "#a98561" }}>
              Gửi lại email đặt lại
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default ResetPassword;
