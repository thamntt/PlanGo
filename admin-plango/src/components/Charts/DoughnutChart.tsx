import React from "react";

interface DoughnutChartProps {
  title: string;
  data: Record<string, number>;
  colors?: string[];
}

const DoughnutChart: React.FC<DoughnutChartProps> = ({
  title,
  data,
  colors = ["#0891B2", "#F59E0B", "#10B981", "#6366F1", "#EC4899"],
}) => {
  const entries = Object.entries(data);
  const total = entries.reduce((sum, [_, val]) => sum + val, 0);

  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex-1 min-w-[300px]">
      <div className="mb-8">
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-48 h-48">
          <svg viewBox="-1 -1 2 2" className="w-full h-full -rotate-90">
            {entries.map(([label, value], index) => {
              const percent = value / total;
              const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
              cumulativePercent += percent;
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);

              const largeArcFlag = percent > 0.5 ? 1 : 0;
              const pathData = [
                `M ${startX} ${startY}`,
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                `L 0 0`,
              ].join(" ");

              return (
                <path
                  key={label}
                  d={pathData}
                  fill={colors[index % colors.length]}
                  className="hover:opacity-80 transition-opacity cursor-pointer"
                />
              );
            })}
            <circle r="0.6" cx="0" cy="0" fill="white" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black text-slate-800">{total}</span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Tổng cộng
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 w-full">
          {entries.map(([label, value], index) => (
            <div key={label} className="flex items-center justify-between group cursor-pointer">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">{value}</span>
                <span className="text-xs text-slate-400 font-medium w-10 text-right">
                  {Math.round((value / total) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DoughnutChart;
