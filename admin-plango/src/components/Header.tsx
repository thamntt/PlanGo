import React from 'react';
import { Search, Bell, Plus } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-10">
        <h2 className="text-2xl font-bold text-[#1E40AF]">Voyager</h2>
        <div className="w-[400px] relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm hệ thống..."
            className="w-full bg-[#F1F5F9] border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary outline-none transition-all placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative text-slate-500 hover:text-slate-700 transition-colors">
          <Bell size={20} />
          <span className="absolute top-0 right-0 h-2 w-2 bg-[#0891B2] rounded-full border-2 border-white"></span>
        </button>

        <button className="bg-[#0891B2] hover:bg-[#0E7490] text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-sm">
          <Plus size={18} />
          Tạo mới
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-slate-200 cursor-pointer group">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800 group-hover:text-primary transition-colors">Admin Tổng</p>
            <p className="text-[10px] text-slate-500 uppercase font-medium">Quản trị viên Cấp 4</p>
          </div>
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" 
              alt="Avatar" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
