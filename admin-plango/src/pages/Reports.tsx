import React, { useState, useEffect, useCallback } from "react";
import {
  Flag,
  AlertTriangle,
  RefreshCw,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
} from "lucide-react";
import { apiRequest } from "../lib/api";

interface Report {
  reportId: number;
  contentType: "blog" | "forum_thread" | "forum_reply" | "blog_comment";
  contentRefId: string;
  reporterId: number;
  reporterName?: string;
  reason: string;
  details?: string | null;
  status: "pending" | "resolved" | "dismissed";
  createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  misinformation: "Sai lệch",
  harassment: "Xúc phạm/Quấy rối",
  offensive: "Phản cảm",
  illegal: "Vi phạm pháp luật",
  other: "Khác",
};
const REASON_COLOR: Record<string, string> = {
  spam: "bg-amber-100 text-amber-700",
  misinformation: "bg-orange-100 text-orange-700",
  harassment: "bg-rose-100 text-rose-700",
  offensive: "bg-red-100 text-red-700",
  illegal: "bg-red-200 text-red-800",
  other: "bg-slate-100 text-slate-700",
};
const CONTENT_TYPE_LABEL: Record<string, string> = {
  blog: "Bài viết blog",
  forum_thread: "Câu hỏi diễn đàn",
  forum_reply: "Trả lời diễn đàn",
  blog_comment: "Bình luận blog",
};

