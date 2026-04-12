import React, { useState } from 'react';
import { Landmark, Utensils, Coffee, Hotel, ShoppingBag, Star, MapPin, Search, Plus, X, Edit, Trash2 } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { POI } from '../lib/types';
import { searchPlaces, getPlaceDetails, getPhotoUrl, mapGoogleTypeToPOIType } from '../lib/places';
import type { PlaceSearchResult } from '../lib/places';

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const t = type.toLowerCase();
  let style = 'bg-slate-100 text-slate-700';
  let icon = <MapPin size={12} />;
  let label = type;

  if (t === 'attraction') { style = 'bg-indigo-100 text-indigo-700'; icon = <Landmark size={12} />; label = 'Tham quan'; }
  else if (t === 'restaurant') { style = 'bg-rose-100 text-rose-700'; icon = <Utensils size={12} />; label = 'Nhà hàng'; }
  else if (t === 'cafe') { style = 'bg-orange-100 text-orange-700'; icon = <Coffee size={12} />; label = 'Cà phê'; }
  else if (t === 'hotel') { style = 'bg-emerald-100 text-emerald-700'; icon = <Hotel size={12} />; label = 'Khách sạn'; }
  else if (t === 'shopping') { style = 'bg-fuchsia-100 text-fuchsia-700'; icon = <ShoppingBag size={12} />; label = 'Mua sắm'; }
  else if (t === 'other') { label = 'Khác'; }

  return (
    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${style}`}>
      {icon}
      {label}
    </span>
  );
};

const POIs: React.FC = () => {
  const { pois, destinations, addPOI, updatePOI, deletePOI } = useData();
  const [filterDest, setFilterDest] = useState("all");
  const [poiSearch, setPoiSearch] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [poiName, setPoiName] = useState("");
  const [poiType, setPoiType] = useState<POI["type"]>("attraction");
  const [poiDestId, setPoiDestId] = useState("");
  const [poiAddr, setPoiAddr] = useState("");
  const [poiLat, setPoiLat] = useState("");
  const [poiLng, setPoiLng] = useState("");
  const [poiRating, setPoiRating] = useState("");
  const [poiReviewCount, setPoiReviewCount] = useState("");
  const [poiCost, setPoiCost] = useState("");
  const [poiDesc, setPoiDesc] = useState("");
  const [poiOpenHours, setPoiOpenHours] = useState("");
  const [poiGoogleId, setPoiGoogleId] = useState("");
  const [poiPhotos, setPoiPhotos] = useState<{name:string, attributions:string[]}[]>([]);

  // Google Search State
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filters
  const filteredPOIs = pois.filter(p => {
    const matchName = p.name.toLowerCase().includes(poiSearch.toLowerCase());
    const matchDest = filterDest === "all" || p.destinationId === filterDest;
    return matchName && matchDest;
  });

  const getDestName = (id: string) => destinations.find(d => d.id === id)?.name || "Không xác định";

  const handleGoogleSearch = async () => {
    if (!googleQuery.trim()) return;
    setIsSearching(true);
    const results = await searchPlaces(googleQuery);
    setGoogleResults(results);
    setIsSearching(false);
  };

  const selectGooglePlace = async (place: PlaceSearchResult) => {
    setPoiName(place.name);
    setPoiAddr(place.address);
    setPoiLat(place.latitude.toString());
    setPoiLng(place.longitude.toString());
    setPoiRating(place.rating.toString());
    setPoiReviewCount(place.reviewCount.toString());
    setPoiType(mapGoogleTypeToPOIType(place.types, place.primaryType));
    setPoiGoogleId(place.placeId);
    setPoiPhotos(place.photos || []);
    
    const details = await getPlaceDetails(place.placeId);
    if (details) {
      if (details.rating > 0) setPoiRating(details.rating.toString());
      if (details.reviewCount > 0) setPoiReviewCount(details.reviewCount.toString());
      if (details.editorialSummary) setPoiDesc(details.editorialSummary);
      if (details.openingHours?.length) setPoiOpenHours(details.openingHours.join(" | "));
      if (details.photos?.length) setPoiPhotos(details.photos);
    }
    
    setGoogleResults([]);
    setGoogleQuery("");
  };

  const openAddModal = () => {
    setEditingId(null);
    setPoiName(""); setPoiAddr(""); setPoiType("attraction"); 
    setPoiDestId(destinations.length > 0 ? destinations[0].id : "");
    setPoiLat(""); setPoiLng(""); setPoiRating(""); setPoiReviewCount("");
    setPoiCost(""); setPoiDesc(""); setPoiOpenHours("");
    setPoiGoogleId(""); setPoiPhotos([]); setGoogleQuery(""); setGoogleResults([]);
    setIsModalOpen(true);
  };

  const openEditModal = (poi: POI) => {
    setEditingId(poi.id);
    setPoiName(poi.name);
    setPoiAddr(poi.address);
    setPoiType(poi.type);
    setPoiDestId(poi.destinationId || "");
    setPoiLat(poi.latitude?.toString() || "");
    setPoiLng(poi.longitude?.toString() || "");
    setPoiRating(poi.rating?.toString() || "");
    setPoiReviewCount(poi.reviewCount?.toString() || "");
    setPoiCost(poi.estimatedCost?.toString() || "");
    setPoiDesc(poi.description || "");
    setPoiOpenHours(poi.openHours || "");
    setPoiGoogleId(poi.googlePlaceId || "");
    setPoiPhotos(poi.googlePhotos || []);
    setGoogleQuery(""); setGoogleResults([]);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!poiName.trim()) return;

    const data: Omit<POI, "id"> = {
      destinationId: poiDestId,
      name: poiName.trim(),
      type: poiType,
      address: poiAddr.trim(),
      latitude: parseFloat(poiLat) || 0,
      longitude: parseFloat(poiLng) || 0,
      rating: parseFloat(poiRating) || 0,
      reviewCount: parseInt(poiReviewCount) || 0,
      openHours: poiOpenHours || undefined,
      estimatedCost: parseInt(poiCost) || undefined,
      description: poiDesc || undefined,
      images: poiPhotos.length > 0 ? poiPhotos.slice(0, 3).map(p => getPhotoUrl(p.name)) : ["https://images.unsplash.com/photo-1599708153386-62dc3942360b?w=800"],
      googlePlaceId: poiGoogleId || undefined,
      googlePhotos: poiPhotos.length > 0 ? poiPhotos : undefined,
      isActive: true,
    };

    if (editingId) {
      await updatePOI(editingId, data);
    } else {
      await addPOI(data);
    }
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá địa điểm ${name}?`)) {
      await deletePOI(id);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-white/50 relative">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Địa điểm tham quan</h2>
        <p className="text-lg text-slate-500 mt-2">Quản lý các hoạt động trải nghiệm, danh lam thắng cảnh và địa điểm địa phương.</p>
      </div>

      <div className="flex flex-col xl:flex-row justify-end items-center gap-4 mb-10">

        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-hidden">
          <div className="relative flex-1 xl:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
               type="text" 
               placeholder="Tìm theo tên..." 
               value={poiSearch}
               onChange={e => setPoiSearch(e.target.value)}
               className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20" 
            />
          </div>
          <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl flex items-center gap-2 group focus-within:ring-2 focus-within:ring-primary/20 transition-all shrink-0">
             <MapPin size={16} className="text-slate-400 group-focus-within:text-primary" />
             <select 
               value={filterDest} 
               onChange={e => setFilterDest(e.target.value)}
               className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer max-w-[120px] truncate"
             >
                 <option value="all">Tất cả Thành phố</option>
                 {destinations.map(d => (
                   <option key={d.id} value={d.id}>{d.name}</option>
                 ))}
             </select>
          </div>
          <button onClick={openAddModal} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center gap-2 shrink-0">
              <Plus size={16} />
              Tạo POI mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/50 text-left">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[40%]">Thông tin Địa điểm</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center w-[15%]">Loại hình</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[15%]">Đánh giá</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] w-[15%] text-center">Chi phí</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right w-[15%]">Thiết lập</th>
              </tr>
            </thead>
            <tbody>
              {filteredPOIs.map((poi) => (
                <tr key={poi.id} className="border-t border-slate-50 hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                        <span className="text-base font-black text-slate-800">{poi.name}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{getDestName(poi.destinationId)}</span>
                      </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex justify-center">
                      <TypeBadge type={poi.type} />
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star key={star} size={12} fill={star <= Math.round(poi.rating) ? "#EAB308" : "none"} className={star <= Math.round(poi.rating) ? "text-amber-500" : "text-slate-200"} />
                          ))}
                       </div>
                       <span className="text-sm font-black text-slate-700">{poi.rating?.toFixed(1) || "0.0"}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-sm font-black text-slate-500 italic">
                    {poi.estimatedCost ? `${poi.estimatedCost.toLocaleString()} VND` : '-'}
                  </td>
                  <td className="px-8 py-6 text-right">
                     <div className="flex items-center justify-end gap-2 transition-opacity">
                       <button onClick={() => openEditModal(poi)} className="p-3 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-2xl transition-all" title="Chỉnh sửa">
                         <Edit size={18} />
                       </button>
                       <button onClick={() => handleDelete(poi.id, poi.name)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="Xoá địa điểm">
                         <Trash2 size={18} />
                       </button>
                     </div>
                  </td>
                </tr>
              ))}
              {filteredPOIs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-10 text-center text-slate-500 text-sm">Không tìm thấy địa điểm nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                {editingId ? "Chỉnh sửa địa điểm" : "Thêm địa điểm mới"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-50 text-slate-400 hover:text-slate-700 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              
              {/* Google Search Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tìm kiếm từ Google Places</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={googleQuery}
                    onChange={e => setGoogleQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleGoogleSearch()}
                    placeholder="Nhập tên địa điểm..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <button 
                    onClick={handleGoogleSearch}
                    disabled={isSearching}
                    className="px-6 py-3 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    {isSearching ? '...' : 'Tìm kiếm'}
                  </button>
                </div>
                {googleResults.length > 0 && (
                  <div className="mt-2 bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto shadow-sm">
                    {googleResults.map(p => (
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
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tên địa điểm</label>
                  <input type="text" value={poiName} onChange={e => setPoiName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Địa chỉ</label>
                  <input type="text" value={poiAddr} onChange={e => setPoiAddr(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Điểm đến trực thuộc</label>
                  <select value={poiDestId} onChange={e => setPoiDestId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                    <option value="" disabled>Chọn điểm đến</option>
                    {destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Loại hình</label>
                  <select value={poiType} onChange={e => setPoiType(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                    <option value="attraction">Tham quan</option>
                    <option value="restaurant">Nhà hàng</option>
                    <option value="cafe">Cà phê</option>
                    <option value="hotel">Khách sạn</option>
                    <option value="shopping">Mua sắm</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vĩ độ (Lat)</label>
                    <input type="text" value={poiLat} onChange={e => setPoiLat(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Kinh độ (Lng)</label>
                    <input type="text" value={poiLng} onChange={e => setPoiLng(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Chi phí (VND)</label>
                    <input type="text" value={poiCost} onChange={e => setPoiCost(e.target.value)} placeholder="0" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Giờ mở cửa</label>
                    <input 
                      type="text" 
                      value={poiOpenHours} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        let formatted = val;
                        if (val.length >= 7) {
                          formatted = `${val.slice(0, 2)}:${val.slice(2, 4)} - ${val.slice(4, 6)}:${val.slice(6, 8)}`;
                        } else if (val.length >= 5) {
                          formatted = `${val.slice(0, 2)}:${val.slice(2, 4)} - ${val.slice(4)}`;
                        } else if (val.length >= 3) {
                          formatted = `${val.slice(0, 2)}:${val.slice(2)}`;
                        }
                        setPoiOpenHours(formatted);
                      }} 
                      placeholder="08:00 - 22:00" 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mô tả chi tiết</label>
                  <textarea rows={3} value={poiDesc} onChange={e => setPoiDesc(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
                </div>
                

              </div>
            </div>

            <div className="p-8 border-t border-slate-100 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors">
                Hủy
              </button>
              <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white font-bold text-sm rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all">
                Lưu địa điểm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default POIs;
