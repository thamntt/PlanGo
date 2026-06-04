import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Tags,
  Compass,
  Palmtree,
  Mountain,
  Hotel,
  Landmark,
  RefreshCw,
  X,
  Check,
  MapPin,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import type { DestinationType } from "../lib/types";

const IconMap: Record<string, any> = {
  Compass: Compass,
  Palmtree: Palmtree,
  Mountain: Mountain,
  Hotel: Hotel,
  Landmark: Landmark,
  MapPin: MapPin,
};

// Helper to get visual properties based on type name
const getVisuals = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("thành phố") || n.includes("city")) return { icon: "Compass", color: "#6366F1" };
  if (n.includes("biển") || n.includes("island") || n.includes("beach"))
    return { icon: "Palmtree", color: "#06B6D4" };
  if (n.includes("núi") || n.includes("mountain") || n.includes("highland"))
    return { icon: "Mountain", color: "#10B981" };
  if (n.includes("nghỉ dưỡng") || n.includes("resort") || n.includes("spa"))
    return { icon: "Hotel", color: "#F43F5E" };
  if (n.includes("di tích") || n.includes("historical") || n.includes("culture"))
    return { icon: "Landmark", color: "#F59E0B" };
  return { icon: "MapPin", color: "#94A3B8" };
};

const DestinationTypes: React.FC = () => {
  const [types, setTypes] = useState<DestinationType[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentType, setCurrentType] = useState<{
    destinationtypeId?: number;
    typeName: string;
    description: string;
  }>({ typeName: "", description: "" });

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest("GET", "/api/destination-types");
      setTypes(data);
    } catch (error) {
      console.error("Failed to fetch destination types:", error);
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
        "Bạn có chắc chắn muốn xoá danh mục điểm đến này? Thao tác này sẽ xóa vĩnh viễn.",
      )
    ) {
      try {
        await apiRequest("DELETE", `/api/destination-types/${id}`);
        setTypes((prev) => prev.filter((t) => t.destinationtypeId !== id));
      } catch (error) {
        alert("Xoá thất bại! Có thể danh mục này đang được sử dụng bởi các điểm đến khác.");
      }
    }
  };

  const handleSave = async () => {
    if (!currentType.typeName.trim()) return;

    try {
      if (currentType.destinationtypeId) {
        const updated = await apiRequest(
          "PUT",
          `/api/destination-types/${currentType.destinationtypeId}`,
          {
            typeName: currentType.typeName,
            description: currentType.description,
          },
        );
        setTypes((prev) =>
          prev.map((t) => (t.destinationtypeId === updated.destinationtypeId ? updated : t)),
        );
      } else {
        const created = await apiRequest("POST", "/api/destination-types", {
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

  const openEditModal = (type: DestinationType) => {
    setCurrentType({
      destinationtypeId: type.destinationtypeId,
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
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
              <Tags size={20} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Danh mục Điểm đến</h2>
          </div>
          <p className="text-base text-slate-500 font-medium italic">
            Phân loại các khu vực du lịch (Thành phố, Biển đảo...)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTypes}
            className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-primary transition-all hover:shadow-md active:scale-95"
            title="Làm mới"
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openAddModal}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/20 group"
          >
            <Plus
              size={20}
              strokeWidth={3}
              className="group-hover:rotate-90 transition-transform duration-300"
            />
            Thêm danh mục
          </button>
        </div>
      </div>

      {/* Control & Search Bar */}
      <div className="mb-8">
        <div className="relative group w-full max-w-md">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-300 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm danh mục..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm text-slate-600 font-bold text-lg placeholder:text-slate-200 focus:ring-4 focus:ring-primary/5 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-5 top-1/2 -translate-y-1/2 p-1.5 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main Grid View */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
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
            const Icon = IconMap[visuals.icon] || MapPin;
            return (
              <div
                key={type.destinationtypeId}
                className="group relative bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Visual Decoration */}
                <div className="absolute -right-4 -top-4 w-20 h-20 bg-slate-50 rounded-full group-hover:scale-125 transition-transform duration-500"></div>
                <div
                  className="absolute -right-1.5 top-3 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500"
                  style={{ color: visuals.color }}
                >
                  <Icon size={80} strokeWidth={1} />
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md rotate-3 group-hover:rotate-0 transition-all duration-500"
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
                        className="p-1.5 bg-slate-50 text-slate-300 hover:text-primary hover:bg-white hover:shadow-sm rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(type.destinationtypeId)}
                        className="p-1.5 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-white hover:shadow-sm rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-base font-black text-slate-800 mb-1 group-hover:text-primary transition-colors leading-tight truncate">
                      {type.typeName}
                    </h3>
                    <p className="text-slate-400 font-medium text-[11px] line-clamp-1 min-h-[1rem]">
                      {type.description || "Chưa có mô tả."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-full">
                      #{type.destinationtypeId}
                    </span>
                    <div className="flex gap-1">
                      <div className="w-4 h-0.5 bg-slate-100 rounded-full group-hover:bg-primary/20 transition-colors"></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {filteredTypes.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-8">
                <Tags size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-3">
                Không tìm thấy danh mục nào
              </h3>
              <p className="text-slate-400 font-bold text-lg mb-10 text-center">
                Dữ liệu loại điểm đến hiện tại đang trống hoặc không khớp với tìm kiếm của bạn.
              </p>
              <button
                onClick={openAddModal}
                className="text-primary font-black py-4 px-10 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 transition-all flex items-center gap-3"
              >
                <Plus size={24} /> Tạo danh mục đầu tiên
              </button>
            </div>
          )}
        </div>
      )}

      {/* Premium Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in slide-in-from-bottom-4 duration-400">
            {/* Modal Header */}
            <div className="p-6 bg-slate-50 flex justify-between items-center border-b border-slate-100">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {currentType.destinationtypeId ? "Cập nhật danh mục" : "Thêm danh mục mới"}
                </h3>
                <p className="text-slate-400 font-bold uppercase text-[8px] tracking-widest mt-0.5">
                  Category Management
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Tên danh mục điểm đến
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">
                    <Tags size={18} />
                  </div>
                  <input
                    type="text"
                    value={currentType.typeName}
                    onChange={(e) =>
                      setCurrentType((prev) => ({ ...prev, typeName: e.target.value }))
                    }
                    placeholder="VD: Thành phố lớn, Vùng biển..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-base font-bold text-slate-800 focus:outline-none focus:border-primary/20 focus:bg-white transition-all placeholder:text-slate-200"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Mô tả chi tiết
                </label>
                <textarea
                  value={currentType.description}
                  onChange={(e) =>
                    setCurrentType((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Nhập mô tả..."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:border-primary/20 focus:bg-white transition-all h-28 placeholder:text-slate-200 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-black text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleSave}
                disabled={!currentType.typeName.trim()}
                className="flex-[1.5] bg-primary text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-30 disabled:scale-100 disabled:shadow-none"
              >
                <Check size={18} strokeWidth={3} /> LƯU DANH MỤC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-40 mb-12 flex flex-col items-center">
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mb-8"></div>
        <p className="text-[11px] text-slate-300 font-bold tracking-[0.8em] uppercase text-center ml-[0.8em]">
          Plango Enterprise System Admin
        </p>
      </div>
    </div>
  );
};

export default DestinationTypes;
