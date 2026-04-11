import React from 'react';
import { Star, Trash2, CheckCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import type { Review, UserData } from '../lib/types';

const Reviews: React.FC = () => {
  const { reviews, users, destinations, pois, deleteReview } = useData();

  const getTargetInfo = (review: Review) => {
    if (review.poiId) {
      const p = pois.find(x => x.id === review.poiId);
      return { type: 'Địa điểm', name: p?.name || 'Địa điểm không xác định' };
    }
    const d = destinations.find(x => x.id === review.destinationId);
    return { type: 'Điểm đến', name: d?.name || 'Điểm đến không xác định' };
  };

  const getReviewer = (userId: string): UserData | undefined => {
    return users.find(u => u.id === userId);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Xoá đánh giá của ${name}?`)) {
      await deleteReview(id);
    }
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : "0.0";

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Phê duyệt Đánh giá</h2>
        <p className="text-lg text-slate-500 mt-2">Giám sát ý kiến người dùng và kiểm duyệt nội dung về các địa điểm.</p>
      </div>

      <div className="flex justify-between items-center mb-8">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
           <button className="px-6 py-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-lg">Tất cả</button>
           <button className="px-6 py-2 text-slate-500 text-xs font-black uppercase tracking-widest hover:text-slate-900 transition-all">Bị báo lỗi</button>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
            <span>Đánh giá Trung bình:</span>
            <div className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-xl border border-slate-100">
               <span className="text-slate-900 text-lg">{avgRating}</span>
               <div className="flex">
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} fill={s <= parseFloat(avgRating) ? "#EAB308" : "none"} className={s <= parseFloat(avgRating) ? "text-amber-500" : "text-slate-200"} />)}
               </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {reviews.map((review) => {
          const target = getTargetInfo(review);
          const reviewer = getReviewer(review.userId);
          const reviewDate = new Date(review.createdAt).toLocaleDateString();

          return (
          <div key={review.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                {reviewer?.avatar ? 
                  <img src={reviewer.avatar} className="w-14 h-14 rounded-2xl object-cover ring-4 ring-slate-50" alt="" /> :
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xl">{reviewer?.fullName?.[0] || '?'}</div>
                }
                <div>
                  <h4 className="text-base font-black text-slate-800 tracking-tight">{reviewer?.fullName || review.userName || 'Người dùng ẩn danh'}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reviewDate}</p>
                </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl hover:bg-emerald-100 transition-colors" title="Duyệt">
                    <CheckCircle size={20} />
                 </button>
                 <button onClick={() => handleDelete(review.id, reviewer?.fullName || 'Người dùng ẩn danh')} className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors" title="Xoá">
                    <Trash2 size={20} />
                 </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
               <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={16} fill={s <= review.rating ? "#EAB308" : "none"} className={s <= review.rating ? "text-amber-500" : "text-slate-200"} />
                  ))}
               </div>
               <div className="h-1 w-1 bg-slate-200 rounded-full"></div>
               <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded-md">{target.type}</span>
                  <span className="text-sm font-bold text-slate-700">{target.name}</span>
               </div>
            </div>

            <p className="text-slate-600 leading-relaxed font-medium">
               "{review.comment}"
            </p>
          </div>
        )})}
        {reviews.length === 0 && (
           <div className="py-12 text-center text-slate-500 font-medium">Chưa có đánh giá nào được tìm thấy.</div>
        )}
      </div>
    </div>
  );
};

export default Reviews;
