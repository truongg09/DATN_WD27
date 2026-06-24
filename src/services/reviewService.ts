const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

// ADMIN services
export const fetchReviews = async () => {
  const res = await fetch(`${API_BASE}/reviews`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const fetchReviewDetail = async (id: number) => {
  const res = await fetch(`${API_BASE}/reviews/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const updateReviewStatus = async (id: number, status: string) => {
  const res = await fetch(`${API_BASE}/reviews/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};

export const replyReview = async (id: number, adminReply: string) => {
  const res = await fetch(`${API_BASE}/reviews/${id}/reply`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminReply }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};

export const deleteReviewReply = async (id: number) => {
  const res = await fetch(`${API_BASE}/reviews/${id}/reply`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};

export const deleteReview = async (id: number) => {
  const res = await fetch(`${API_BASE}/reviews/${id}`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};

// USER services

export const fetchReviewByBooking = async (bookingId: number) => {
  const res = await fetch(`${API_BASE}/reviews/booking/${bookingId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const createReview = async (body: {
  bookingId: number;
  customerId: number;
  rating: number;
  comment: string;
}) => {
  const res = await fetch(`${API_BASE}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};

export const updateReview = async (
  id: number,
  body: {
    customerId: number;
    rating: number;
    comment: string;
  },
) => {
  const res = await fetch(`${API_BASE}/reviews/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
};
