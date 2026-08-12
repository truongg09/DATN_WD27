import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { DatePicker, Button, Popover, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faExpandArrowsAlt,
  faStar,
  faCheck,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { getRoomTypeDetail } from "../../services/roomService";
import type { RoomTypeSearchResult } from "../../services/roomService";
import {
  getRoomTypeGallery,
  handleRoomImageError,
} from "../../utils/roomTypeImages";
import "./RoomTypeDetail.css";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_FORMAT = "YYYY-MM-DD";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN").format(price) + "đ";

const unwrapDetail = (response: unknown): RoomTypeSearchResult | null => {
  let current = response as Record<string, unknown> | null;
  while (current && typeof current === "object" && "data" in current) {
    current = current.data as Record<string, unknown>;
  }
  return (current as unknown as RoomTypeSearchResult) || null;
};

const RoomTypeDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const roomTypeId = Number(id);
  const paramCheckIn = searchParams.get("checkIn") || "";
  const paramCheckOut = searchParams.get("checkOut") || "";
  const adults = Math.max(
    1,
    parseInt(searchParams.get("adults") || "2", 10) || 2,
  );
  const children = Math.max(
    0,
    parseInt(searchParams.get("children") || "0", 10) || 0,
  );
  const childAges = searchParams.get("childAges") || "";

  const initialDatesValid =
    dayjs(paramCheckIn, DATE_FORMAT, true).isValid() &&
    dayjs(paramCheckOut, DATE_FORMAT, true).isValid() &&
    dayjs(paramCheckOut).isAfter(dayjs(paramCheckIn));

  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null]
  >([
    initialDatesValid ? dayjs(paramCheckIn) : null,
    initialDatesValid ? dayjs(paramCheckOut) : null,
  ]);
  const [guests, setGuests] = useState({ adults, children });
  const [guestOpen, setGuestOpen] = useState(false);

  const [roomType, setRoomType] = useState<RoomTypeSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  const hasDates = Boolean(dateRange[0] && dateRange[1]);
  const checkInVal = dateRange[0]?.valueOf();
  const checkOutVal = dateRange[1]?.valueOf();

  const fetchDetail = useCallback(async () => {
    if (!Number.isInteger(roomTypeId) || roomTypeId <= 0) {
      setError("Hạng phòng không hợp lệ");
      setLoading(false);
      return;
    }
    try {
      setQuoteLoading(true);
      const params =
        dateRange[0] && dateRange[1]
          ? {
              checkIn: dateRange[0].format(DATE_FORMAT),
              checkOut: dateRange[1].format(DATE_FORMAT),
            }
          : undefined;
      const response = await getRoomTypeDetail(roomTypeId, params);
      const detail = unwrapDetail(response);
      if (!detail) throw new Error("Không tìm thấy hạng phòng");
      setRoomType(detail);
      setError(null);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      setError(
        status === 404
          ? "Không tìm thấy hạng phòng này"
          : "Có lỗi khi tải thông tin hạng phòng",
      );
    } finally {
      setLoading(false);
      setQuoteLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomTypeId, checkInVal, checkOutVal]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [roomTypeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const gallery = useMemo(
    () =>
      roomType ? getRoomTypeGallery(roomType.typeName, roomType.images) : [],
    [roomType],
  );

  const bookingQuery = useMemo(() => {
    const params = new URLSearchParams({
      type: String(roomTypeId),
      adults: String(guests.adults),
      children: String(guests.children),
    });
    if (dateRange[0] && dateRange[1]) {
      params.set("checkIn", dateRange[0].format(DATE_FORMAT));
      params.set("checkOut", dateRange[1].format(DATE_FORMAT));
    }
    if (childAges) params.set("childAges", childAges);
    return params.toString();
  }, [roomTypeId, guests, dateRange, childAges]);

  const backQuery = useMemo(() => {
    const params = new URLSearchParams({
      adults: String(guests.adults),
      children: String(guests.children),
    });
    if (dateRange[0] && dateRange[1]) {
      params.set("checkIn", dateRange[0].format(DATE_FORMAT));
      params.set("checkOut", dateRange[1].format(DATE_FORMAT));
    }
    return params.toString();
  }, [guests, dateRange]);

  if (loading) {
    return (
      <div className="type-detail-page">
        <div className="type-detail-loading">
          <div className="spinner"></div>
          <p>Đang tải thông tin hạng phòng...</p>
        </div>
      </div>
    );
  }

  if (error || !roomType) {
    return (
      <div className="type-detail-page">
        <div className="type-detail-error">
          <p>{error || "Không tìm thấy hạng phòng"}</p>
          <Link to="/rooms">
            <button className="btn-book">Quay lại danh sách phòng</button>
          </Link>
        </div>
      </div>
    );
  }

  const nights = hasDates ? dateRange[1]!.diff(dateRange[0]!, "day") : 0;
  const totalStay =
    nights > 0 ? Number(roomType.defaultPrice || 0) * nights : 0;
  const soldOut = hasDates && (roomType.availableRooms ?? 0) === 0;
  const lowStock = hasDates && !soldOut && (roomType.availableRooms ?? 0) <= 3;
  const maxOcc = roomType.maxOccupancy ?? roomType.capacity;
  const adultCapacity = roomType.adultCapacity ?? 0;
  const childCapacity = roomType.childCapacity ?? 0;

  const extraAdultFee = Number(roomType.extraAdultFee ?? 0);
  const extraChildFee = Number(roomType.extraChildFee ?? 0);
  const totalGuests = guests.adults + guests.children;
  const fitsOneRoom = totalGuests <= maxOcc;
  const minimumRooms = totalGuests > 0 ? Math.ceil(totalGuests / maxOcc) : 1;
  const overCapacity =
    roomType.fitsGuests === false ||
    (roomType.availableRooms
      ? roomType.availableRooms * maxOcc < totalGuests
      : false);
  const needMoreRooms = !overCapacity && !fitsOneRoom;
  const reviews = roomType.reviews || [];

  const guestContent = (
    <div style={{ padding: 8, minWidth: 240 }}>
      <div className="guest-stepper-row">
        <Text strong>Người lớn</Text>
        <div className="guest-stepper">
          <Button
            shape="circle"
            size="small"
            disabled={guests.adults <= 1}
            onClick={() => setGuests({ ...guests, adults: guests.adults - 1 })}
          >
            -
          </Button>
          <Text strong style={{ minWidth: 24, textAlign: "center" }}>
            {guests.adults}
          </Text>
          <Button
            shape="circle"
            size="small"
            onClick={() => setGuests({ ...guests, adults: guests.adults + 1 })}
          >
            +
          </Button>
        </div>
      </div>
      <div className="guest-stepper-row">
        <Text strong>Trẻ em</Text>
        <div className="guest-stepper">
          <Button
            shape="circle"
            size="small"
            disabled={guests.children <= 0}
            onClick={() =>
              setGuests({ ...guests, children: guests.children - 1 })
            }
          >
            -
          </Button>
          <Text strong style={{ minWidth: 24, textAlign: "center" }}>
            {guests.children}
          </Text>
          <Button
            shape="circle"
            size="small"
            disabled={guests.children >= 6}
            onClick={() =>
              setGuests({ ...guests, children: guests.children + 1 })
            }
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="type-detail-page">
      <div className="type-detail-container">
        <div className="type-breadcrumb">
          <Link to={`/rooms?${backQuery}`}>
            <FontAwesomeIcon icon={faChevronLeft} /> Quay lại kết quả tìm kiếm
          </Link>
        </div>

        {/* Gallery */}
        <div className="type-gallery">
          <div className="gallery-main">
            <img
              src={gallery[selectedImage]}
              alt={roomType.typeName}
              onError={(e) => handleRoomImageError(e, roomType.typeName)}
            />
            <button
              className="gallery-nav prev"
              onClick={() =>
                setSelectedImage(
                  (selectedImage - 1 + gallery.length) % gallery.length,
                )
              }
              aria-label="Ảnh trước"
            >
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <button
              className="gallery-nav next"
              onClick={() =>
                setSelectedImage((selectedImage + 1) % gallery.length)
              }
              aria-label="Ảnh sau"
            >
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
            <span className="gallery-counter">
              {selectedImage + 1}/{gallery.length}
            </span>
          </div>
          <div className="gallery-thumbs">
            {gallery.map((image, index) => (
              <img
                key={image}
                src={image}
                alt=""
                className={index === selectedImage ? "active" : ""}
                onClick={() => setSelectedImage(index)}
                onError={(e) => handleRoomImageError(e, roomType.typeName)}
              />
            ))}
          </div>
        </div>

        <div className="type-detail-layout">
          {/* Cột trái: thông tin */}
          <div className="type-detail-info">
            <div className="type-detail-header">
              <h1>Phòng {roomType.typeName}</h1>
              {roomType.avgRating !== null && (
                <span className="type-rating">
                  <FontAwesomeIcon icon={faStar} />{" "}
                  {roomType.avgRating.toFixed(1)}
                  <em>({roomType.reviewCount} đánh giá)</em>
                </span>
              )}
            </div>

            <div className="type-specs">
              <span>
                <FontAwesomeIcon icon={faUserGroup} /> Tiêu chuẩn:{" "}
                <strong>{adultCapacity} NL + {childCapacity} TE</strong>
              </span>

              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: 'linear-gradient(135deg, #fff4e5 0%, #ffe8cc 100%)',
                color: '#b45309',
                fontWeight: 600,
                fontSize: 14,
                border: '1px solid #fdba74',
              }}>
                <FontAwesomeIcon icon={faUserGroup} /> Tối đa {maxOcc} khách/phòng
              </span>
              {roomType.minArea !== null && (
                <span>
                  <FontAwesomeIcon icon={faExpandArrowsAlt} />{" "}
                  {roomType.minArea === roomType.maxArea
                    ? `${roomType.minArea}m²`
                    : `${roomType.minArea}–${roomType.maxArea}m²`}
                </span>
              )}
            </div>

            <div className="type-section capacity-policy-section">
              <h2>Chính sách sức chứa & phụ thu</h2>

              <div className="policy-block-grid">
                <div className="policy-box">
                  <h4>1. Sức chứa tiêu chuẩn (Đã bao gồm trong giá phòng)</h4>
                  <ul>
                    <li>Người lớn tiêu chuẩn: <strong>{adultCapacity} người lớn</strong></li>
                    <li>Trẻ em tiêu chuẩn: <strong>{childCapacity} trẻ em</strong></li>
                    <li>Tổng sức chứa tiêu chuẩn: <strong>{adultCapacity + childCapacity} người / phòng</strong></li>
                  </ul>
                </div>

                <div className="policy-box">
                  <h4>2. Sức chứa tối đa (Giới hạn 1 phòng)</h4>
                  <ul>
                    <li>Giới hạn tối đa: <strong>{maxOcc} khách / phòng</strong> (Bao gồm cả Người lớn & Trẻ em)</li>
                  </ul>
                </div>

                <div className="policy-box highlight">
                  <h4>3. Phụ thu khách phát sinh (/người/đêm)</h4>
                  <ul>
                    <li>Phụ thu người lớn phát sinh: <strong>{formatPrice(extraAdultFee)} / người / đêm</strong></li>
                    <li>Phụ thu trẻ em phát sinh: <strong>{formatPrice(extraChildFee)} / người / đêm</strong></li>
                  </ul>
                  <p className="policy-note">
                    <em>* Khách vượt sức chứa tiêu chuẩn nhưng chưa vượt sức chứa tối đa có thể được tính phụ thu theo số người phát sinh và số đêm lưu trú.</em>
                  </p>
                </div>
              </div>
            </div>

            <div className="type-section">
              <h2>Mô tả</h2>
              <p>
                {roomType.description ||
                  "Phòng tiện nghi, sạch sẽ với dịch vụ chu đáo, phù hợp cho cả công tác và nghỉ dưỡng."}
              </p>
            </div>

            {roomType.amenities.length > 0 && (
              <div className="type-section">
                <h2>Tiện nghi phòng</h2>
                <div className="amenities-grid">
                  {roomType.amenities.map((amenity) => (
                    <span key={amenity.name} className="amenity-item">
                      <FontAwesomeIcon icon={faCheck} /> {amenity.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="type-section">
              <h2>Đánh giá của khách ({reviews.length})</h2>
              {reviews.length === 0 ? (
                <p className="no-reviews">
                  Chưa có đánh giá nào cho hạng phòng này.
                </p>
              ) : (
                <div className="reviews-list">
                  {reviews.map((review) => (
                    <div key={review.id} className="review-item">
                      <div className="review-head">
                        <strong>{review.customerName}</strong>
                        <span className="review-stars">
                          {Array.from({ length: review.rating }, (_, i) => (
                            <FontAwesomeIcon key={i} icon={faStar} />
                          ))}
                        </span>
                        <span className="review-date">
                          {new Date(review.createdAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="review-comment">“{review.comment}”</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cột phải: widget đặt phòng */}
          <div className="booking-widget">
            <div className="widget-price">
              {hasDates && totalStay > 0 ? (
                <>
                  <span className="price-main">{formatPrice(totalStay * minimumRooms)}</span>
                  <span className="price-unit">
                    {minimumRooms > 1 ? `cho ${minimumRooms} phòng / ${nights} đêm` : `cho 1 phòng / ${nights} đêm`}
                  </span>
                  <span className="price-sub" style={{ fontSize: "12px", color: "#888", width: "100%", marginTop: "4px" }}>
                    {formatPrice(Math.round(totalStay / nights))}/phòng/đêm · Chưa gồm phụ thu phát sinh
                  </span>
                </>
              ) : (
                <>
                  <span className="price-from">Chỉ từ</span>
                  <span className="price-main">
                    {formatPrice(roomType.defaultPrice)}
                  </span>
                  <span className="price-unit">/ phòng / đêm</span>
                  <span className="price-sub" style={{ fontSize: "12px", color: "#888", width: "100%", marginTop: "4px" }}>
                    Chưa gồm phụ thu phát sinh
                  </span>
                </>
              )}
            </div>

            <div className="widget-field">
              <span className="filter-label">Ngày nhận – trả phòng</span>
              <RangePicker
                value={dateRange}
                minDate={dayjs()}
                placeholder={["Ngày đến", "Ngày đi"]}
                onChange={(dates) =>
                  setDateRange(
                    (dates as [dayjs.Dayjs | null, dayjs.Dayjs | null]) || [
                      null,
                      null,
                    ],
                  )
                }
                style={{ width: "100%" }}
              />
            </div>

            <div className="widget-field">
              <span className="filter-label">Khách</span>
              <Popover
                content={guestContent}
                trigger="click"
                open={guestOpen}
                onOpenChange={setGuestOpen}
                placement="bottom"
              >
                <button type="button" className="guest-selector-btn">
                  <UserOutlined />
                  <span>
                    {guests.adults} người lớn
                    {guests.children > 0 ? `, ${guests.children} trẻ em` : ""}
                  </span>
                </button>
              </Popover>
            </div>

            {hasDates &&
              !quoteLoading &&
              (soldOut ? (
                <p className="widget-stock sold">
                  Rất tiếc, hạng phòng đã hết phòng trống trong khoảng ngày này.
                </p>
              ) : lowStock ? (
                <p className="widget-stock low">
                  Chỉ còn {roomType.availableRooms} phòng — đặt sớm kẻo lỡ!
                </p>
              ) : (
                <p className="widget-stock ok">
                  Còn {roomType.availableRooms} phòng trống
                </p>
              ))}

            {needMoreRooms && (
              <p className="widget-stock low" style={{ color: "#d35400" }}>
                Hạng phòng này ở tối đa {maxOcc} khách/phòng — cần tối thiểu{" "}
                {minimumRooms} phòng cho số khách của bạn.
              </p>
            )}

            {overCapacity && (
              <p className="widget-stock sold">
                Số khách vượt quá tổng sức chứa của hạng phòng này.
              </p>
            )}

            <button
              className="btn-book widget-book"
              disabled={soldOut || overCapacity || quoteLoading}
              onClick={() => {
                if (!hasDates) {
                  // Cho phép sang trang đặt để chọn ngày ở đó
                  navigate(`/booking?${bookingQuery}`);
                  return;
                }
                navigate(`/booking?${bookingQuery}`);
              }}
            >
              {quoteLoading ? "Đang kiểm tra..." : "Đặt ngay"}
            </button>

            <ul className="widget-perks">
              <li><FontAwesomeIcon icon={faCheck} /> Xác nhận ngay lập tức</li>
              <li><FontAwesomeIcon icon={faCheck} /> Giữ phòng 15 phút để thanh toán</li>
              <li><FontAwesomeIcon icon={faCheck} /> Hoàn 100% khi hủy trên 7 ngày trước nhận phòng</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomTypeDetail;