const Reports: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Report | null>(null);
  const [contentPreview, setContentPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // Filter chips — type + reason. Only one view now (per request), so reason
  // filter always applies.
  const [typeFilter, setTypeFilter] = useState<"all" | Report["contentType"]>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/admin/moderation/queue");
      setReports(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to fetch reports", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const openReportDetail = async (report: Report) => {
    setSelected(report);
    setContentPreview(null);
    setPreviewLoading(true);
    try {
      let url = "";
      if (report.contentType === "blog") {
        url = `/api/blog/posts/${report.contentRefId}`;
      } else if (report.contentType === "forum_thread") {
        url = `/api/forum/threads/${report.contentRefId}`;
      } else {
        // For replies/comments — preview not directly available, show what we have
        setContentPreview({ note: "Trả lời / bình luận — xem trong app mobile" });
        setPreviewLoading(false);
        return;
      }
      const res = await apiRequest("GET", url);
      setContentPreview(res);
    } catch (err) {
      setContentPreview({ error: "Không tải được nội dung" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const resolveOne = async (reportId: number, status: "resolved" | "dismissed") => {
    if (
      !window.confirm(
        status === "resolved"
          ? "Đánh dấu báo cáo này là HỢP LỆ (giữ trạng thái — chưa xóa nội dung)?"
          : "Bỏ qua báo cáo này (cho rằng không vi phạm)?",
      )
    ) {
      return;
    }
    try {
      await apiRequest("POST", `/api/admin/moderation/reports/${reportId}/resolve`, { status });
      await fetchReports();
      setSelected(null);
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không xử lý được"));
    }
  };

  const deleteContentAndResolveAll = async (report: Report) => {
    if (
      !window.confirm(
        `XÓA nội dung này khỏi hệ thống + đánh dấu tất cả báo cáo liên quan là đã xử lý?\n\nHành động này KHÔNG THỂ hoàn tác.`,
      )
    ) {
      return;
    }
    try {
      // Delete the underlying content
      const refId = report.contentRefId;
      if (report.contentType === "blog") {
        await apiRequest("DELETE", `/api/blog/posts/${refId}`);
      } else if (report.contentType === "forum_thread") {
        await apiRequest("DELETE", `/api/forum/threads/${refId}`);
      } else if (report.contentType === "forum_reply") {
        await apiRequest("DELETE", `/api/forum/replies/${refId}`);
      } else if (report.contentType === "blog_comment") {
        await apiRequest("DELETE", `/api/blog/comments/${refId}`);
      }
      // Resolve all reports for this content
      await apiRequest("POST", "/api/admin/moderation/content/resolve", {
        contentType: report.contentType,
        contentRefId: Number(refId),
        status: "resolved",
      });
      await fetchReports();
      setSelected(null);
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không xóa được"));
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      (typeFilter === "all" || r.contentType === typeFilter) &&
      (reasonFilter === "all" || r.reason === reasonFilter),
  );

  const totalPending = filteredReports.length;

  // Type counts from the unfiltered list so chips show absolute totals.
  const typeCounts: Record<string, number> = {
    all: reports.length,
    blog: reports.filter((r) => r.contentType === "blog").length,
    forum_thread: reports.filter((r) => r.contentType === "forum_thread").length,
    forum_reply: reports.filter((r) => r.contentType === "forum_reply").length,
    blog_comment: reports.filter((r) => r.contentType === "blog_comment").length,
  };
  const reasonCounts: Record<string, number> = {
    all: reports.length,
    spam: reports.filter((r) => r.reason === "spam").length,
    misinformation: reports.filter((r) => r.reason === "misinformation").length,
    harassment: reports.filter((r) => r.reason === "harassment").length,
    offensive: reports.filter((r) => r.reason === "offensive").length,
    illegal: reports.filter((r) => r.reason === "illegal").length,
    other: reports.filter((r) => r.reason === "other").length,
  };

  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Flag size={28} className="text-rose-500" />
            Báo cáo cộng đồng
          </h2>
          <p className="text-slate-500 mt-1">
            {totalPending} báo cáo đang chờ xử lý
          </p>
        </div>
        <button
          onClick={fetchReports}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          <span className="text-sm font-medium">Tải lại</span>
        </button>
      </div>

      {/* Filter chips — type + reason */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            <Filter size={12} className="inline mr-1" />
            Loại nội dung
          </span>
          {(
            [
              { key: "all", label: "Tất cả" },
              { key: "blog", label: CONTENT_TYPE_LABEL.blog },
              { key: "forum_thread", label: CONTENT_TYPE_LABEL.forum_thread },
              { key: "forum_reply", label: CONTENT_TYPE_LABEL.forum_reply },
              { key: "blog_comment", label: CONTENT_TYPE_LABEL.blog_comment },
            ] as const
          ).map((c) => {
            const active = typeFilter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setTypeFilter(c.key as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  active
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {c.label}
                {typeCounts[c.key] > 0 ? ` · ${typeCounts[c.key]}` : ""}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
            <AlertTriangle size={12} className="inline mr-1" />
            Lý do
          </span>
          {(
            [
              { key: "all", label: "Tất cả" },
              ...Object.keys(REASON_LABEL).map((k) => ({
                key: k,
                label: REASON_LABEL[k],
              })),
            ]
          ).map((c) => {
            const active = reasonFilter === c.key;
            const colorCls = active
              ? c.key === "all"
                ? "bg-primary text-white"
                : `${REASON_COLOR[c.key] || "bg-slate-200"} ring-2 ring-offset-1 ring-slate-400`
              : "bg-slate-100 text-slate-600 hover:bg-slate-200";
            return (
              <button
                key={c.key}
                onClick={() => setReasonFilter(c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${colorCls}`}
              >
                {c.label}
                {reasonCounts[c.key] > 0 ? ` · ${reasonCounts[c.key]}` : ""}
              </button>
            );
          })}
        </div>

        {(typeFilter !== "all" || reasonFilter !== "all") && (
          <button
            onClick={() => {
              setTypeFilter("all");
              setReasonFilter("all");
            }}
            className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
          >
            Bỏ lọc
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500">Đang tải...</div>
      ) : filteredReports.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Người báo cáo
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Loại</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Lý do</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Chi tiết
                </th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Thời gian
                </th>
                <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.reportId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4 text-sm text-slate-700">
                    {r.reporterName || `User #${r.reporterId}`}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 text-xs font-semibold bg-slate-100 rounded">
                      {CONTENT_TYPE_LABEL[r.contentType]} #{r.contentRefId}
                    </span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        REASON_COLOR[r.reason] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {REASON_LABEL[r.reason] || r.reason}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-600 max-w-xs truncate">
                    {r.details || "—"}
                  </td>
                  <td className="p-4 text-sm text-slate-500">
                    {new Date(r.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => openReportDetail(r)}
                      className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90"
                    >
                      Xem
                    </button>
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
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Báo cáo #{selected.reportId}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {CONTENT_TYPE_LABEL[selected.contentType]} #{selected.contentRefId}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XCircle size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                  Người báo cáo
                </div>
                <div className="text-sm font-medium">
                  {selected.reporterName || `User #${selected.reporterId}`}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-1">Lý do</div>
                <span
                  className={`px-3 py-1 text-sm font-semibold rounded inline-block ${
                    REASON_COLOR[selected.reason] || "bg-slate-100"
                  }`}
                >
                  {REASON_LABEL[selected.reason] || selected.reason}
                </span>
              </div>
              {selected.details && (
                <div>
                  <div className="text-xs font-semibold uppercase text-slate-500 mb-1">
                    Mô tả thêm
                  </div>
                  <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    {selected.details}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500 mb-2">
                  Nội dung bị báo cáo
                </div>
                {previewLoading ? (
                  <div className="text-sm text-slate-400">Đang tải...</div>
                ) : contentPreview?.error ? (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                    {contentPreview.error}
                  </div>
                ) : contentPreview?.note ? (
                  <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded">
                    {contentPreview.note}
                  </div>
                ) : contentPreview ? (
                  <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                    <div className="font-semibold text-slate-800">
                      {contentPreview.title || contentPreview.userName || "Untitled"}
                    </div>
                    {contentPreview.body && (
                      <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                        {contentPreview.body.slice(0, 400)}
                        {contentPreview.body.length > 400 && "..."}
                      </div>
                    )}
                    {contentPreview.excerpt && (
                      <div className="text-sm text-slate-600 mt-2">{contentPreview.excerpt}</div>
                    )}
                    {contentPreview.content && (
                      <div className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                        {contentPreview.content.slice(0, 400)}
                        {contentPreview.content.length > 400 && "..."}
                      </div>
                    )}
                    <div className="text-xs text-slate-400 mt-3">
                      Bởi: {contentPreview.authorName || "Unknown"}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button
                onClick={() => resolveOne(selected.reportId, "dismissed")}
                className="flex-1 px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} className="text-emerald-600" />
                Không vi phạm
              </button>
              <button
                onClick={() => deleteContentAndResolveAll(selected)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Xóa nội dung
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const EmptyState: React.FC = () => (
  <div className="bg-white rounded-xl p-16 text-center">
    <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
      <CheckCircle size={32} className="text-emerald-600" />
    </div>
    <h3 className="text-lg font-bold text-slate-800">Không có báo cáo nào đang chờ xử lý</h3>
    <p className="text-sm text-slate-500 mt-1">Tất cả nội dung đều đã được xem xét</p>
  </div>
);

export default Reports;
