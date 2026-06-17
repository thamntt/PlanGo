import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  ListTree,
  Utensils,
  Coffee,
  Bed,
  ShoppingBag,
  Eye,
  HelpCircle,
  RefreshCw,
  X,
  Check,
  Activity,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import type { PoiType } from "../lib/types";

const IconMap: Record<string, any> = {
  Utensils: Utensils,
  Coffee: Coffee,
  Bed: Bed,
  ShoppingBag: ShoppingBag,
  Eye: Eye,
  HelpCircle: HelpCircle,
};

// Helper to get visual properties based on type name (slug or name)
const getVisuals = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("restaurant") || n.includes("nhà hàng") || n.includes("food"))
    return { icon: "Utensils", color: "#EF4444" };
  if (n.includes("cafe") || n.includes("cà phê") || n.includes("coffee"))
    return { icon: "Coffee", color: "#8B4513" };
  if (n.includes("hotel") || n.includes("khách sạn") || n.includes("stay"))
    return { icon: "Bed", color: "#3B82F6" };
  if (n.includes("shopping") || n.includes("mua sắm") || n.includes("market"))
    return { icon: "ShoppingBag", color: "#10B981" };
  if (n.includes("attraction") || n.includes("tham quan") || n.includes("sight"))
    return { icon: "Eye", color: "#A855F7" };
  return { icon: "HelpCircle", color: "#64748B" };
};

