import React from 'react';
import { ChevronDown } from 'lucide-react';

const GrowthChart: React.FC = () => {
  const data = [
    { month: 'JAN', value: 40 },
    { month: 'FEB', value: 65 },
    { month: 'MAR', value: 45 },
    { month: 'APR', value: 80 },
    { month: 'MAY', value: 60 },
    { month: 'JUN', value: 100 },
  ];

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex-1">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="font-bold text-slate-800 text-lg">User/Trip Growth</h3>
          <p className="text-sm text-slate-500 mt-1">Comparison over the last 6 months</p>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors">
          Last 6 Months
          <ChevronDown size={14} />
        </button>
      </div>

      <div className="h-64 flex items-end justify-between gap-4 mt-12">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-4 h-full pt-12">
            <div className="w-full max-w-[40px] flex-1 flex items-end relative">
              <div 
                className={`w-full rounded-sm relative group cursor-pointer transition-all hover:opacity-80 ${
                  idx >= 3 ? 'bg-[#0891B2]' : 'bg-[#E2E8F0]'
                }`}
                style={{ height: `${item.value}%` }}
              >
                {/* Tooltip on hover */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-lg">
                  {item.value}% Growth
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{item.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GrowthChart;
