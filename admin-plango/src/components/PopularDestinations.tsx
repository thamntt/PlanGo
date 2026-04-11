import React from 'react';
import { useData } from '../contexts/DataContext';
import { Star, MapPin, ChevronRight, TrendingUp } from 'lucide-react';

const PopularDestinations: React.FC = () => {
  const { itineraries, destinations } = useData();

  // Calculate popularity based on number of times exactly that destinationId is used in trips
  const destinationCounts = itineraries.reduce((acc: Record<string, number>, trip) => {
    if (trip.destinationId) {
      acc[trip.destinationId] = (acc[trip.destinationId] || 0) + 1;
    }
    return acc;
  }, {});

  const popularDestinations = [...destinations]
    .map(d => ({
      ...d,
      selectionCount: destinationCounts[d.id] || 0
    }))
    .sort((a, b) => b.selectionCount - a.selectionCount)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
            <TrendingUp size={18} />
          </div>
          <h3 className="font-bold text-slate-800">Top điểm đến phổ biến</h3>
        </div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Theo lượt chọn</p>
      </div>
      <div>
        {popularDestinations.length > 0 ? (
          popularDestinations.map((dest) => (
            <div key={dest.id} className="flex items-center gap-4 py-6 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors px-6 group cursor-pointer">
              <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-sm border border-slate-100">
                <img 
                  src={dest.images?.[0] || 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=200&h=200&fit=crop'} 
                  alt={dest.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-800 tracking-tight group-hover:text-primary transition-colors">{dest.name}</p>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium uppercase">{dest.category}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1 text-[#B45309]">
                    <Star size={12} className="fill-current" />
                    <span className="text-xs font-bold">{dest.rating}</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    <MapPin size={12} />
                    <span className="text-xs">{dest.address ? dest.address.split(',').pop()?.trim() : 'Việt Nam'}</span>
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="text-sm font-black">{dest.selectionCount}</span>
                  <span className="text-[10px] font-bold uppercase">Lượt chọn</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{dest.reviewCount} đánh giá</p>
              </div>
              <ChevronRight size={18} className="text-slate-200 group-hover:text-slate-400 transition-colors ml-2" />
            </div>
          ))
        ) : (
          <div className="p-12 text-center text-slate-400 italic">
            Chưa có đủ dữ liệu thống kê
          </div>
        )}
      </div>
    </div>
  );
};

export default PopularDestinations;
