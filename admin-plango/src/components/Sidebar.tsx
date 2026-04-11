import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  MapPin, 
  Map, 
  Star, 
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
    { icon: <Star size={20} />, label: 'Đánh giá', to: '/reviews' },
  ];

  return (
    <aside className="w-64 bg-[#F1F5F9] h-screen flex flex-col border-r border-slate-200">
      <div className="p-6 mb-4">
        <h1 className="text-xl font-bold text-[#0F172A]">Plango Admin</h1>
        <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-1">Quản lý Du lịch Chuyên nghiệp</p>
      </div>

      <nav className="flex-1">
        {navItems.map((item, idx) => (
          <NavItem key={idx} {...item} />
        ))}
      </nav>


    </aside>
  );
};

export default Sidebar;
