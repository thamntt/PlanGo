import React from 'react';

const ActivityTrendsChart: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex-1">
      <div className="mb-8">
        <h3 className="font-bold text-slate-800 text-lg">Activity Trends</h3>
        <p className="text-sm text-slate-500 mt-1">Hourly system engagement index</p>
      </div>

      <div className="h-64 relative mt-12 w-full">
        {/* SVG Curve - Rough approximation of the smooth line in design */}
        <svg viewBox="0 0 400 150" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0891B2" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Area under curve */}
          <path 
            d="M0,120 Q50,110 80,130 T150,110 T220,130 T300,80 T400,100 L400,150 L0,150 Z" 
            fill="url(#gradient)" 
          />
          
          {/* Main Line */}
          <path 
            d="M0,120 Q50,110 80,130 T150,110 T220,130 T300,80 T400,100" 
            fill="none" 
            stroke="#0891B2" 
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data point dot from the design */}
          <circle cx="340" cy="85" r="4" fill="#0891B2" />
        </svg>

        {/* X-Axis Labels */}
        <div className="flex justify-between mt-4">
          <span className="text-[10px] font-bold text-slate-400 font-mono">00:00</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">06:00</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">12:00</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">18:00</span>
          <span className="text-[10px] font-bold text-slate-400 font-mono">23:59</span>
        </div>
      </div>
    </div>
  );
};

export default ActivityTrendsChart;
