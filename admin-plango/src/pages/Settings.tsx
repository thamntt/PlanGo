import React from 'react';
import { User, Shield, Globe, Bell, LogOut, ChevronRight, Activity, Cpu, Database } from 'lucide-react';

const Settings: React.FC = () => {
  return (
    <div className="flex-1 p-8 overflow-y-auto bg-slate-50/30">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-slate-900 tracking-tight">Cài đặt Hệ thống</h2>
        <p className="text-lg text-slate-500 mt-2">Quản lý các lựa chọn quản trị và mặc định của ứng dụng.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Main Settings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                   <User size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Hồ sơ Quản trị</h3>
             </div>
             
             <div className="space-y-6">
                <div className="flex items-center gap-6">
                   <div className="w-24 h-24 rounded-3xl bg-slate-100 border-4 border-white shadow-md relative group">
                      <img src="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&h=200&fit=crop" className="w-full h-full rounded-3xl object-cover" alt="" />
                      <div className="absolute inset-0 bg-black/40 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                         <span className="text-white text-[10px] font-black uppercase tracking-widest cursor-pointer">Sửa</span>
                      </div>
                   </div>
                   <div className="flex-1 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ và Tên</label>
                            <input type="text" defaultValue="Admin Tổng" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-primary/20 transition-all" />
                         </div>
                         <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa chỉ Email</label>
                            <input type="email" defaultValue="admin@plango.com" className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-primary/20 transition-all" />
                         </div>
                      </div>
                   </div>
                </div>
                
                <div className="pt-4 flex justify-end">
                   <button className="bg-primary text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20">
                      Lưu thay đổi hồ sơ
                   </button>
                </div>
             </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
             <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl">
                   <Shield size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Bảo mật & Quyền riêng tư</h3>
             </div>
             
             <div className="space-y-4">
                {[
                  { label: 'Xác thực hai yếu tố (2FA)', desc: 'Bảo vệ tài khoản với xác thực 2 lớp.', active: true },
                  { label: 'Thông báo Đăng nhập', desc: 'Nhận cảnh báo khi có đăng nhập từ vị trí mới.', active: false },
                  { label: 'Quản lý API Key', desc: 'Kiểm soát quyền truy cập của bên thứ ba.', active: true }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl group cursor-pointer hover:bg-slate-100 transition-all">
                     <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-800 tracking-tight">{item.label}</span>
                        <span className="text-xs font-medium text-slate-500">{item.desc}</span>
                     </div>
                     <div className={`w-12 h-6 rounded-full relative transition-colors ${item.active ? 'bg-primary' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.active ? 'right-1' : 'left-1'}`}></div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Col: System Diagnostics */}
        <div className="space-y-6">
           <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl shadow-slate-900/20">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-6 text-slate-400">Trạng thái Hệ thống</h4>
              
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Cpu size={18} className="text-primary" />
                       <span className="text-sm font-bold">Máy chủ chính</span>
                    </div>
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Đang chạy</span>
                 </div>
                 
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Database size={18} className="text-amber-500" />
                       <span className="text-sm font-bold">PostgreSQL Hub</span>
                    </div>
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Đã kết nối</span>
                 </div>
                 
                 <div className="pt-6 border-t border-slate-800">
                    <div className="flex justify-between items-end mb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sử dụng Bộ nhớ</span>
                       <span className="text-xs font-bold text-primary">64%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                       <div className="h-full bg-primary w-[64%]"></div>
                    </div>
                 </div>

                 <button className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all text-xs font-black uppercase tracking-[0.2em]">
                    <Activity size={14} /> Xem Nhật ký Debug
                 </button>
              </div>
           </div>

           <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-slate-400">Liên kết nhanh</h4>
              <div className="space-y-2">
                 <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                    <div className="flex items-center gap-3">
                       <Globe size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                       <span className="text-sm font-bold text-slate-700">Đa ngôn ngữ</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                 </button>
                 <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-all group">
                    <div className="flex items-center gap-3">
                       <Bell size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                       <span className="text-sm font-bold text-slate-700">Thông báo</span>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                 </button>
                 <button className="w-full flex items-center justify-between p-4 hover:bg-rose-50 rounded-2xl transition-all group mt-8">
                    <div className="flex items-center gap-3">
                       <LogOut size={18} className="text-rose-400" />
                       <span className="text-sm font-bold text-rose-600">Đăng xuất Quản trị</span>
                    </div>
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
