import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Rate, Space, message } from "antd";
import {
  createReview,
  fetchReviewByBooking,
  updateReview,
} from "../../services/reviewService";
import { useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  adminReply?: string | null;
}

function ReviewPage() {
  const nav = useNavigate();
  const [form] = Form.useForm();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);

  const { bookingId } = useParams();
  const { user } = useAuth();

  const currentBookingId = Number(bookingId);
  const customerId = user?.customerId;

  const loadReview = async () => {
    try {
      const res = await fetchReviewByBooking(currentBookingId);
      setReview(res.data);

      if (res.data) {
        form.setFieldsValue({
          rating: res.data.rating,
          comment: res.data.comment,
        });
      }
    } catch {
      message.error("Không tải được đánh giá");
    }
  };

  useEffect(() => {
    loadReview();
  }, []);

  const getStatusText = (status: string) => {
    if (status === "approved") return "Đã duyệt";
    if (status === "rejected") return "Bị từ chối";
    return "Chờ duyệt";
  };

  const onFinish = async (values: { rating: number; comment: string }) => {
    if (!customerId || !currentBookingId) {
      message.error("Thiếu thông tin khách hàng hoặc đặt phòng");
      return;
    }
    try {
      setLoading(true);

      if (review) {
        await updateReview(review.id, {
          customerId,
          rating: values.rating,
          comment: values.comment,
        });

        message.success({
          content: "Cập nhật đánh giá thành công",
          duration: 1.5,
          onClose: () => nav("/booking/history"),
        });
      } else {
        await createReview({
          bookingId: currentBookingId,
          customerId,
          rating: values.rating,
          comment: values.comment,
        });

        message.success({
          content: "Gửi đánh giá thành công và đang chờ duyệt",
          duration: 1.5,
          onClose: () => nav("/booking/history"),
        });
      }

      loadReview();

      loadReview();
    } catch (error: any) {
      message.error(error.message || "Thao tác thất bại");
    } finally {
      setLoading(false);
    }
  };
  // console.log("user:", user);
  // console.log("customerId gửi lên:", customerId);
  // console.log("bookingId:", currentBookingId);

  return (
    <div style={{ padding: "120px 16px 48px" }}>
      <div style={{ padding: "13px", maxWidth: 700, margin: "0 auto" }}>
        {review?.status === "rejected" && (
          <Alert
            type="warning"
            message="Đánh giá của bạn đã bị từ chối"
            description="Bạn có thể chỉnh sửa nội dung và gửi lại để quản trị viên duyệt lại."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Card
          title={review ? "Chỉnh sửa đánh giá" : "Đánh giá đặt phòng"}
          style={{ maxWidth: 700, margin: "40px auto" }}
        >
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <p>
              <b>Mã booking:</b> {bookingId}
            </p>

            {review && (
              <p>
                <b>Trạng thái:</b> {getStatusText(review.status)}
              </p>
            )}

            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item
                label="Số sao"
                name="rating"
                rules={[{ required: true, message: "Vui lòng chọn số sao" }]}
              >
                <Rate />
              </Form.Item>

              <Form.Item
                label="Nội dung đánh giá"
                name="comment"
                rules={[{ required: true, message: "Vui lòng nhập nội dung" }]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="Nhập đánh giá của bạn..."
                />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={loading}>
                {review ? "Cập nhật đánh giá" : "Gửi đánh giá"}
              </Button>
            </Form>

            {review?.adminReply && (
              <Card size="small" title="Phản hồi từ khách sạn">
                {review.adminReply}
              </Card>
            )}
          </Space>
        </Card>
      </div>
    </div>
  );
}

export default ReviewPage;
