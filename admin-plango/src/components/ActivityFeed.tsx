import React from "react";
import { User, MapPin, Star, AlertCircle, ChevronRight } from "lucide-react";

interface ActivityItemProps {
  type: "user" | "trip" | "review" | "system";
  title: string;
  description: string;
  timestamp: string;
  rating?: number;
  avatar?: string;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  type,
  title,
  description,
  timestamp,
  rating,
  avatar,
}) => {
  const IconMap = {
    user: <User size={18} className="text-slate-600" />,
    trip: <MapPin size={18} className="text-orange-600" />,
    review: <Star size={18} className="text-cyan-600" />,
    system: <AlertCircle size={18} className="text-rose-600" />,
  };

  const BgMap = {
    user: "bg-slate-100",
    trip: "bg-orange-50",
    review: "bg-cyan-50",
    system: "bg-rose-50",
  };

  return (
    <div className="flex items-center gap-4 py-6 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-4 group cursor-pointer">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${avatar ? "" : BgMap[type]}`}
      >
        {avatar ? (
          <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          IconMap[type]
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-bold text-slate-800 tracking-tight">{title}</p>
          <p className="text-sm text-slate-500 line-clamp-1">{description}</p>
        </div>
        <p className="text-xs text-slate-400 mt-1">{timestamp}</p>
      </div>
      <div className="flex items-center gap-4">
        {rating && (
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < rating ? "fill-[#B45309] text-[#B45309]" : "text-slate-200"}
              />
            ))}
          </div>
        )}
        <ChevronRight
          size={18}
          className="text-slate-300 group-hover:text-slate-500 transition-colors"
        />
      </div>
    </div>
  );
};

const ActivityFeed: React.FC = () => {
  const activities: ActivityItemProps[] = [
    {
      type: "user",
      title: "Người dùng mới:",
      description: "Julian David đăng ký qua thư mời công ty.",
      timestamp: "2 phút trước",
      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
    },
    {
      type: "trip",
      title: "Chuyến đi Tokyo:",
      description: "Chuyến bay và Khách sạn đã xác nhận cho Sarah Jenkins.",
      timestamp: "14 phút trước",
    },
    {
      type: "review",
      title: "Đánh giá mới từ Alice:",
      description: '"The Parisian Loft thật sự tuyệt vời!"',
      timestamp: "1 giờ trước",
      rating: 5,
      avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    },
    {
      type: "system",
      title: "Thông báo hệ thống:",
      description: "Bảo trì định kỳ bắt đầu lúc 03:00 GMT.",
      timestamp: "3 giờ trước",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Hoạt động Gần đây</h3>
        <button className="text-sm font-semibold text-[#0891B2] hover:text-[#0E7490] transition-colors">
          Xem tất cả
        </button>
      </div>
      <div>
        {activities.map((item, idx) => (
          <ActivityItem key={idx} {...item} />
        ))}
      </div>
    </div>
  );
};

export default ActivityFeed;
