import React, { useState, useRef } from "react";
import { MapPin, Star, Filter, Search, Plus, X, Edit, Trash2, ChevronDown } from "lucide-react";
import { useData } from "../contexts/DataContext";
import type { Destination } from "../lib/types";
import { searchPlaces, getPlaceDetails, getPhotoUrl } from "../lib/places";
import type { PlaceSearchResult } from "../lib/places";

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const styles: Record<string, string> = {
    "Thành phố": "bg-blue-100 text-blue-700",
    "Biển đảo": "bg-emerald-100 text-emerald-700",
    "Núi non": "bg-amber-100 text-amber-700",
    "Nghỉ dưỡng": "bg-purple-100 text-purple-700",
    "Nông thôn": "bg-orange-100 text-orange-700",
    "Di tích": "bg-rose-100 text-rose-700",
  };
  const bgClass = styles[category] || "bg-slate-100 text-slate-700";
  return <span className={`px-3 py-1 rounded-lg text-xs font-bold ${bgClass}`}>{category}</span>;
};

const Destinations: React.FC = () => {
  const { destinations, destinationTypes, addDestination, updateDestination, deleteDestination } =
    useData();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCat, setFilterCat] = useState("All");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form State
  const [destName, setDestName] = useState("");
  const [destCat, setDestCat] = useState("City");
  const [destAddr, setDestAddr] = useState("");
  const [destLat, setDestLat] = useState("");
  const [destLng, setDestLng] = useState("");
  const [destDesc, setDestDesc] = useState("");
  const [destGoogleId, setDestGoogleId] = useState("");
  const [destPhotos, setDestPhotos] = useState<{ name: string; attributions: string[] }[]>([]);

  // Cloudinary State & Ref — admin now persists ALL uploaded images, not just
  // one (user-side renders all images[] in the destination cover carousel, so
  // dropping any when admin saves silently breaks the cover gallery).
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Search State
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const categories: any[] =
    destinationTypes.length > 0
      ? destinationTypes.map((t) => ({ value: t.name, label: t.name, id: t.id }))
      : [
          { value: "Thành phố", label: "Thành phố" },
          { value: "Biển đảo", label: "Biển đảo" },
          { value: "Núi non", label: "Núi non" },
          { value: "Nghỉ dưỡng", label: "Nghỉ dưỡng" },
          { value: "Nông thôn", label: "Nông thôn" },
          { value: "Di tích", label: "Di tích" },
          { value: "Khác", label: "Khác" },
        ];

  const filteredDestinations = destinations.filter((d) => {
    const matchName = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = filterCat === "All" || d.category === filterCat;
    return matchName && matchCat;
  });

  const handleGoogleSearch = async () => {
    if (!googleQuery.trim()) return;
    setIsSearching(true);
    const results = await searchPlaces(googleQuery);
    setGoogleResults(results);
    setIsSearching(false);
  };

  const extractDescription = (raw: unknown): string => {
    if (!raw) return "";
    if (typeof raw === "string") return raw;
    if (typeof raw === "object" && raw !== null) {
      const obj = raw as Record<string, unknown>;
      if (typeof obj.text === "string") return obj.text;
      if (typeof obj.overview === "string") return obj.overview;
    }
    return "";
  };

  const selectGooglePlace = async (place: PlaceSearchResult) => {
    setDestName(place.name);
    setDestAddr(place.address);
    setDestLat(place.latitude.toString());
    setDestLng(place.longitude.toString());
    setDestDesc(extractDescription(place.editorialSummary));
    setDestGoogleId(place.placeId);
    setDestPhotos(place.photos || []);

    // Attempt to get more details
    const details = await getPlaceDetails(place.placeId);
    if (details) {
      const desc = extractDescription(details.editorialSummary);
      if (desc) setDestDesc(desc);
      if (details.photos?.length) setDestPhotos(details.photos);
    }

    setGoogleResults([]);
    setGoogleQuery("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "ml_default");

    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dosvjilvv/image/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("Chi tiết lỗi từ Cloudinary:", data);
        alert(`Lỗi Cloudinary: ${data.error?.message || "Không rõ nguyên nhân"}`);
        setIsUploading(false);
        return;
      }

      if (data.secure_url) {
        setUploadedImages((prev) => [...prev, data.secure_url]);
      }
    } catch (error) {
      console.error("Lỗi mạng/Code:", error);
      alert("Đã xảy ra lỗi khi kết nối tới Cloudinary!");
    } finally {
      setIsUploading(false);
    }
  };

  const removeUploadedImage = (idx: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeGooglePhoto = (idx: number) => {
    setDestPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAllImages = () => {
    setUploadedImages([]);
    setDestPhotos([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    setDestName("");
    setDestCat(categories[0]?.value || "");
    setDestAddr("");
    setDestLat("");
    setDestLng("");
    setDestDesc("");
    setDestGoogleId("");
    setDestPhotos([]);
    setGoogleQuery("");
    setGoogleResults([]);
    setUploadedImages([]);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (dest: Destination) => {
    setEditingId(dest.id);
    setDestName(dest.name);
    setDestCat(dest.category);
    setDestAddr(dest.address);
    setDestLat(dest.latitude?.toString() || "");
    setDestLng(dest.longitude?.toString() || "");
    setDestDesc(dest.description || "");
    setDestGoogleId(dest.googlePlaceId || "");
    setDestPhotos(dest.googlePhotos || []);
    // Load ALL uploaded images. Skip entries that look like Google photo
    // names (those rebuild from getPhotoUrl(destPhotos[i].name)).
    const googlePhotoNames = new Set(
      (dest.googlePhotos || []).map((p) => p.name).filter(Boolean),
    );
    setUploadedImages(
      (dest.images || []).filter(
        (img) => typeof img === "string" && img && !googlePhotoNames.has(img),
      ),
    );
    setGoogleQuery("");
    setGoogleResults([]);
    setErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!destName.trim()) newErrors.name = "Vui lòng nhập tên điểm đến";
    if (!destAddr.trim()) newErrors.address = "Vui lòng nhập địa chỉ";
    if (!destLat.trim()) newErrors.latitude = "Vui lòng nhập vĩ độ";
    if (!destLng.trim()) newErrors.longitude = "Vui lòng nhập kinh độ";
    if (uploadedImages.length === 0 && destPhotos.length === 0)
      newErrors.image = "Vui lòng tải ảnh lên hoặc chọn từ Google";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const lat = parseFloat(destLat) || 0;
    const lng = parseFloat(destLng) || 0;

    const data = {
      name: destName,
      destinationTypeId: categories.find((c) => c.value === destCat)?.id,
      category: destCat, // Fallback for backend that handles string naming
      address: destAddr,
      latitude: lat,
      longitude: lng,
      description: typeof destDesc === "string" && destDesc.trim() ? destDesc.trim() : undefined,
      googlePlaceId: destGoogleId || undefined,
      googlePhotos: destPhotos.length > 0 ? destPhotos : undefined,
      // Persist ALL images — user-side renders the full array as a carousel,
      // so any drop here would silently shrink the gallery.
      images: (() => {
        const combined: string[] = [
          ...uploadedImages,
          ...destPhotos.map((p) => p.name).filter(Boolean),
        ];
        if (combined.length > 0) return combined;
        return ["https://images.unsplash.com/photo-1528127269322-539801943592?w=800"];
      })(),
      tags: [],
    };

    if (editingId) {
      await updateDestination(editingId, data);
    } else {
      await addDestination(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá điểm đến ${name}?`)) {
      await deleteDestination(id);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-[#F8FAFC]">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight">Điểm đến</h2>
          <p className="text-lg text-slate-500 mt-2">
            Quản lý các điểm đến du lịch toàn cầu và địa phương.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
        >
          <Plus size={18} />
          Thêm điểm đến
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row justify-end items-center gap-4 mb-8">
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm địa điểm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="relative shrink-0">
            <Filter
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              size={16}
            />
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 shadow-sm"
            >
              <option value="All">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.value} value={cat.value || cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto mb-8">
        <table className="w-full min-w-[1000px] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/30 text-left">
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[30%]">
                Điểm đến
              </th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[15%]">
                Danh mục
              </th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-[30%]">
                Địa chỉ
              </th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center w-[15%]">
                Đánh giá
              </th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right w-[10%]">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDestinations.map((dest) => (
              <tr
                key={dest.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group"
              >
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <div className="relative w-14 h-14 shrink-0">
                      <img
                        src={dest.images?.[0] || "https://via.placeholder.com/100"}
                        className="w-14 h-14 rounded-2xl object-cover shadow-sm bg-slate-100"
                        alt=""
                      />
                      {(dest.images?.length || 0) > 1 && (
                        <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                          +{(dest.images?.length || 0) - 1}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{dest.name}</span>
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin size={12} />
                        <span className="text-[10px] font-medium tracking-tight uppercase">
                          {dest.images?.length ? `${dest.images.length} ảnh` : "Chưa có ảnh"}
                        </span>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6">
                  <CategoryBadge category={dest.category} />
                </td>
                <td className="px-8 py-6">
                  <span className="text-xs font-medium text-slate-500">{dest.address}</span>
                </td>
                <td className="px-8 py-6">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star size={14} fill="currentColor" />
                      <span className="text-sm font-black">{dest.rating?.toFixed(1) || "0.0"}</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 italic">
                      ({dest.reviewCount || 0} nhận xét)
                    </span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex items-center justify-end gap-2 transition-opacity">
                    <button
                      onClick={() => openEditModal(dest)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(dest.id, dest.name)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Xoá điểm đến"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredDestinations.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-10 text-center text-slate-500 text-sm">
                  Không tìm thấy điểm đến nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {editingId ? "Chỉnh sửa điểm đến" : "Thêm điểm đến mới"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 bg-slate-50 text-slate-400 hover:text-slate-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              {/* Google Search Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Tìm kiếm qua Google Places
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={googleQuery}
                    onChange={(e) => setGoogleQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGoogleSearch()}
                    placeholder="Nhập tên địa điểm..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    onClick={handleGoogleSearch}
                    disabled={isSearching}
                    className="px-6 py-3 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {isSearching ? "..." : "Tìm kiếm"}
                  </button>
                </div>
                {googleResults.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto shadow-sm">
                    {googleResults.map((p) => (
                      <button
                        key={p.placeId}
                        onClick={() => selectGooglePlace(p)}
                        className="w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <div className="text-sm font-bold text-slate-800">{p.name}</div>
                        <div className="text-xs text-slate-500 truncate">{p.address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Tên điểm đến <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={destName}
                    onChange={(e) => {
                      setDestName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: "" });
                    }}
                    className={`w-full bg-slate-50 border ${errors.name ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"} rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                  />
                  {errors.name && (
                    <p className="text-rose-500 text-[10px] mt-1 font-bold">{errors.name}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Địa chỉ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={destAddr}
                    onChange={(e) => {
                      setDestAddr(e.target.value);
                      if (errors.address) setErrors({ ...errors, address: "" });
                    }}
                    className={`w-full bg-slate-50 border ${errors.address ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"} rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                  />
                  {errors.address && (
                    <p className="text-rose-500 text-[10px] mt-1 font-bold">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Danh mục <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={destCat}
                    onChange={(e) => setDestCat(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Vĩ độ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={destLat}
                      onChange={(e) => {
                        setDestLat(e.target.value);
                        if (errors.latitude) setErrors({ ...errors, latitude: "" });
                      }}
                      className={`w-full bg-slate-50 border ${errors.latitude ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"} rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                    />
                    {errors.latitude && (
                      <p className="text-rose-500 text-[10px] mt-1 font-bold">{errors.latitude}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Kinh độ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={destLng}
                      onChange={(e) => {
                        setDestLng(e.target.value);
                        if (errors.longitude) setErrors({ ...errors, longitude: "" });
                      }}
                      className={`w-full bg-slate-50 border ${errors.longitude ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"} rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
                    />
                    {errors.longitude && (
                      <p className="text-rose-500 text-[10px] mt-1 font-bold">{errors.longitude}</p>
                    )}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Mô tả / Tóm tắt
                  </label>
                  <textarea
                    rows={3}
                    value={destDesc}
                    onChange={(e) => setDestDesc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Tải ảnh lên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={(e) => {
                      handleImageUpload(e);
                      if (errors.image) setErrors({ ...errors, image: "" });
                    }}
                    disabled={isUploading}
                    className={`w-full bg-white border ${errors.image ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-200"} rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 transition-all`}
                  />
                  {errors.image && (
                    <p className="text-rose-500 text-[10px] mt-1 font-bold">{errors.image}</p>
                  )}
                  {isUploading && (
                    <p className="text-xs text-amber-500 mt-2 font-medium animate-pulse">
                      ⏳ Đang tải ảnh lên Cloudinary...
                    </p>
                  )}
                </div>

                {(uploadedImages.length > 0 || destPhotos.length > 0) && (
                  <div className="md:col-span-2 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Ảnh xem trước ({uploadedImages.length + destPhotos.length})
                      </label>
                      <button
                        onClick={clearAllImages}
                        type="button"
                        className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors"
                      >
                        Xoá tất cả
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {uploadedImages.map((url, idx) => (
                        <div key={`up-${idx}`} className="relative group">
                          <img
                            src={url}
                            alt={`Ảnh ${idx + 1}`}
                            className="w-full h-28 object-cover rounded-xl shadow-sm border border-slate-100"
                          />
                          <button
                            onClick={() => removeUploadedImage(idx)}
                            type="button"
                            className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-rose-500 text-white rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                            title="Xoá ảnh"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      {destPhotos.map((p, idx) => (
                        <div key={`gp-${idx}`} className="relative group">
                          <img
                            src={getPhotoUrl(p.name)}
                            alt={`Google ${idx + 1}`}
                            className="w-full h-28 object-cover rounded-xl shadow-sm border border-slate-100"
                          />
                          <button
                            onClick={() => removeGooglePhoto(idx)}
                            type="button"
                            className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-rose-500 text-white rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100"
                            title="Xoá ảnh"
                          >
                            <X size={14} />
                          </button>
                          <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-slate-900/60 px-1.5 py-0.5 rounded">
                            Google
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={isUploading}
                className={`px-8 py-3 bg-primary text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 transition-all ${isUploading ? "opacity-50 cursor-not-allowed" : "hover:scale-105"}`}
              >
                {isUploading ? "Đang tải ảnh..." : "Lưu điểm đến"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Destinations;
