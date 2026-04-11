import React from 'react';
import StatCard from '../components/StatCard';
import GrowthChart from '../components/Charts/GrowthChart';
import PopularDestinations from '../components/PopularDestinations';
import DoughnutChart from '../components/Charts/DoughnutChart';
import { useData } from '../contexts/DataContext';

const Dashboard: React.FC = () => {
  const { users, itineraries, destinations, reviews, adminStats } = useData();

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="mb-10 text-center lg:text-left">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Tổng quan Hệ thống Plango</h2>
        <p className="text-lg text-slate-500 mt-2">Theo dõi người dùng, điểm đến và hoạt động hệ thống theo thời gian thực</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard 
          icon="users" 
          label="Tổng Người dùng" 
          value={users.filter(u => u.role === 'user').length.toString()} 
          trend="+12%" 
        />
        <StatCard 
          icon="trips" 
          label="Tổng số Chuyến đi" 
          value={itineraries.length.toString()} 
          trend="+8%" 
        />
        <StatCard 
          icon="destinations" 
          label="Tổng Điểm đến" 
          value={destinations.length.toString()} 
          status="Tĩnh" 
        />
        <StatCard 
          icon="reviews" 
          label="Tổng Đánh giá" 
          value={reviews.length.toString()} 
          trend="+5%" 
        />
      </div>

      <div className="mb-8">
        <GrowthChart />
      </div>

      {adminStats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <DoughnutChart 
            title="Phân bổ Loại điểm đến" 
            data={adminStats.destinationTypes} 
            colors={['#0891B2', '#10B981', '#F59E0B', '#6366F1', '#EC4899']}
          />
          <DoughnutChart 
            title="Trạng thái Chuyến đi" 
            data={adminStats.tripStatus} 
            colors={['#94A3B8', '#0891B2', '#10B981', '#F43F5E']}
          />
        </div>
      )}

      <div className="mb-12">
        <PopularDestinations />
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          © 2024 Plango Travel Management. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
