import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Map, 
  Navigation, 
  MessageSquare, 
  Settings 
} from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, to }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
      isActive ? 'bg-[#E2E8F0] border-l-4 border-primary text-primary' : 'text-slate-600 hover:bg-slate-100'
    }`}
  >
    <span className="w-5 h-5 flex items-center justify-center">
      {icon}
    </span>
    <span className="text-sm font-medium">{label}</span>
  </NavLink>
);

const Sidebar: React.FC = () => {
  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Bảng điều khiển', to: '/dashboard' },
    { icon: <Users size={20} />, label: 'Người dùng', to: '/users' },
    { icon: <MapPin size={20} />, label: 'Điểm đến', to: '/destinations' },
    { icon: <Map size={20} />, label: 'Địa điểm (POI)', to: '/poi' },
    { icon: <Navigation size={20} />, label: 'Chuyến đi', to: '/trips' },
    { icon: <MessageSquare size={20} />, label: 'Đánh giá', to: '/reviews' },
    { icon: <Settings size={20} />, label: 'Cài đặt', to: '/settings' },
  ];

  return (
    <aside className="w-64 bg-[#F1F5F9] h-screen flex flex-col border-r border-slate-200">
      <div className="p-6 mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Voyager Admin</h1>
        <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-1">Quản lý Du lịch Chuyên nghiệp</p>
      </div>

      <nav className="flex-1">
        {navItems.map((item, idx) => (
          <NavItem key={idx} {...item} />
        ))}
      </nav>

      <div className="p-4">
        <button className="w-full bg-[#0891B2] hover:bg-[#0E7490] text-white py-3 px-4 rounded-lg text-sm font-semibold transition-all shadow-sm">
          Nâng cấp Tài khoản
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
