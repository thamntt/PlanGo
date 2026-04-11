import React from 'react';
import StatCard from '../components/StatCard';
import GrowthChart from '../components/Charts/GrowthChart';
import ActivityTrendsChart from '../components/Charts/ActivityTrendsChart';
import ActivityFeed from '../components/ActivityFeed';
import { useData } from '../contexts/DataContext';

const Dashboard: React.FC = () => {
  const { users, itineraries, destinations, reviews } = useData();

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="mb-10">
        <h2 className="text-4xl font-black text-slate-800 tracking-tight">Tổng quan Hệ thống</h2>
        <p className="text-lg text-slate-500 mt-2">Theo dõi người dùng, điểm đến và hoạt động hệ thống theo thời gian thực</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          icon="users" 
          label="Tổng Người dùng" 
          value={users.length.toString()} 
          trend="" 
        />
        <StatCard 
          icon="trips" 
          label="Chuyến đi Hoạt động" 
          value={itineraries.length.toString()} 
          trend="" 
        />
        <StatCard 
          icon="destinations" 
          label="Tổng Điểm đến" 
          value={destinations.length.toString()} 
          status="Tĩnh" 
        />
        <StatCard 
          icon="revenue" // using revenue icon for reviews for now
          label="Tổng Đánh giá" 
          value={reviews.length.toString()} 
          trend="" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        <GrowthChart />
        <ActivityTrendsChart />
      </div>

      <div className="mb-8">
        <ActivityFeed />
      </div>

      <footer className="mt-12 text-center">
        <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">
          © 2024 Voyager Travel Management. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
};

export default Dashboard;
