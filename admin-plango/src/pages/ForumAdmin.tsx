import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  MessageSquare,
  Search,
  Trash2,
  Eye,
  ArrowUp,
  ArrowDown,
  MessageCircle,
  RefreshCw,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { apiRequest } from "../lib/api";

interface ForumThread {
  threadId: number;
  authorId: number;
  authorName: string;
  title: string;
  body: string;
  destinationId?: number | null;
  destinationName?: string | null;
  category?: string | null;
  status: string;
  acceptedReplyId?: number | null;
  viewCount: number;
  replyCount: number;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

const CAT_LABEL: Record<string, string> = {
  question: "Câu hỏi",
  discussion: "Thảo luận",
  tip: "Mẹo hay",
  recommendation: "Gợi ý",
};
const CAT_COLOR: Record<string, string> = {
  question: "bg-blue-100 text-blue-700",
  discussion: "bg-purple-100 text-purple-700",
  tip: "bg-emerald-100 text-emerald-700",
  recommendation: "bg-amber-100 text-amber-700",
};

const ForumAdmin: React.FC = () => {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "solved" | "unanswered">("all");
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "unanswered">("latest");
  const [selected, setSelected] = useState<ForumThread | null>(null);

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: sortBy, limit: "200" });
      if (search.trim()) params.set("q", search.trim());
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all" && statusFilter !== "unanswered") {
        params.set("status", statusFilter);
      }
      const res = await apiRequest("GET", `/api/forum/threads?${params.toString()}`);
      let data = res.data || [];
      if (statusFilter === "unanswered") {
        data = data.filter((t: ForumThread) => t.replyCount === 0);
      }
      setThreads(data);
    } catch (err) {
      console.error("Failed to fetch threads", err);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, sortBy]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const deleteThread = async (thread: ForumThread) => {
    if (
      !window.confirm(
        `XÓA câu hỏi "${thread.title}"?\n\nHành động này KHÔNG THỂ hoàn tác. Tất cả câu trả lời, votes liên quan cũng sẽ bị xóa.`,
      )
    ) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/forum/threads/${thread.threadId}`);
      setSelected(null);
      await fetchThreads();
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không xóa được"));
    }
  };

  const stats = useMemo(() => {
    return {
      total: threads.length,
      solved: threads.filter((t) => t.status === "solved").length,
      open: threads.filter((t) => t.status === "open").length,
      unanswered: threads.filter((t) => t.replyCount === 0).length,
    };
  }, [threads]);

  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <MessageSquare size={28} className="text-purple-600" />
            Diễn đàn
          </h2>
          <p className="text-slate-500 mt-1">
            {stats.total} câu hỏi · {stats.solved} đã giải đáp · {stats.unanswered} chưa trả lời
          </p>
        </div>
        <button
          onClick={fetchThreads}
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
            placeholder="Tìm câu hỏi..."
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="open">Đang mở</option>
          <option value="solved">Đã giải đáp</option>
          <option value="unanswered">Chưa trả lời</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm bg-white"
        >
          <option value="latest">Mới nhất</option>
          <option value="popular">Nhiều vote</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500">Đang tải...</div>
      ) : threads.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <MessageSquare size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Không có câu hỏi</h3>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Câu hỏi
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
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Trạng thái
                </th>
                <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.threadId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-semibold text-sm text-slate-800 max-w-md line-clamp-2">
                      {t.title}
                    </div>
                    {t.destinationName && (
                      <div className="text-xs text-slate-500 mt-1">📍 {t.destinationName}</div>
                    )}
                  </td>
                  <td className="p-4 text-sm text-slate-700">{t.authorName}</td>
                  <td className="p-4">
                    {t.category ? (
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded ${
                          CAT_COLOR[t.category] || "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {CAT_LABEL[t.category] || t.category}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <ArrowUp size={12} className="text-emerald-600" />
                        {t.upvotes}
                      </span>
                      <span className="flex items-center gap-1">
                        <ArrowDown size={12} className="text-red-500" />
                        {t.downvotes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={12} />
                        {t.replyCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye size={12} />
                        {t.viewCount}
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    {t.status === "solved" ? (
                      <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded inline-flex items-center gap-1">
                        <CheckCircle size={11} />
                        Đã giải đáp
                      </span>
                    ) : t.replyCount === 0 ? (
                      <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded inline-flex items-center gap-1">
                        <HelpCircle size={11} />
                        Chưa trả lời
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">
                        Đang mở
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setSelected(t)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50"
                      >
                        Xem
                      </button>
                      <button
                        onClick={() => deleteThread(t)}
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
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-2">{selected.title}</h3>
              <div className="flex items-center gap-3 text-sm text-slate-500 mb-4 flex-wrap">
                <span>Tác giả: {selected.authorName}</span>
                <span>·</span>
                <span>{new Date(selected.createdAt).toLocaleString("vi-VN")}</span>
                {selected.destinationName && (
                  <>
                    <span>·</span>
                    <span>📍 {selected.destinationName}</span>
                  </>
                )}
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 p-4 rounded-lg">
                {selected.body}
              </div>
              <div className="mt-4 flex gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1">
                  <ArrowUp size={14} className="text-emerald-600" />
                  {selected.upvotes} hữu ích
                </span>
                <span className="flex items-center gap-1">
                  <ArrowDown size={14} className="text-red-500" />
                  {selected.downvotes} phản đối
                </span>
                <span className="flex items-center gap-1">
                  <MessageCircle size={14} />
                  {selected.replyCount} trả lời
                </span>
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  {selected.viewCount} lượt xem
                </span>
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
                onClick={() => deleteThread(selected)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center gap-2"
              >
                <Trash2 size={14} />
                Xóa câu hỏi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ForumAdmin;
