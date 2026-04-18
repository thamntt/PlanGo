import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Star, MapPin, ChevronRight, TrendingUp, Calendar, ChevronDown } from 'lucide-react';

type TimeRange = 'week' | 'month' | 'year';

const PopularDestinations: React.FC = () => {
  const { itineraries, destinations } = useData();
  const [timeFilter, setTimeFilter] = useState<TimeRange>('month');

  // Filter itineraries based on time range
  const filteredItineraries = itineraries.filter(trip => {
    const tripDate = new Date(trip.createdAt).getTime();
    const now = new Date().getTime();
    const diffDays = (now - tripDate) / (1000 * 3600 * 24);
    
    if (timeFilter === 'week') return diffDays <= 7;
    if (timeFilter === 'month') return diffDays <= 30;
    if (timeFilter === 'year') return diffDays <= 365;
    return true;
  });

  // Calculate popularity based on filtered itineraries
  const destinationCounts = filteredItineraries.reduce((acc: Record<string, number>, trip) => {
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
    .filter(d => d.selectionCount > 0) // Only show destinations with at least one selection in the period
    .sort((a, b) => b.selectionCount - a.selectionCount)
    .slice(0, 5);

  const filterOptions: { label: string; value: TimeRange }[] = [
    { label: 'Tuần này', value: 'week' },
    { label: 'Tháng này', value: 'month' },
    { label: 'Năm nay', value: 'year' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
            <TrendingUp size={18} />
          </div>
          <h3 className="font-bold text-slate-800">Top điểm đến phổ biến</h3>
        </div>

        <div className="relative group min-w-[140px]">
          <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-primary transition-colors pointer-events-none" size={14} />
          <select 
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeRange)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-700 focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all appearance-none cursor-pointer shadow-sm shadow-slate-100/50 hover:border-slate-300"
          >
            {filterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" size={14} />
        </div>
      </div>
      <div>
        {popularDestinations.length > 0 && popularDestinations.some(d => d.selectionCount > 0) ? (
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
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-primary/20">
                  <span className="text-sm font-black">{dest.selectionCount}</span>
                  <span className="text-[10px] font-bold uppercase">Lượt chọn</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{dest.reviewCount} đánh giá</p>
              </div>
              <ChevronRight size={18} className="text-slate-200 group-hover:text-slate-400 transition-colors ml-2" />
            </div>
          ))
        ) : (
          <div className="p-16 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
              <Calendar size={32} />
            </div>
            <p className="text-slate-400 italic">Không có dữ liệu trong {timeFilter === 'week' ? 'tuần' : timeFilter === 'month' ? 'tháng' : 'năm'} này</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PopularDestinations;
