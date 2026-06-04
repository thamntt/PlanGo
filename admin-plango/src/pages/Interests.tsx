import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  Trash2,
  Edit2,
  Heart,
  RefreshCw,
  X,
  Check,
  Filter,
  Sparkles,
  Hash,
  // Category-specific icons (mirror mobile app PREF_VISUAL mapping)
  Waves,
  Mountain,
  Building2,
  Drama,
  Utensils,
  Compass,
  Bed,
  Trees,
  Castle,
  ShoppingBag,
  Wine,
  Camera,
  Tent,
  Users,
  Tags,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import type { Interest } from "../lib/types";

const Interests: React.FC = () => {
  const [interests, setInterests] = useState<Interest[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentInterest, setCurrentInterest] = useState<{
    preferenceId?: number;
    preferenceName: string;
  }>({ preferenceName: "" });

  const fetchInterests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest("GET", "/api/preferences");
      setInterests(data);
    } catch (error) {
      console.error("Failed to fetch interests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const filteredInterests = interests.filter((i) =>
    i.preferenceName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDelete = async (id: number) => {
    if (window.confirm("Bạn có chắc chắn muốn xoá sở thích này?")) {
      try {
        await apiRequest("DELETE", `/api/preferences/${id}`);
        setInterests((prev) => prev.filter((i) => i.preferenceId !== id));
      } catch (error) {
        alert("Xoá thất bại!");
      }
    }
  };

  const handleSave = async () => {
    if (!currentInterest.preferenceName.trim()) return;

    try {
      if (currentInterest.preferenceId) {
        const updated = await apiRequest(
          "PUT",
          `/api/preferences/${currentInterest.preferenceId}`,
          {
            preferenceName: currentInterest.preferenceName,
          },
        );
        setInterests((prev) =>
          prev.map((i) => (i.preferenceId === updated.preferenceId ? updated : i)),
        );
      } else {
        const created = await apiRequest("POST", "/api/preferences", {
          preferenceName: currentInterest.preferenceName,
        });
        setInterests((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
      setCurrentInterest({ preferenceName: "" });
    } catch (error) {
      alert("Lưu thất bại!");
    }
  };

  const openEditModal = (interest: Interest) => {
    setCurrentInterest(interest);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setCurrentInterest({ preferenceName: "" });
    setIsModalOpen(true);
  };

  // Category visual mapping — must mirror mobile app PREF_VISUAL so a "Biển"
  // chip on mobile and the "Biển" card here use the same icon + color family.
  const PREF_VISUAL: Record<
    string,
    { Icon: React.ComponentType<{ size?: number; className?: string }>; gradient: string }
  > = {
    Biển: { Icon: Waves, gradient: "from-cyan-400 to-sky-300" },
    Núi: { Icon: Mountain, gradient: "from-emerald-400 to-green-300" },
    "Thành phố": { Icon: Building2, gradient: "from-violet-400 to-purple-300" },
    "Văn hóa": { Icon: Drama, gradient: "from-pink-400 to-rose-300" },
    "Ẩm thực": { Icon: Utensils, gradient: "from-orange-400 to-amber-300" },
    "Phiêu lưu": { Icon: Compass, gradient: "from-red-400 to-orange-400" },
    "Nghỉ dưỡng": { Icon: Bed, gradient: "from-teal-400 to-emerald-300" },
    "Thiên nhiên": { Icon: Trees, gradient: "from-lime-400 to-green-300" },
    "Lịch sử": { Icon: Castle, gradient: "from-amber-500 to-yellow-400" },
    "Mua sắm": { Icon: ShoppingBag, gradient: "from-fuchsia-400 to-purple-300" },
    "Giải trí đêm": { Icon: Wine, gradient: "from-violet-500 to-indigo-400" },
    "Nhiếp ảnh": { Icon: Camera, gradient: "from-rose-400 to-pink-300" },
    "Cắm trại": { Icon: Tent, gradient: "from-green-500 to-emerald-400" },
    "Gia đình": { Icon: Users, gradient: "from-cyan-500 to-blue-400" },
    "Hẹn hò": { Icon: Heart, gradient: "from-pink-400 to-rose-300" },
  };
  const getVisual = (name: string) =>
    PREF_VISUAL[name] ?? { Icon: Tags, gradient: "from-slate-400 to-slate-300" };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC] min-h-screen">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Quản lý Sở thích</h2>
          <p className="text-lg text-slate-500 mt-2">
            Định nghĩa các loại sở thích du lịch để gợi ý cho người dùng.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchInterests}
            className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={20} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={openAddModal}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
            Thêm sở thích
          </button>
        </div>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="relative group w-full md:w-[400px]">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm sở thích theo tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-white border-none rounded-2xl shadow-sm text-slate-600 focus:ring-4 focus:ring-primary/10 transition-all font-medium text-lg placeholder:text-slate-300"
          />
        </div>

        <div className="flex items-center gap-8 bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Tổng cộng
            </span>
            <span className="text-2xl font-black text-slate-800">
              {interests.length} <span className="text-sm font-medium text-slate-400">thẻ</span>
            </span>
          </div>
          <div className="w-[1px] h-10 bg-slate-100"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
              Đang hiển thị
            </span>
            <span className="text-2xl font-black text-primary">{filteredInterests.length}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="h-[200px] bg-white rounded-[2rem] animate-pulse border border-slate-100"
            ></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredInterests.map((interest) => {
            const visual = getVisual(interest.preferenceName);
            const Icon = visual.Icon;
            return (
              <div
                key={interest.preferenceId}
                className="group relative bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                {/* Card Background Decoration — category-specific gradient */}
                <div
                  className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${visual.gradient} opacity-10 rounded-bl-[2rem] group-hover:scale-150 transition-transform duration-500`}
                ></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center text-white shadow-md group-hover:rotate-6 transition-transform`}
                    >
                      <Icon size={20} className="opacity-95" />
                    </div>
                    <span className="text-[9px] font-black text-slate-300 tracking-tighter flex items-center gap-0.5">
                      <Hash size={8} />
                      {interest.preferenceId}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-800 mb-4 group-hover:text-primary transition-colors line-clamp-1">
                    {interest.preferenceName}
                  </h3>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Preference
                    </span>
                    <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                      <button
                        onClick={() => openEditModal(interest)}
                        className="p-1.5 bg-slate-50 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(interest.preferenceId)}
                        className="p-1.5 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty State Card */}
          {filteredInterests.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
                <Search size={48} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">
                Không tìm thấy sở thích nào
              </h3>
              <p className="text-slate-400 font-medium">
                Hãy thử tìm kiếm với từ khóa khác hoặc thêm mới.
              </p>
              <button
                onClick={openAddModal}
                className="mt-8 text-primary font-black flex items-center gap-2 hover:gap-4 transition-all"
              >
                <Plus size={20} /> Tạo sở thích đầu tiên
              </button>
            </div>
          )}
        </div>
      )}

      {/* Advanced Premium Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Modal Header — gradient by current preference name (live preview) */}
            {(() => {
              const headerVisual = getVisual(currentInterest.preferenceName);
              const HeaderIcon = headerVisual.Icon;
              return (
                <div
                  className={`p-10 bg-gradient-to-br ${currentInterest.preferenceName ? headerVisual.gradient : "from-slate-900 to-slate-800"} text-white relative`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                  <div className="relative z-10 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      {currentInterest.preferenceName && (
                        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
                          <HeaderIcon size={28} />
                        </div>
                      )}
                      <div>
                        <h3 className="text-3xl font-black mb-2">
                          {currentInterest.preferenceId ? "Chỉnh sửa" : "Thêm mới"}
                        </h3>
                        <p className="text-white/60 font-medium italic">
                          Thông tin thẻ sở thích du lịch
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
                    >
                      <X size={24} />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Modal Body */}
            <div className="p-10">
              <div className="space-y-8">
                <div className="relative group">
                  <label className="inline-block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">
                    Tên sở thích người dùng
                  </label>
                  <div className="relative">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors">
                      {(() => {
                        const InputIcon = currentInterest.preferenceName
                          ? getVisual(currentInterest.preferenceName).Icon
                          : Tags;
                        return <InputIcon size={24} />;
                      })()}
                    </div>
                    <input
                      type="text"
                      value={currentInterest.preferenceName}
                      onChange={(e) =>
                        setCurrentInterest((prev) => ({ ...prev, preferenceName: e.target.value }))
                      }
                      placeholder="VD: Cắm trại, Thám hiểm rừng..."
                      className="w-full pl-16 pr-8 py-6 bg-slate-50 border-2 border-transparent rounded-[2rem] text-xl font-bold text-slate-800 focus:outline-none focus:border-primary focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all placeholder:text-slate-200"
                      autoFocus
                    />
                  </div>
                  <p className="mt-4 text-xs text-slate-400 font-medium px-2">
                    Gợi ý: Hãy đặt tên ngắn gọn và súc tích để hiển thị đẹp trên ứng dụng di động.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-10 pt-0 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-5 rounded-[2rem] text-lg font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all border-2 border-transparent hover:border-slate-100"
              >
                HỦY BỎ
              </button>
              <button
                onClick={handleSave}
                disabled={!currentInterest.preferenceName.trim()}
                className="flex-[2] bg-primary text-white py-5 rounded-[2rem] text-lg font-black flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 shadow-2xl shadow-primary/30 group"
              >
                <Check size={24} className="group-hover:scale-125 transition-transform" />
                XÁC NHẬN LƯU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Decoration */}
      <div className="mt-20 mb-10 text-center">
        <div className="flex items-center justify-center gap-4 mb-4 opacity-20">
          <div className="h-[1px] w-20 bg-slate-400"></div>
          <Heart size={16} className="text-slate-400" />
          <div className="h-[1px] w-20 bg-slate-400"></div>
        </div>
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.4em] uppercase">
          Plango Premium Admin Dashboard
        </p>
      </div>
    </div>
  );
};

export default Interests;
