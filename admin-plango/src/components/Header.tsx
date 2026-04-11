import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { adminUser, logout } = useAuth();

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center">
        <div className="flex flex-col">
          <p className="text-sm font-bold text-slate-800">Hệ thống quản trị vận hành</p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Cổng thông tin dữ liệu du lịch Plango</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-800">{adminUser?.userName || 'Admin'}</p>
            <p className="text-[10px] text-slate-400 font-medium">{adminUser?.email || ''}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-bold text-lg">
            {(adminUser?.userName || 'A')[0].toUpperCase()}
          </div>
          <button
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
                logout();
              }
            }}
            className="ml-2 p-2.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
