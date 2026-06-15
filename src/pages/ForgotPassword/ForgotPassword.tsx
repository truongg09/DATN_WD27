import { Button, Card, Input, Typography } from "antd";

import { useForm } from "react-hook-form";

const { Title } = Typography;

interface ForgotForm {
  email: string;
}
function ForgotPassword() {
  const { register, handleSubmit } = useForm<ForgotForm>();

  const onSubmit = (data: ForgotForm) => {
    console.log(data);
  };

  return (
    <div className="auth-container">
      <Card style={{ width: 400 }}>
        <Title level={2}>Quên mật khẩu</Title>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Input placeholder="Nhập email" {...register("email")} />

          <br />
          <br />

          <Button type="primary" htmlType="submit" block>
            Gửi yêu cầu
          </Button>
        </form>
      </Card>
    </div>
  );
}
export default ForgotPassword;
