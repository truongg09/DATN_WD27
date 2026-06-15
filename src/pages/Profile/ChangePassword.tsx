import { Button, Card, Input, Typography, message } from "antd";
import { useForm } from "react-hook-form";

const { Title } = Typography;

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ChangePassword() {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  const newPassword = watch("newPassword");

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      console.log(data);

      // Gọi API đổi mật khẩu tại đây
      // await changePassword(data);

      message.success("Đổi mật khẩu thành công");
    } catch (error) {
      message.error("Đổi mật khẩu thất bại");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: "40px",
      }}
    >
      <Card
        style={{
          width: 500,
        }}
      >
        <Title level={3}>Đổi mật khẩu</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Mật khẩu hiện tại */}
          <label>Mật khẩu hiện tại</label>

          <Input.Password
            placeholder="Nhập mật khẩu hiện tại"
            {...register("currentPassword", {
              required: "Vui lòng nhập mật khẩu hiện tại",
            })}
          />

          {errors.currentPassword && (
            <p
              style={{
                color: "red",
                marginTop: 4,
              }}
            >
              {errors.currentPassword.message}
            </p>
          )}

          <br />

          {/* Mật khẩu mới */}
          <label>Mật khẩu mới</label>

          <Input.Password
            placeholder="Nhập mật khẩu mới"
            {...register("newPassword", {
              required: "Vui lòng nhập mật khẩu mới",
              minLength: {
                value: 6,
                message: "Mật khẩu tối thiểu 6 ký tự",
              },
            })}
          />

          {errors.newPassword && (
            <p
              style={{
                color: "red",
                marginTop: 4,
              }}
            >
              {errors.newPassword.message}
            </p>
          )}

          <br />

          {/* Xác nhận mật khẩu */}
          <label>Xác nhận mật khẩu mới</label>

          <Input.Password
            placeholder="Nhập lại mật khẩu mới"
            {...register("confirmPassword", {
              required: "Vui lòng xác nhận mật khẩu",
              validate: (value) =>
                value === newPassword || "Mật khẩu xác nhận không khớp",
            })}
          />

          {errors.confirmPassword && (
            <p
              style={{
                color: "red",
                marginTop: 4,
              }}
            >
              {errors.confirmPassword.message}
            </p>
          )}

          <br />

          <Button type="primary" htmlType="submit" block>
            Đổi mật khẩu
          </Button>
        </form>
      </Card>
    </div>
  );
}
export default ChangePassword;