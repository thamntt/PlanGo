import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Unlock, Trash2, Search } from 'lucide-react';
import { useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import type { UserData } from '../lib/types';

const RoleBadge: React.FC<{ role: UserData['role'] }> = ({ role }) => {
  const styles = {
    admin: 'bg-cyan-100 text-cyan-800',
    user: 'bg-orange-100 text-orange-800',
  };
  const labelMap: Record<string, string> = {
    admin: 'Quản trị',
    user: 'Người dùng'
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${styles[role] || styles.user} uppercase`}>
      {labelMap[role] || role}
    </span>
  );
};

const StatusIndicator: React.FC<{ isLocked: boolean }> = ({ isLocked }) => {
  const dotColor = isLocked ? 'bg-orange-500' : 'bg-emerald-500';
  const textColor = isLocked ? 'text-orange-600 font-semibold' : 'text-emerald-600 font-semibold';
  const statusStr = isLocked ? 'Bị khoá' : 'Hoạt động';

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      <span className={`text-xs ${textColor}`}>{statusStr}</span>
    </div>
  );
};

const Users: React.FC = () => {
  const { users, updateUser, deleteUser, fetchUsers } = useData();
  const [filterMode, setFilterMode] = useState<"all" | "active" | "locked">("all");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fetchUsers) fetchUsers(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, fetchUsers]);
  
  

  const filteredUsers = users.filter(u => {
    // 1. Hide Admin accounts
    if (u.role === 'admin') return false;
    
    // 2. Filter by status
    if (filterMode === "active") return !u.isLocked;
    if (filterMode === "locked") return u.isLocked;
    
    return true;
  });


  const toggleLock = async (u: UserData) => {
    await updateUser(u.id, { isLocked: !u.isLocked });
  };

  const handleDelete = async (u: UserData) => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá người dùng ${u.fullName}?`)) {
      await deleteUser(u.id);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto relative">
      <div className="mb-8">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Người dùng</h2>
        <p className="text-lg text-slate-500 mt-2">Quản lý quyền truy cập hệ thống và phân quyền người điều hành du lịch.</p>
      </div>

      {/* Filter Bar */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setFilterMode("all")}
            className={`px-6 py-2 text-sm font-bold rounded-lg shadow-sm transition-colors ${filterMode === "all" ? "bg-white text-primary" : "text-slate-600 hover:text-slate-900"}`}
          >Tất cả</button>
          <button 
            onClick={() => setFilterMode("active")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${filterMode === "active" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >Hoạt động</button>
          <button 
            onClick={() => setFilterMode("locked")}
            className={`px-6 py-2 text-sm font-bold rounded-lg transition-colors ${filterMode === "locked" ? "bg-white text-primary shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >Bị khoá</button>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm theo tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-[250px] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-1/3">Hồ sơ người dùng</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Địa chỉ Email</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Vai trò</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Trạng thái</th>
              <th className="px-8 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    {user.avatar ? 
                       <img src={user.avatar} className="w-12 h-12 rounded-xl object-cover" alt="" /> :
                       <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                          {user.fullName.charAt(0).toUpperCase()}
                       </div>
                    }
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{user.fullName || user.username}</span>
                      <span className="text-xs text-slate-400">@{user.username}</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6 text-sm font-medium text-slate-600">
                  {user.email}
                </td>
                <td className="px-8 py-6 text-center">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-8 py-6">
                  <div className="flex justify-center">
                    <StatusIndicator isLocked={user.isLocked} />
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                   <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => toggleLock(user)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title={user.isLocked ? "Mở khoá người dùng" : "Khoá người dùng"}>
                       {user.isLocked ? <Unlock size={16} /> : <Lock size={16} />}
                     </button>
                     <button onClick={() => handleDelete(user)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="Xoá người dùng">
                       <Trash2 size={16} />
                     </button>
                   </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-10 text-center text-slate-500 text-sm">Không tìm thấy người dùng nào.</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        <div className="px-8 py-6 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs font-bold text-slate-500 italic">Hiển thị {filteredUsers.length} thành viên hệ thống</p>
          <div className="flex gap-2">
            <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          © 2024 Plango Travel Management. Bảo lưu mọi quyền.
        </p>
      </footer>


    </div>
  );
};

export default Users;
