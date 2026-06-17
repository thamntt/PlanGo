import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flag, Newspaper, MessageSquare, AlertCircle, Star, Trophy } from "lucide-react";
import StatCard from "../components/StatCard";
import GrowthChart from "../components/Charts/GrowthChart";
import ActivityTrendsChart from "../components/Charts/ActivityTrendsChart";
import ActivityFeed from "../components/ActivityFeed";
import PopularDestinations from "../components/PopularDestinations";
import DoughnutChart from "../components/Charts/DoughnutChart";
import { useData } from "../contexts/DataContext";
import { apiRequest } from "../lib/api";

interface CommunityStats {
  blogPostCount: number;
  forumThreadCount: number;
  pendingReportCount: number;
  groupedReportCount: number;
}

const Dashboard: React.FC = () => {
  const { users, itineraries, destinations, reviews, adminStats } = useData();
  const [community, setCommunity] = useState<CommunityStats>({
    blogPostCount: 0,
    forumThreadCount: 0,
    pendingReportCount: 0,
    groupedReportCount: 0,
  });

  useEffect(() => {
    const loadCommunity = async () => {
      try {
        const [blogRes, forumRes, reportsRes, groupedRes] = await Promise.all([
          apiRequest("GET", "/api/blog/posts?limit=500"),
          apiRequest("GET", "/api/forum/threads?limit=500"),
          apiRequest("GET", "/api/admin/moderation/queue"),
          apiRequest("GET", "/api/admin/moderation/queue?grouped=true"),
        ]);
        // The axios interceptor already unwraps `{status, data}` → returns the
        // array directly. Don't double-unwrap.
        setCommunity({
          blogPostCount: Array.isArray(blogRes) ? blogRes.length : 0,
          forumThreadCount: Array.isArray(forumRes) ? forumRes.length : 0,
          pendingReportCount: Array.isArray(reportsRes) ? reportsRes.length : 0,
          groupedReportCount: Array.isArray(groupedRes) ? groupedRes.length : 0,
        });
      } catch (err) {
        console.warn("Failed to load community stats", err);
      }
    };
    loadCommunity();
  }, []);

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">
          Bảng điều khiển
        </h2>
        <p className="text-lg text-slate-500 mt-2">
          Theo dõi người dùng, điểm đến và hoạt động hệ thống theo thời gian thực
        </p>
      </div>

      {/* Alert if pending reports */}
      {community.pendingReportCount > 0 && (
        <Link
          to="/reports"
          className="block mb-6 bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle size={24} className="text-red-600" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-red-700 text-lg">
                {community.pendingReportCount} báo cáo cộng đồng đang chờ xử lý
              </div>
              <div className="text-sm text-red-600 mt-1">
                {community.groupedReportCount} nội dung bị báo cáo · Click để xử lý
              </div>
            </div>
            <div className="text-red-500 font-bold text-xl">→</div>
          </div>
        </Link>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon="users"
          label="Tổng Người dùng"
          value={users.filter((u) => u.role === "user").length.toString()}
          to="/users"
        />
        <StatCard
          icon="trips"
          label="Tổng số Chuyến đi"
          value={itineraries.length.toString()}
          to="/trips"
        />
        <StatCard
          icon="destinations"
          label="Tổng Điểm đến"
          value={destinations.length.toString()}
          to="/destinations"
        />
        <StatCard
          icon="reviews"
          label="Tổng Đánh giá"
          value={reviews.length.toString()}
          to="/reviews"
        />
      </div>

      {/* Community stats */}
      <h3 className="text-xl font-bold text-slate-700 mb-4 mt-8">Cộng đồng</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <Link
          to="/blog"
          className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-cyan-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 bg-cyan-100 rounded-full flex items-center justify-center">
              <Newspaper size={20} className="text-cyan-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{community.blogPostCount}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">Bài viết Blog</div>
        </Link>
        <Link
          to="/forum"
          className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 bg-purple-100 rounded-full flex items-center justify-center">
              <MessageSquare size={20} className="text-purple-600" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{community.forumThreadCount}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">Câu hỏi Diễn đàn</div>
        </Link>
        <Link
          to="/reports"
          className={`bg-white border-2 rounded-xl p-6 hover:shadow-md transition-all ${
            community.pendingReportCount > 0
              ? "border-red-300 bg-red-50"
              : "border-slate-200 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center ${
                community.pendingReportCount > 0 ? "bg-red-100" : "bg-emerald-100"
              }`}
            >
              <Flag
                size={20}
                className={community.pendingReportCount > 0 ? "text-red-600" : "text-emerald-600"}
              />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">{community.pendingReportCount}</div>
          <div className="text-sm font-medium text-slate-500 mt-1">Báo cáo chờ xử lý</div>
        </Link>
        <Link
          to="/users"
          className="bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-amber-300 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 bg-amber-100 rounded-full flex items-center justify-center">
              <span className="text-amber-600 text-lg">⚡</span>
            </div>
          </div>
          <div className="text-3xl font-black text-slate-800">
            {community.blogPostCount + community.forumThreadCount}
          </div>
          <div className="text-sm font-medium text-slate-500 mt-1">Tổng đóng góp</div>
        </Link>
      </div>

      {/* Activity trends bar chart — shows daily activity over the last
          ~14 days. Sits next to growth chart for at-a-glance health. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <GrowthChart />
        </div>
        <ActivityTrendsChart />
      </div>

      {adminStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <DoughnutChart
            title="Phân bổ Loại điểm đến"
            data={adminStats.destinationTypes}
            colors={["#0891B2", "#10B981", "#F59E0B", "#6366F1", "#EC4899"]}
          />
          <DoughnutChart
            title="Trạng thái Chuyến đi"
            data={Object.fromEntries(
              Object.entries(adminStats.tripStatus as Record<string, number>).map(
                ([key, value]) => {
                  const map: Record<string, string> = {
                    draft: "Bản nháp",
                    active: "Đang diễn ra",
                    completed: "Đã hoàn thành",
                    cancelled: "Đã hủy",
                  };
                  return [map[key] || key, value];
                },
              ),
            )}
            colors={["#94A3B8", "#0891B2", "#10B981", "#F43F5E"]}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
        <PopularDestinations />
        {/* Recent activity feed — moderation queue + new signups so admin
            can spot abnormal patterns without leaving the dashboard. */}
        <ActivityFeed />
      </div>

      {/* Quick-look top reviewers table — surfaces the most active community
          contributors so we can recognise/reward them. */}
      <TopReviewersCard />

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          © 2024 Plango Travel Management. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};

/**
 * Top reviewers leaderboard — shows the 5 users with the highest review
 * count, plus their reviewer level so admin can spot star contributors.
 * Falls back gracefully when no reviews exist.
 */
const TopReviewersCard: React.FC = () => {
  const { reviews, users } = useData();

  const ranked = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of reviews) {
      const id = String(r.userId || "");
      if (!id) continue;
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([userId, count]) => {
        const u = users.find((x) => String(x.id) === userId);
        return {
          userId,
          count,
          fullName: u?.fullName || u?.username || `User #${userId}`,
          avatar: u?.avatar,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [reviews, users]);

  if (ranked.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="text-base font-bold text-slate-800">
            Top người đánh giá
          </h3>
        </div>
        <p className="text-sm text-slate-500">Chưa có đánh giá nào.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="text-base font-bold text-slate-800">
            Top người đánh giá
          </h3>
        </div>
        <Link to="/reviews" className="text-xs font-bold text-primary hover:underline">
          Xem tất cả →
        </Link>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Hạng
            </th>
            <th className="text-left py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Người dùng
            </th>
            <th className="text-right py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Số đánh giá
            </th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r, idx) => (
            <tr key={r.userId} className="border-b border-slate-50 last:border-0">
              <td className="py-3">
                <span
                  className={`inline-flex w-6 h-6 rounded-full items-center justify-center text-[10px] font-black ${
                    idx === 0
                      ? "bg-amber-100 text-amber-700"
                      : idx === 1
                        ? "bg-slate-200 text-slate-700"
                        : idx === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {idx + 1}
                </span>
              </td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  {r.avatar ? (
                    <img
                      src={r.avatar}
                      className="w-8 h-8 rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {r.fullName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-700">
                    {r.fullName}
                  </span>
                </div>
              </td>
              <td className="py-3 text-right">
                <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600">
                  <Star size={12} fill="currentColor" />
                  {r.count}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Dashboard;