const PoiTypes: React.FC = () => {
  const [types, setTypes] = useState<PoiType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentType, setCurrentType] = useState<{
    poitypeId?: number;
    typeName: string;
    description: string;
  }>({ typeName: "", description: "" });

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest("GET", "/api/poi-types");
      setTypes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch POI types:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const filteredTypes = types.filter((t) =>
    t.typeName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = async (id: number) => {
    if (
      window.confirm(
        "Bạn có chắc chắn muốn xoá loại địa điểm này? Thao tác này sẽ xóa vĩnh viễn và không thể khôi phục.",
      )
    ) {
      try {
        await apiRequest("DELETE", `/api/poi-types/${id}`);
        setTypes((prev) => prev.filter((t) => t.poitypeId !== id));
      } catch (error) {
        alert(
          "Xoá thất bại! Có thể loại địa điểm này đang được sử dụng bởi các dữ liệu khác trong hệ thống.",
        );
      }
    }
  };

  const handleSave = async () => {
    if (!currentType.typeName.trim()) return;

    try {
      if (currentType.poitypeId) {
        const updated = await apiRequest("PUT", `/api/poi-types/${currentType.poitypeId}`, {
          typeName: currentType.typeName,
          description: currentType.description,
        });
        setTypes((prev) => prev.map((t) => (t.poitypeId === updated.poitypeId ? updated : t)));
      } else {
        const created = await apiRequest("POST", "/api/poi-types", {
          typeName: currentType.typeName,
          description: currentType.description,
        });
        setTypes((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
      setCurrentType({ typeName: "", description: "" });
    } catch (error) {
      alert("Lưu thất bại!");
    }
  };

  const openEditModal = (type: PoiType) => {
    setCurrentType({
      poitypeId: type.poitypeId,
      typeName: type.typeName,
      description: type.description || "",
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setCurrentType({ typeName: "", description: "" });
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC] min-h-screen">
      {/* Premium Header */}
      <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg rotate-3">
              <ListTree size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                Loại địa điểm (POI)
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <Activity size={12} className="text-primary animate-pulse" />
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">
                  POI Categories
                </p>
              </div>
            </div>
          </div>
          <p className="text-base text-slate-500 font-medium max-w-xl">
            Phân loại địa điểm du lịch để hỗ trợ gợi ý và lọc dữ liệu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTypes}
            className="w-11 h-11 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 hover:text-primary transition-all hover:shadow-md active:scale-95 group"
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>

          <div className="h-11 bg-white px-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Total
            </span>
            <span className="text-xl font-black text-slate-900">{types.length}</span>
          </div>

          <button
            onClick={openAddModal}
            className="bg-primary text-white h-11 px-6 rounded-xl font-black flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95"
          >
            <Plus size={20} strokeWidth={3} />
            THÊM LOẠI
          </button>
        </div>
      </div>

      {/* Modern Search Field */}
      <div className="mb-10">
        <div className="relative max-w-md group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-300 group-focus-within:text-primary transition-colors duration-300" />
          </div>
          <input
            type="text"
            placeholder="Tìm nhanh loại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-14 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm text-lg font-bold text-slate-700 placeholder:text-slate-200 focus:ring-4 focus:ring-primary/5 transition-all duration-300"
          />
        </div>
      </div>

      {/* Content Layout */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-[180px] bg-white rounded-2xl animate-pulse border border-slate-100 shadow-sm"
            ></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredTypes.map((type) => {
            const visuals = getVisuals(type.typeName);
            const Icon = IconMap[visuals.icon] || HelpCircle;
            return (
              <div key={type.poitypeId} className="group cursor-default">
                <div className="h-full bg-white rounded-2xl p-0.5 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                  <div className="p-5 relative z-10 flex flex-col h-full">
                    <div className="flex justify-between items-start mb-4">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md"
                        style={{
                          backgroundColor: visuals.color,
                          boxShadow: `0 8px 16px ${visuals.color}33`,
                        }}
                      >
                        <Icon size={20} strokeWidth={2.5} />
                      </div>

                      <div className="flex gap-1 opacity-20 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <button
                          onClick={() => openEditModal(type)}
                          className="w-8 h-8 bg-slate-50 text-slate-300 hover:text-primary hover:bg-white rounded-lg flex items-center justify-center transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(type.poitypeId)}
                          className="w-8 h-8 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-white rounded-lg flex items-center justify-center transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h3 className="text-base font-black text-slate-800 mb-1 group-hover:text-primary transition-colors truncate">
                        {type.typeName}
                      </h3>
                      <p className="text-slate-400 font-medium text-[11px] line-clamp-1">
                        {type.description || "Chưa có mô tả chi tiết."}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest">
                        POI Registry
                      </span>
                      <span className="text-[10px] font-black text-slate-300 italic group-hover:text-primary/50 transition-colors">
                        #{type.poitypeId}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Premium Edit/Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-400">
            {/* Header */}
            <div className="p-6 bg-slate-900 text-white relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50"></div>
              <div className="relative z-10 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black mb-0.5">
                    {currentType.poitypeId ? "Chỉnh sửa" : "Tạo mới"}
                  </h3>
                  <p className="text-white/40 font-bold uppercase text-[8px] tracking-widest">
                    POI Type Master Config
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Định danh loại địa điểm
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-200">
                    <ListTree size={18} />
                  </div>
                  <input
                    type="text"
                    value={currentType.typeName}
                    onChange={(e) =>
                      setCurrentType((prev) => ({ ...prev, typeName: e.target.value }))
                    }
                    placeholder="VD: attraction, restaurant..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-base font-black text-slate-800 focus:outline-none focus:border-primary/10 focus:bg-white transition-all placeholder:text-slate-200 shadow-sm"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Mô tả nội bộ
                </label>
                <textarea
                  value={currentType.description}
                  onChange={(e) =>
                    setCurrentType((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Mô tả..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:border-primary/10 focus:bg-white transition-all h-24 duration-200 resize-none placeholder:text-slate-200 shadow-sm"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-slate-400 hover:text-slate-900 transition-all"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleSave}
                disabled={!currentType.typeName.trim()}
                className="flex-[1.5] bg-primary text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-20 disabled:scale-100 disabled:shadow-none"
              >
                <Check size={18} strokeWidth={3} /> LƯU THAY ĐỔI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Branding */}
      <div className="mt-32 pb-16 flex flex-col items-center">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
            <Activity size={16} />
          </div>
          <div className="h-[1px] w-40 bg-slate-100"></div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 rotate-45">
            <ListTree size={16} />
          </div>
        </div>
        <p className="text-[11px] text-slate-300 font-bold tracking-[1em] uppercase text-center ml-[1em]">
          Plango Global Core Engine
        </p>
      </div>
    </div>
  );
};

export default PoiTypes;
