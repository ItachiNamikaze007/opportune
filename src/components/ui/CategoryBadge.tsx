import React from "react";
import { OpportunityCategory } from "@/types";
import {
  Code,
  GraduationCap,
  Briefcase,
  Trophy,
  Flame,
  Award,
  Globe2,
  Building2,
  BookOpen,
  Compass,
} from "lucide-react";

interface CategoryBadgeProps {
  category: OpportunityCategory;
  size?: "sm" | "md";
}

export const getCategoryInfo = (cat: OpportunityCategory) => {
  switch (cat) {
    case "hackathon":
      return {
        label: "Hackathon",
        icon: Code,
        color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
      };
    case "government_internship":
      return {
        label: "Govt Internship",
        icon: Building2,
        color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "government_exam":
      return {
        label: "Govt Exam",
        icon: Award,
        color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      };
    case "private_internship":
      return {
        label: "Private Internship",
        icon: Briefcase,
        color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      };
    case "job":
      return {
        label: "Full-Time Job",
        icon: Briefcase,
        color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      };
    case "scholarship":
      return {
        label: "Scholarship",
        icon: GraduationCap,
        color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    case "research_internship":
      return {
        label: "Research Fellowship",
        icon: BookOpen,
        color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      };
    case "fellowship":
      return {
        label: "Fellowship",
        icon: Compass,
        color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
      };
    case "competition":
      return {
        label: "Competition",
        icon: Trophy,
        color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
      };
    case "international_opportunity":
      return {
        label: "International",
        icon: Globe2,
        color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
      };
    default:
      return {
        label: "Opportunity",
        icon: Flame,
        color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
      };
  }
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  category,
  size = "md",
}) => {
  const info = getCategoryInfo(category);
  const Icon = info.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs font-medium gap-1.5",
  };

  return (
    <span
      className={`inline-flex items-center rounded-lg border font-medium ${info.color} ${sizeClasses[size]}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{info.label}</span>
    </span>
  );
};
