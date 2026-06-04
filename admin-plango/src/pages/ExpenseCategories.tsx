import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Wallet,
  Car,
  Utensils,
  ShoppingBag,
  Map,
  MoreHorizontal,
  RefreshCw,
  X,
  Check,
  PieChart,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import type { ExpenseCategory } from "../lib/types";

const IconMap: Record<string, any> = {
  Car: Car,
  Utensils: Utensils,
  ShoppingBag: ShoppingBag,
  Map: Map,
  MoreHorizontal: MoreHorizontal,
};

// Helper to get visual properties based on category name
const getVisuals = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("di chuyển") || n.includes("xe") || n.includes("transport"))
    return { icon: "Car", color: "#3B82F6" };
  if (n.includes("ăn uống") || n.includes("food") || n.includes("restaurant"))
    return { icon: "Utensils", color: "#EF4444" };
  if (n.includes("mua sắm") || n.includes("shopping"))
    return { icon: "ShoppingBag", color: "#10B981" };
  if (n.includes("tham quan") || n.includes("sightseeing") || n.includes("tour"))
    return { icon: "Map", color: "#F59E0B" };
  return { icon: "MoreHorizontal", color: "#64748B" };
};

const ExpenseCategories: React.FC = () => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<{
    expenseTypeId?: number;
    name: string;
    description: string;
  }>({ name: "", description: "" });

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest("GET", "/api/expense-types");
      setCategories(data);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = async (id: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xoá loại chi phí này?")) {
      try {
        await apiRequest("DELETE", `/api/expense-types/${id}`);
        setCategories((prev) => prev.filter((c) => c.expenseTypeId !== id));
      } catch (error) {
        alert("Xoá thất bại!");
      }
    }
  };

  const handleSave = async () => {
    if (!currentCategory.name.trim()) return;

    try {
      if (currentCategory.expenseTypeId) {
        const updated = await apiRequest(
          "PUT",
          `/api/expense-types/${currentCategory.expenseTypeId}`,
          currentCategory,
        );
        setCategories((prev) =>
          prev.map((c) => (c.expenseTypeId === updated.expenseTypeId ? updated : c)),
        );
      } else {
        const created = await apiRequest("POST", "/api/expense-types", currentCategory);
        setCategories((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
      setCurrentCategory({ name: "", description: "" });
    } catch (error) {
      alert("Lưu thất bại!");
    }
  };

  const openEditModal = (category: ExpenseCategory) => {
    setCurrentCategory({
      expenseTypeId: category.expenseTypeId,
      name: category.name,
      description: category.description || "",
    });
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setCurrentCategory({ name: "", description: "" });
    setIsModalOpen(true);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC] min-h-screen">
      {/* Header Section */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">
            Quản lý Loại chi phí
          </h2>
          <p className="text-lg text-slate-500 mt-2">
            Phân loại các khoản chi tiêu trong chuyến đi (từ bảng expensetype).
          </p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={fetchCategories}
            className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-primary transition-all"
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
          <div className="bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
            <PieChart size={20} className="text-primary" />
            <span className="text-sm font-bold text-slate-800">{categories.length} danh mục</span>
          </div>
          <button
            onClick={openAddModal}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 group"
          >
            <Plus size={20} />
            Thêm loại mới
          </button>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex justify-between items-center mb-10">
        <div className="relative w-full max-w-md group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Tìm kiếm danh mục chi phí..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-[2rem] shadow-sm text-slate-700 font-bold focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-[250px] bg-white rounded-[3rem] animate-pulse border border-slate-100"
            ></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredCategories.map((category) => {
            const visuals = getVisuals(category.name);
            const Icon = IconMap[visuals.icon] || Wallet;
            return (
              <div
                key={category.expenseTypeId}
                className="group bg-white rounded-2xl p-0.5 border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 relative overflow-hidden"
              >
                <div className="p-5 relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-xl rotate-3 group-hover:rotate-12 transition-transform duration-500 scale-100 group-hover:scale-110"
                      style={{
                        backgroundColor: visuals.color,
                        boxShadow: `0 10px 20px ${visuals.color}33`,
                      }}
                    >
                      <Icon size={24} strokeWidth={2.5} />
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button
                        onClick={() => openEditModal(category)}
                        className="p-2 bg-slate-50 text-slate-300 hover:text-primary hover:bg-primary/5 rounded-xl transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(category.expenseTypeId)}
                        className="p-2 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-xl font-black text-slate-800 mb-1 group-hover:text-primary transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium line-clamp-1 min-h-[1rem]">
                      {category.description || "Không có mô tả cho danh mục này."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        ID: #{category.expenseTypeId}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="absolute top-0 right-0 w-20 h-20 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity"
                  style={{ color: visuals.color }}
                >
                  <Icon size={80} className="translate-x-6 -translate-y-6" />
                </div>
              </div>
            );
          })}
          {filteredCategories.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <p className="text-slate-500 font-bold text-xl">Không tìm thấy loại chi phí nào.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="text-3xl font-black">
                {currentCategory.expenseTypeId ? "Chỉnh sửa loại chi phí" : "Thêm loại chi phí mới"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Tên loại chi phí
                </label>
                <input
                  type="text"
                  value={currentCategory.name}
                  onChange={(e) =>
                    setCurrentCategory((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="VD: Khách sạn, Vé máy bay..."
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-xl font-bold focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Mô tả chi tiết
                </label>
                <textarea
                  value={currentCategory.description}
                  onChange={(e) =>
                    setCurrentCategory((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Nhập mô tả cho loại chi phí này..."
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-lg font-medium focus:border-primary transition-all min-h-[150px]"
                />
              </div>
            </div>
            <div className="p-10 pt-0 flex gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-5 rounded-[2rem] text-lg font-black text-slate-400 hover:bg-slate-50 transition-all"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleSave}
                disabled={!currentCategory.name.trim()}
                className="flex-[2] bg-primary text-white py-5 rounded-[2rem] text-lg font-black hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-30"
              >
                <Check size={24} className="inline mr-2" /> LƯU LẠI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer */}
      <div className="mt-32 pb-10 flex flex-col items-center">
        <p className="text-[10px] text-slate-300 font-bold tracking-[0.6em] uppercase text-center">
          Plango Enterprise Financial Module
        </p>
      </div>
    </div>
  );
};

export default ExpenseCategories;
