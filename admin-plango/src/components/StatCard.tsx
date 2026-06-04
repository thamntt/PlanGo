import { Users, Navigation, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCardProps {
  icon: "users" | "trips" | "destinations" | "reviews";
  label: string;
  value: string;
  trend?: string;
  status?: string;
  to?: string;
}

const icons = {
  users: <Users size={20} className="text-cyan-600" />,
  trips: <Navigation size={20} className="text-orange-600" />,
  destinations: <MapPin size={20} className="text-slate-600" />,
  reviews: <Star size={20} className="text-amber-500" />,
};

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, trend, status, to }) => {
  const content = (
    <>
      <div className="flex justify-between items-start mb-4">
        <div
          className={`p-3 rounded-xl ${
            icon === "users"
              ? "bg-cyan-50"
              : icon === "trips"
                ? "bg-orange-50"
                : icon === "destinations"
                  ? "bg-slate-50"
                  : "bg-amber-50"
          }`}
        >
          {icons[icon]}
        </div>
        {trend && (
          <span className="text-[11px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
            {trend}
          </span>
        )}
        {status && (
          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-1 rounded-full border border-slate-100 uppercase tracking-wider">
            {status}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        <p className="text-4xl font-black text-slate-800 tracking-tight mt-1">{value}</p>
      </div>
    </>
  );

  const containerClasses =
    "bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2 transition-all duration-300";
  const hoverClasses = to
    ? "hover:shadow-xl hover:shadow-slate-200/50 hover:scale-[1.02] cursor-pointer block"
    : "";

  if (to) {
    return (
      <Link to={to} className={`${containerClasses} ${hoverClasses}`}>
        {content}
      </Link>
    );
  }

  return <div className={containerClasses}>{content}</div>;
};

export default StatCard;
