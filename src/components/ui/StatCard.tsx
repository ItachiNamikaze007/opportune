import React, { ElementType } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ElementType;
  iconBgColor?: string;
  iconColor?: string;
  badgeText?: string;
  badgeType?: "positive" | "warning" | "neutral";
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = "bg-brand-500/10",
  iconColor = "text-brand-400",
  badgeText,
  badgeType = "positive",
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-surface-cardLight dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 transition-all duration-300 ${
        onClick ? "cursor-pointer hover:border-brand-500/50 hover:shadow-lg hover:shadow-brand-500/5" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {title}
          </p>
          <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {value}
          </h4>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>

        <div className={`p-3.5 rounded-2xl ${iconBgColor} ${iconColor} shrink-0`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>

      {badgeText && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              badgeType === "positive"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : badgeType === "warning"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {badgeText}
          </span>
        </div>
      )}
    </div>
  );
};
