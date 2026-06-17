import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Newspaper,
  Search,
  Trash2,
  Eye,
  Heart,
  MessageCircle,
  Bookmark,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { apiRequest } from "../lib/api";

interface BlogPost {
  postId: number;
  authorId: number;
  authorName: string;
  authorAvatar?: string | null;
  title: string;
  excerpt?: string | null;
  coverImage?: string | null;
  category?: string | null;
  status: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  bookmarkCount: number;
  publishedAt?: string | null;
  createdAt?: string;
}

const CAT_LABEL: Record<string, string> = {
  guide: "Hướng dẫn",
  review: "Review",
  story: "Trải nghiệm",
  food: "Ẩm thực",
  tip: "Mẹo hay",
  tips: "Mẹo hay",
  experience: "Trải nghiệm",
};
const CAT_COLOR: Record<string, string> = {
  guide: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  story: "bg-pink-100 text-pink-700",
  food: "bg-amber-100 text-amber-700",
  tip: "bg-emerald-100 text-emerald-700",
  tips: "bg-emerald-100 text-emerald-700",
  experience: "bg-pink-100 text-pink-700",
};

const BlogAdmin: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "trending">("latest");
  const [selected, setSelected] = useState<BlogPost | null>(null);
  const [detailContent, setDetailContent] = useState<any>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy, limit: "200" });
      if (search.trim()) params.set("q", search.trim());
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await apiRequest("GET", `/api/blog/posts?${params.toString()}`);
      setPosts(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to fetch blog posts", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, sortBy]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const openDetail = async (post: BlogPost) => {
    setSelected(post);
    setDetailContent(null);
    try {
      const res = await apiRequest("GET", `/api/blog/posts/${post.postId}`);
      setDetailContent(res);
    } catch {
      setDetailContent({ error: "Không tải được nội dung" });
    }
  };

  const deletePost = async (post: BlogPost) => {
    if (
      !window.confirm(
        `XÓA bài "${post.title}"?\n\nHành động này KHÔNG THỂ hoàn tác. Toàn bộ likes, comments, bookmarks liên quan cũng sẽ bị xóa.`,
      )
    ) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/blog/posts/${post.postId}`);
      setSelected(null);
      await fetchPosts();
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không xóa được"));
    }
  };

  const stats = useMemo(() => {
    return {
      total: posts.length,
      totalLikes: posts.reduce((sum, p) => sum + p.likeCount, 0),
      totalViews: posts.reduce((sum, p) => sum + p.viewCount, 0),
      totalComments: posts.reduce((sum, p) => sum + p.commentCount, 0),
    };
  }, [posts]);

  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Newspaper size={28} className="text-cyan-600" />
            Bài viết Blog
          </h2>
          <p className="text-slate-500 mt-1">
            {stats.total} bài · {stats.totalLikes} lượt thích · {stats.totalViews} lượt xem ·{" "}
            {stats.totalComments} bình luận
          </p>
        </div>
        <button
          onClick={fetchPosts}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          <span className="text-sm font-medium">Tải lại</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-64 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tiêu đề..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">Tất cả danh mục</option>
          {Object.keys(CAT_LABEL).map((c) => (
            <option key={c} value={c}>
              {CAT_LABEL[c]}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="latest">Mới nhất</option>
          <option value="popular">Nhiều like</option>
          <option value="trending">Nhiều view</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500">Đang tải...</div>
      ) : posts.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <Newspaper size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Không có bài viết</h3>
          <p className="text-sm text-slate-500 mt-1">Thử thay đổi bộ lọc</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Bài viết
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Tác giả
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Danh mục
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Tương tác
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Đăng</th>
                <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.postId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {p.coverImage && (
                        <img
                          src={p.coverImage}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="font-semibold text-sm text-slate-800 max-w-xs line-clamp-2">
                        {p.title}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-700">{p.authorName}</td>
                  <td className="p-4">
                    {p.category ? (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          CAT_COLOR[p.category] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {CAT_LABEL[p.category] || p.category}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Heart size={12} className="text-rose-500" />
                        {p.likeCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} />
                        {p.commentCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {p.viewCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bookmark size={12} className="text-amber-500" />
                        {p.bookmarkCount}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openDetail(p)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => deletePost(p)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-semibold hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 size={12} />
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {selected.coverImage && (
              <img
                src={selected.coverImage}
                alt=""
                className="w-full h-64 object-cover rounded-t-2xl"
              />
            )}
            <div className="p-6">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">{selected.title}</h3>
              <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
                <span>Tác giả: {selected.authorName}</span>
                <span>·</span>
                <span>
                  Đăng:{" "}
                  {selected.publishedAt
                    ? new Date(selected.publishedAt).toLocaleString("vi-VN")
                    : "—"}
                </span>
              </div>
              {selected.excerpt && (
                <p className="text-slate-600 italic mb-4 border-l-4 border-slate-200 pl-4">
                  {selected.excerpt}
                </p>
              )}
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-slate-50 p-4 rounded-lg">
                {detailContent?.content || "Đang tải nội dung..."}
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                onClick={() => deletePost(selected)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Xóa bài viết
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default BlogAdmin;
