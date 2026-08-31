import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DatePicker, Popover, Button, Typography } from "antd";
import { UserOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserGroup,
  faExpandArrowsAlt,
  faStar,
  faCheck,
  faBell,
} from "@fortawesome/free-solid-svg-icons";
import { searchRoomTypes } from "../../services/roomService";
import type { RoomTypeSearchResult } from "../../services/roomService";
import { unwrapList } from "../../utils/unwrapList";
import {
  getRoomTypeCardImage,
  getRoomTypeGallery,
  handleRoomImageError,
} from "../../utils/roomTypeImages";
import "./RoomList.css";

const { RangePicker } = DatePicker;
const { Text } = Typography;

const DATE_FORMAT = "YYYY-MM-DD";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(price) + "đ";

const RoomList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const adults = Math.max(
    1,
    parseInt(searchParams.get("adults") || "2", 10) || 2,
  );
  const children = Math.max(
    0,
    parseInt(searchParams.get("children") || "0", 10) || 0,
  );
  const childAges = searchParams.get("childAges") || "";
  const hasDates =
    dayjs(checkIn, DATE_FORMAT, true).isValid() &&
    dayjs(checkOut, DATE_FORMAT, true).isValid() &&
    dayjs(checkOut).isAfter(dayjs(checkIn));

  // Khi tìm lại phòng từ thanh lọc hoặc từ trang chủ, luôn hiển thị từ đầu
  // trang kết quả thay vì giữ vị trí cuộn ở giữa danh sách trước đó.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [checkIn, checkOut, adults, children]);

  // Draft của thanh tìm kiếm (chỉ áp dụng khi bấm Tìm kiếm)
  const [dateRange, setDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null]
  >([hasDates ? dayjs(checkIn) : null, hasDates ? dayjs(checkOut) : null]);
  const [draftAdults, setDraftAdults] = useState(adults);
  const [draftChildren, setDraftChildren] = useState(children);
  const [guestOpen, setGuestOpen] = useState(false);

  const [roomTypes, setRoomTypes] = useState<RoomTypeSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("recommended");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await searchRoomTypes({
          ...(hasDates ? { checkIn, checkOut } : {}),
          guests: adults + children,
        });
        setRoomTypes(unwrapList(response) as RoomTypeSearchResult[]);
      } catch (err) {
        setError(
          (err as Error).message || "Có lỗi khi tải danh sách hạng phòng",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchTypes();
  }, [checkIn, checkOut, adults, children, hasDates]);

  const nights = hasDates ? dayjs(checkOut).diff(dayjs(checkIn), "day") : 0;

  const applySearch = () => {
    const params = new URLSearchParams({
      checkIn: dateRange[0]?.format(DATE_FORMAT) || "",
      checkOut: dateRange[1]?.format(DATE_FORMAT) || "",
      adults: String(draftAdults),
      children: String(draftChildren),
      childAges: childAges
        .split(",")
        .filter(Boolean)
        .slice(0, draftChildren)
        .concat(
          Array(
            Math.max(
              0,
              draftChildren - childAges.split(",").filter(Boolean).length,
            ),
          ).fill("8"),
        )
        .join(","),
    });
    setSearchParams(params);
  };

  // Query string truyền tiếp sang trang chi tiết / đặt phòng
  const forwardQuery = useMemo(() => {
    const params = new URLSearchParams({
      adults: String(adults),
      children: String(children),
    });
    if (hasDates) {
      params.set("checkIn", checkIn);
      params.set("checkOut", checkOut);
    }
    if (childAges) params.set("childAges", childAges);
    return params.toString();
  }, [adults, children, checkIn, checkOut, childAges, hasDates]);

  const sortedTypes = useMemo(() => {
    const list = roomTypes.filter((type) => {
      if (!onlyAvailable || !hasDates) return true;
      return (type.availableRooms ?? 0) > 0;
    });
    return [...list].sort((a, b) => {
      if (sortBy === "price-low") return a.defaultPrice - b.defaultPrice;
      if (sortBy === "price-high") return b.defaultPrice - a.defaultPrice;
      if (sortBy === "rating") return (b.avgRating ?? 0) - (a.avgRating ?? 0);
      // recommended: hạng còn phòng và đủ sức chứa lên trước, sau đó theo giá
      const aSoldOut = hasDates && (a.availableRooms ?? 0) === 0 ? 1 : 0;
      const bSoldOut = hasDates && (b.availableRooms ?? 0) === 0 ? 1 : 0;
      if (aSoldOut !== bSoldOut) return aSoldOut - bSoldOut;
      const aFits = a.fitsGuests === false ? 1 : 0;
      const bFits = b.fitsGuests === false ? 1 : 0;
      if (aFits !== bFits) return aFits - bFits;
      return a.defaultPrice - b.defaultPrice;
    });
  }, [roomTypes, sortBy, onlyAvailable, hasDates]);

  const guestContent = (
    <div style={{ padding: 8, minWidth: 240 }}>
      <div className="guest-stepper-row">
        <Text strong>Người lớn</Text>
        <div className="guest-stepper">
          <Button
            shape="circle"
            size="small"
            disabled={draftAdults <= 1}
            onClick={() => setDraftAdults(draftAdults - 1)}
          >
            -
          </Button>
          <Text strong style={{ minWidth: 24, textAlign: "center" }}>
            {draftAdults}
          </Text>
          <Button
            shape="circle"
            size="small"
            onClick={() => setDraftAdults(draftAdults + 1)}
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
            disabled={draftChildren <= 0}
            onClick={() => setDraftChildren(draftChildren - 1)}
          >
            -
          </Button>
          <Text strong style={{ minWidth: 24, textAlign: "center" }}>
            {draftChildren}
          </Text>
          <Button
            shape="circle"
            size="small"
            disabled={draftChildren >= 6}
            onClick={() => setDraftChildren(draftChildren + 1)}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rooms-page">
      <div className="rooms-hero rooms-hero-compact">
        <div className="rooms-hero-content">
          <h1>Chọn hạng phòng</h1>
          <p>Tìm hạng phòng phù hợp cho kỳ nghỉ của bạn</p>
        </div>
      </div>

      <div className="rooms-container">
        {/* Thanh tìm kiếm: ngày + số khách */}
        <div className="results-search-bar">
          <div className="results-search-field">
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
            />
          </div>
          <div className="results-search-field">
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
                  {draftAdults} người lớn
                  {draftChildren > 0 ? `, ${draftChildren} trẻ em` : ""}
                </span>
              </button>
            </Popover>
          </div>
          <button
            type="button"
            className="btn-apply-search"
            onClick={applySearch}
          >
            <SearchOutlined /> Tìm kiếm
          </button>
        </div>

        {!hasDates && (
          <div className="pick-dates-notice">
            <FontAwesomeIcon icon={faBell} />
            <span>
              Chọn ngày nhận – trả phòng để xem chính xác tình trạng phòng trống
              và tổng giá cho kỳ nghỉ.
            </span>
          </div>
        )}

        <div className="results-toolbar">
          <div className="results-summary">
            {hasDates ? (
              <p>
                <strong>
                  {dayjs(checkIn).format("DD/MM/YYYY")} →{" "}
                  {dayjs(checkOut).format("DD/MM/YYYY")}
                </strong>
                {" · "}
                {nights} đêm · {adults} người lớn
                {children > 0 ? `, ${children} trẻ em` : ""}
              </p>
            ) : (
              <p>Tất cả hạng phòng của khách sạn</p>
            )}
          </div>
          <div className="results-controls">
            {hasDates && (
              <label className="only-available-toggle">
                <input
                  type="checkbox"
                  checked={onlyAvailable}
                  onChange={(e) => setOnlyAvailable(e.target.checked)}
                />
                Chỉ hiện hạng còn phòng
              </label>
            )}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="recommended">Đề xuất cho bạn</option>
              <option value="price-low">Giá: Thấp đến cao</option>
              <option value="price-high">Giá: Cao đến thấp</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="rooms-loading">
            <div className="spinner"></div>
            <p>Đang tìm phòng trống...</p>
          </div>
        ) : error ? (
          <div className="rooms-error">
            <p>{error}</p>
          </div>
        ) : sortedTypes.length === 0 ? (
          <div className="rooms-error">
            <p>
              Không còn hạng phòng nào trống trong khoảng ngày đã chọn. Vui lòng
              thử ngày khác.
            </p>
          </div>
        ) : (
          <div className="type-results-list">
            {sortedTypes.map((type) => {
              const adultCapacity = type.adultCapacity ?? 0;
              const childCapacity = type.childCapacity ?? 0;

              const extraAdultFee = Number(type.extraAdultFee ?? 0);
              const extraChildFee = Number(type.extraChildFee ?? 0);
              const maxOcc = type.maxOccupancy ?? type.capacity;
              const soldOut = hasDates && (type.availableRooms ?? 0) === 0;
              const lowStock =
                hasDates && !soldOut && (type.availableRooms ?? 0) <= 3;
              const overCapacity = type.fitsGuests === false;
              const needMoreRooms = !overCapacity && type.fitsOneRoom === false;
              const guestCount = adults + children;

              const minRooms =
                type.minimumRooms ??
                (guestCount > 0 ? Math.ceil(guestCount / maxOcc) : 1);
              const gallery = getRoomTypeGallery(type.typeName, type.images);
              const totalStay =
                type.stayAmount ??
                (nights > 0 ? type.defaultPrice * nights : 0);

              return (
                <div
                  key={type.id}
                  className={`type-card${soldOut ? " sold-out" : ""}`}
                >
                  <Link
                    to={`/room-types/${type.id}?${forwardQuery}`}
                    className="type-card-image"
                  >
                    <img
                      src={getRoomTypeCardImage(type.typeName, type.images)}
                      alt={type.typeName}
                      loading="lazy"
                      onError={(e) => handleRoomImageError(e, type.typeName)}
                    />
                    <span className="photo-count">{gallery.length} ảnh</span>
                    {soldOut && (
                      <span className="sold-out-badge">Hết phòng</span>
                    )}
                  </Link>

                  <div className="type-card-body">
                    <div className="type-card-header">
                      <h3>
                        <Link to={`/room-types/${type.id}?${forwardQuery}`}>
                          Phòng {type.typeName}
                        </Link>
                      </h3>
                      {type.avgRating !== null && (
                        <span className="type-rating">
                          <FontAwesomeIcon icon={faStar} />{" "}
                          {type.avgRating.toFixed(1)}
                          <em>({type.reviewCount} đánh giá)</em>
                        </span>
                      )}
                    </div>

                    <div className="type-specs">
                      <span>
                        <FontAwesomeIcon icon={faUserGroup} /> Tiêu chuẩn:{" "}
                        <strong>{adultCapacity + childCapacity} khách</strong>
                      </span>

                      <span>
                        <strong>Tối đa:</strong> {maxOcc} khách/phòng
                      </span>
                      {type.minArea !== null && (
                        <span>
                          <FontAwesomeIcon icon={faExpandArrowsAlt} />{" "}
                          {type.minArea === type.maxArea
                            ? `${type.minArea}m²`
                            : `${type.minArea}–${type.maxArea}m²`}
                        </span>
                      )}
                    </div>

                    <div className="type-extra-fee-info">
                      <span className="fee-label">Phụ thu phát sinh:</span>{" "}
                      <span>Người lớn: <strong>{formatPrice(extraAdultFee)}</strong>/người/đêm</span>
                      {" · "}
                      <span>Trẻ em: <strong>{formatPrice(extraChildFee)}</strong>/người/đêm</span>
                    </div>

                    {type.amenities.length > 0 && (
                      <div className="type-amenities">
                        {type.amenities.slice(0, 5).map((amenity) => (
                          <span key={amenity.name} className="amenity-chip">
                            <FontAwesomeIcon icon={faCheck} /> {amenity.name}
                          </span>
                        ))}
                        {type.amenities.length > 5 && (
                          <span className="amenity-chip more">
                            +{type.amenities.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="type-description">
                      {type.description ||
                        "Phòng tiện nghi, sạch sẽ với dịch vụ chu đáo."}
                    </p>

                    {overCapacity && (
                      <p className="capacity-warning">
                        Với {guestCount} khách vượt quá tổng sức chứa tối đa của số phòng hiện có (tối đa {maxOcc} khách/phòng).
                      </p>
                    )}

                    {needMoreRooms && (
                      <p className="capacity-warning">
                        Hạng phòng này ở tối đa {maxOcc} khách/phòng — với {guestCount} khách cần tối thiểu {minRooms} phòng (tiêu chuẩn {adultCapacity + childCapacity} khách/phòng). Khách vượt sức chứa tiêu chuẩn có thể phát sinh phụ thu.
                      </p>
                    )}

                    {!overCapacity && !needMoreRooms && guestCount > (adultCapacity + childCapacity) && (
                      <p className="capacity-notice">
                        Số khách chọn ({guestCount} người) vượt sức chứa tiêu chuẩn ({adultCapacity + childCapacity} người/phòng) → Có thể phát sinh phụ thu khách phát sinh.
                      </p>
                    )}
                  </div>

                  <div className="type-card-price">
                    {lowStock && (
                      <span className="low-stock">
                        Chỉ còn {type.availableRooms} phòng!
                      </span>
                    )}
                    {hasDates && !soldOut && !lowStock && (
                      <span className="in-stock">
                        Còn {type.availableRooms} phòng trống
                      </span>
                    )}

                    <div className="price-block">
                      {hasDates && totalStay > 0 ? (
                        <>
                          <span className="price-main">
                            {formatPrice(totalStay * minRooms)}
                          </span>
                          <span className="price-unit">
                            {minRooms > 1 ? `cho ${minRooms} phòng / ${nights} đêm` : `cho 1 phòng / ${nights} đêm`}
                          </span>
                          <span className="price-sub">
                            {formatPrice(Math.round(totalStay / nights))}/phòng/đêm · Chưa gồm phụ thu khách phát sinh
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="price-from">Chỉ từ</span>
                          <span className="price-main">
                            {formatPrice(type.defaultPrice)}
                          </span>
                          <span className="price-unit">/ phòng / đêm</span>
                          <span className="price-sub">Chưa gồm phụ thu khách phát sinh</span>
                        </>
                      )}
                    </div>

                    <div className="type-card-actions">
                      <Link to={`/room-types/${type.id}?${forwardQuery}`}>
                        <button className="btn-detail">Xem chi tiết</button>
                      </Link>
                      {soldOut ? (
                        <button className="btn-book disabled" disabled>
                          Hết phòng
                        </button>
                      ) : (
                        <Link to={`/booking?type=${type.id}&${forwardQuery}`}>
                          <button className="btn-book">Đặt ngay</button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomList;