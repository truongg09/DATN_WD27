import { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Input, Rate, Space, message } from "antd";
import {
  createReview,
  fetchReviewByBooking,
  updateReview,
} from "../../services/reviewService";

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
  const [form] = Form.useForm();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);

  // Tạm thời hard-code để test
  const bookingId = 4;
  const customerId = 4;

  const loadReview = async () => {
    try {
      const res = await fetchReviewByBooking(bookingId);
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
    try {
      setLoading(true);

      if (review) {
        await updateReview(review.id, {
          customerId,
          rating: values.rating,
          comment: values.comment,
        });
        message.success("Cập nhật đánh giá thành công");
      } else {
        await createReview({
          bookingId,
          customerId,
          rating: values.rating,
          comment: values.comment,
        });
        message.success("Gửi đánh giá thành công");
      }

      loadReview();
    } catch (error: any) {
      message.error(error.message || "Thao tác thất bại");
    } finally {
      setLoading(false);
    }
  };

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
