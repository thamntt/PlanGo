import React, { useState, useEffect, useCallback } from "react";
import { Tags as TagsIcon, Plus, Edit, Trash2, RefreshCw, Hash } from "lucide-react";
import { apiRequest } from "../lib/api";

interface Tag {
  tagId: number;
  name: string;
  slug: string;
  color?: string | null;
  description?: string | null;
  usageCount?: number;
}

const PRESET_COLORS = [
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#A855F7",
  "#EC4899",
  "#8B5CF6",
  "#22C55E",
  "#0891B2",
  "#D97706",
  "#94A3B8",
];

const Tags: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTag, setEditTag] = useState<Tag | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/blog/tags");
      setTags(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error("Failed to fetch tags", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const openCreate = () => {
    setEditTag(null);
    setName("");
    setColor(PRESET_COLORS[0]);
    setDescription("");
    setModalOpen(true);
  };

  const openEdit = (tag: Tag) => {
    setEditTag(tag);
    setName(tag.name);
    setColor(tag.color || PRESET_COLORS[0]);
    setDescription(tag.description || "");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Tên tag không được để trống");
      return;
    }
    setSubmitting(true);
    try {
      if (editTag) {
        await apiRequest("PUT", `/api/blog/tags/${editTag.tagId}`, {
          name: name.trim(),
          color,
          description: description.trim() || null,
        });
      } else {
        await apiRequest("POST", "/api/blog/tags", {
          name: name.trim(),
          color,
          description: description.trim() || null,
        });
      }
      setModalOpen(false);
      await fetchTags();
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không lưu được"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (tag: Tag) => {
    if (
      !window.confirm(
        `Xóa tag "${tag.name}"?\n\nMọi liên kết tới tag này sẽ bị bỏ. Bài viết / câu hỏi không bị xóa.`,
      )
    ) {
      return;
    }
    try {
      await apiRequest("DELETE", `/api/blog/tags/${tag.tagId}`);
      await fetchTags();
    } catch (err: any) {
      alert("Lỗi: " + (err?.message || "Không xóa được"));
    }
  };

  return (
    <main className="flex-1 p-8 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <TagsIcon size={28} className="text-amber-500" />
            Tags cộng đồng
          </h2>
          <p className="text-slate-500 mt-1">{tags.length} tags được sử dụng cho blog + forum</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTags}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            <span className="text-sm font-medium">Tải lại</span>
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
          >
            <Plus size={16} />
            <span className="text-sm font-medium">Tạo tag mới</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center text-slate-500">Đang tải...</div>
      ) : tags.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center">
          <TagsIcon size={48} className="text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-700">Chưa có tag nào</h3>
          <p className="text-sm text-slate-500 mt-1">Tạo tag đầu tiên để dùng cho blog + forum</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Tag</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Slug</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">Mô tả</th>
                <th className="text-left p-4 text-xs font-bold text-slate-600 uppercase">
                  Sử dụng
                </th>
                <th className="text-right p-4 text-xs font-bold text-slate-600 uppercase">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody>
              {tags.map((t) => (
                <tr key={t.tagId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: t.color || "#94A3B8" }}
                      />
                      <span
                        className="px-3 py-1 text-xs font-bold rounded-lg"
                        style={{
                          backgroundColor: (t.color || "#94A3B8") + "20",
                          color: t.color || "#475569",
                        }}
                      >
                        {t.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500 font-mono">{t.slug}</td>
                  <td className="p-4 text-sm text-slate-600 max-w-xs truncate">
                    {t.description || "—"}
                  </td>
                  <td className="p-4 text-sm text-slate-700">
                    <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold">
                      {t.usageCount ?? 0}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(t)}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-semibold hover:bg-slate-50 flex items-center gap-1"
                      >
                        <Edit size={12} />
                        Sửa
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
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

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-800">
                {editTag ? "Sửa tag" : "Tạo tag mới"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-2 block">
                  Tên tag <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="VD: Phượt, Mẹo hay, Review..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-primary"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-2 block">
                  Màu nhãn
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${
                        color === c ? "scale-125 ring-2 ring-offset-2 ring-slate-400" : ""
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Hash size={14} className="text-slate-400" />
                  <span
                    className="px-3 py-1 text-xs font-bold rounded-lg"
                    style={{
                      backgroundColor: color + "20",
                      color: color,
                    }}
                  >
                    {name || "Xem trước"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-600 mb-2 block">
                  Mô tả (không bắt buộc)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mô tả ngắn cho tag..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-primary"
                  rows={3}
                  maxLength={200}
                />
              </div>
            </div>
            <div className="p-6 border-t bg-slate-50 flex gap-3 justify-end">
              <button
                onClick={() => setModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Đang lưu..." : editTag ? "Lưu thay đổi" : "Tạo tag"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Tags;
