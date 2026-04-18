import React, { useState } from 'react';
import { Plane, Calendar, DollarSign, Search, Filter } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { formatVND } from '../lib/types';

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    cancelled: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  const labelMap: Record<string, string> = {
    draft: 'Nháp',
    active: 'Đang chạy',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };
  const bgClass = styles[status] || styles.draft;
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${bgClass}`}>
      {labelMap[status] || status}
    </span>
  );
};

const Trips: React.FC = () => {
  const { itineraries, users } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'completed' | 'cancelled'>('all');

  const getOwner = (userId: string) => {
    return users.find(u => u.id === userId);
  };

  const filteredTrips = itineraries.filter(trip => {
    const matchesSearch = trip.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || trip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50/50">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
            Quản lý Chuyến đi
            <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              {filteredTrips.length} / {itineraries.length}
            </span>
          </h2>
          <p className="text-lg text-slate-500 mt-2">Giám sát các hành trình do người dùng tạo và trạng thái du lịch.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Tìm tên chuyến đi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all w-64 shadow-sm"
            />
          </div>

          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all appearance-none shadow-sm cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="draft">Bản nháp</option>
              <option value="active">Đang diễn ra</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Hành trình Chuyến đi</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Người sở hữu</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tài chính</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrips.map((trip) => {
                const owner = getOwner(trip.userId);
                return (
                <tr key={trip.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-all group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary shrink-0">
                        <Plane size={24} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-slate-800 truncate">{trip.title}</span>
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Calendar size={12} />
                          <span className="text-xs font-bold truncate">{trip.startDate} - {trip.endDate}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                     <div className="flex items-center gap-3">
                        {owner?.avatar ? 
                          <img src={owner.avatar} className="w-8 h-8 rounded-full border border-slate-200" alt="" /> :
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">{owner?.fullName?.[0] || '?'}</div>
                        }
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-700 truncate">{owner?.fullName || 'Không tên'}</span>
                          <span className="text-[10px] text-slate-400 font-medium">Người tạo</span>
                        </div>
                     </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                          <DollarSign size={14} />
                       </div>
                       <span className="text-sm font-black text-slate-700 tracking-tight">{trip.budget ? trip.budget : formatVND(trip.totalBudget || 0)}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <StatusBadge status={trip.status} />
                  </td>
                </tr>
              )})}
              {filteredTrips.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-slate-500 text-sm">Không tìm thấy chuyến đi nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Trips;
