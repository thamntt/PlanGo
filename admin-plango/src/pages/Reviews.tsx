import React, { useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { useData } from "../contexts/DataContext";
import type { Review, UserData } from "../lib/types";

type ReviewTab = "item" | "trip";

const Reviews: React.FC = () => {
  const { reviews, users, destinations, pois, deleteReview } = useData();
  const [activeTab, setActiveTab] = useState<ReviewTab>("item");
  const [starFilter, setStarFilter] = useState<number | "all">("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const getTargetInfo = (review: Review) => {
    if (review.reviewType === "item") {
      // Item review → Địa điểm (POI)
      const name = review.poiName || review.activityTitle;
      if (name) return { label: name };

      // Fallback to local lookup if backend fields are missing for some reason
      if (review.poiId) {
        const p = pois.find((x) => x.id === review.poiId);
        if (p) return { label: p.name };
      }
      return { label: `Hoạt động #${review.activityId || "?"}` };
    } else {
      // Trip review → Điểm đến (Destination)
      if (review.destinationName) {
        return { label: review.destinationName };
      }
      if (review.destinationId) {
        const d = destinations.find((x) => x.id === review.destinationId);
        if (d) return { label: d.name };
      }
      return { label: `Chuyến đi #${review.itineraryId || "?"}` };
    }
  };

  const getReviewer = (userId: string): UserData | undefined => {
    return users.find((u) => u.id === userId);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc muốn xoá đánh giá này không?")) {
      deleteReview(id);
    }
  };

  const filteredReviews = reviews
    .filter((r: Review) => {
      const typeMatch = r.reviewType === activeTab;
      const ratingMatch = starFilter === "all" || Math.round(Number(r.rating)) === starFilter;
      return typeMatch && ratingMatch;
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Phê duyệt Đánh giá</h2>
        <p className="text-lg text-slate-500 mt-2">
          Giám sát ý kiến người dùng và kiểm duyệt nội dung.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setActiveTab("item")}
              className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                activeTab === "item"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Địa điểm
            </button>
            <button
              onClick={() => setActiveTab("trip")}
              className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                activeTab === "trip"
                  ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Điểm đến
            </button>
          </div>
          <span className="text-sm font-bold text-slate-400">
            {filteredReviews.length} đánh giá
          </span>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setSortOrder("desc")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                sortOrder === "desc"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Mới nhất
            </button>
            <button
              onClick={() => setSortOrder("asc")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                sortOrder === "asc"
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Cũ nhất
            </button>
          </div>

          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setStarFilter("all")}
              className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                starFilter === "all"
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Tất cả sao
            </button>
            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() => setStarFilter(star)}
                className={`px-4 py-2 text-xs font-black flex items-center gap-1 rounded-lg transition-all ${
                  starFilter === star
                    ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {star}{" "}
                <Star
                  size={12}
                  fill={starFilter === star ? "white" : "currentColor"}
                  className={starFilter === star ? "text-white" : "text-amber-500"}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredReviews.map((review) => {
          const target = getTargetInfo(review);
          const reviewer = getReviewer(review.userId);
          const reviewDate = new Date(review.createdAt).toLocaleDateString();

          return (
            <div
              key={review.id}
              className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  {reviewer?.avatar ? (
                    <img
                      src={reviewer.avatar}
                      className="w-14 h-14 rounded-2xl object-cover ring-4 ring-slate-50"
                      alt=""
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">
                      {reviewer?.fullName?.[0] || "?"}
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-black text-slate-800 tracking-tight">
                      {reviewer?.fullName || review.userName || "Người dùng ẩn danh"}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {reviewDate}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="p-2 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    title="Xoá đánh giá"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      fill={s <= review.rating ? "#EAB308" : "none"}
                      className={s <= review.rating ? "text-amber-500" : "text-slate-200"}
                    />
                  ))}
                </div>
                <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                      review.reviewType === "item"
                        ? "text-indigo-700 bg-indigo-50"
                        : "text-emerald-700 bg-emerald-50"
                    }`}
                  >
                    {review.reviewType === "item" ? "Địa điểm" : "Điểm đến"}
                  </span>
                  <span className="text-sm font-bold text-slate-700">{target.label}</span>
                </div>
              </div>

              <p className="text-slate-600 leading-relaxed font-medium">
                &ldquo;
                {review.comment
                  .replace(/\s*\[activity:[^\]]+\]/g, "")
                  .replace(/\s*\[resetBefore:[^\]]+\]/g, "")
                  .trim()}
                &rdquo;
              </p>
            </div>
          );
        })}
        {filteredReviews.length === 0 && (
          <div className="py-12 text-center text-slate-500 font-medium">
            Chưa có đánh giá nào cho {activeTab === "item" ? "địa điểm" : "điểm đến"}.
          </div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
