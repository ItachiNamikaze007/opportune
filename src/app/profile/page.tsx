"use client";

import React, { useState } from "react";
import { useStudent } from "@/context/StudentContext";
import { useToast } from "@/context/ToastContext";
import { Degree, OpportunityCategory } from "@/types";
import { availableSkillsList } from "@/data/mockStudent";
import { ProfileProgress } from "@/components/ui/ProfileProgress";
import {
  User,
  GraduationCap,
  BookOpen,
  Code,
  HeartHandshake,
  CheckCircle2,
  Save,
  RotateCcw,
  Sparkles,
  Plus,
  X,
  Building2,
  Globe2,
  Award,
  Compass,
  Trophy,
  Briefcase,
  Layers,
} from "lucide-react";

export default function ProfilePage() {
  const {
    studentProfile,
    updateProfile,
    resetProfileToDefault,
    profileCompleteness,
    missingFields,
  } = useStudent();
  const { showToast } = useToast();

  const [formData, setFormData] = useState(studentProfile);
  const [customSkill, setCustomSkill] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const degreeOptions: Degree[] = [
    "B.Tech",
    "B.E.",
    "BCA",
    "MCA",
    "B.Sc",
    "M.Sc",
    "M.Tech",
    "Diploma",
    "12th",
    "All Degrees",
  ];

  const interestOptions: { id: OpportunityCategory; label: string; icon: React.ElementType }[] = [
    { id: "hackathon", label: "Hackathons", icon: Code },
    { id: "government_internship", label: "Govt Internships", icon: Building2 },
    { id: "government_exam", label: "Govt Exams", icon: Award },
    { id: "private_internship", label: "Private Internships", icon: Briefcase },
    { id: "job", label: "Full-Time Jobs", icon: Briefcase },
    { id: "scholarship", label: "Scholarships", icon: GraduationCap },
    { id: "research_internship", label: "Research Fellowships", icon: BookOpen },
    { id: "fellowship", label: "Impact Fellowships", icon: Compass },
    { id: "competition", label: "Competitions", icon: Trophy },
    { id: "international_opportunity", label: "International Programs", icon: Globe2 },
  ];

  const toggleSkill = (skill: string) => {
    setFormData((prev) => {
      const exists = prev.skills.includes(skill);
      const updated = exists ? prev.skills.filter((s) => s !== skill) : [...prev.skills, skill];
      return { ...prev, skills: updated };
    });
    setIsSaved(false);
  };

  const addCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSkill.trim() && !formData.skills.includes(customSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, customSkill.trim()],
      }));
      setCustomSkill("");
      setIsSaved(false);
    }
  };

  const toggleInterest = (cat: OpportunityCategory) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(cat);
      const updated = exists ? prev.interests.filter((i) => i !== cat) : [...prev.interests, cat];
      return { ...prev, interests: updated };
    });
    setIsSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
    setIsSaved(true);
    showToast(
      "Profile Updated Successfully ✨",
      "Opportunity eligibility scores recalculated across your dashboard.",
      "success"
    );
  };

  const handleReset = () => {
    resetProfileToDefault();
    setFormData(studentProfile);
    showToast("Profile Reset", "Reset to sample student profile.", "info");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-brand-500/10 text-brand-400">
              <User className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
              Student Eligibility Profile
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            My Profile & Eligibility
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Your single profile automatically drives real-time eligibility across all opportunities.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Reset to demo profile"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-lg shadow-brand-600/30 flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile</span>
          </button>
        </div>
      </div>

      {/* Profile Completeness Visual Indicator */}
      <ProfileProgress />

      {/* Edit Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Basic Info & Education */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <GraduationCap className="w-5 h-5 text-brand-400" />
            <span>1. Degree & College</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                College / University Name
              </label>
              <input
                type="text"
                value={formData.institution}
                onChange={(e) => {
                  setFormData({ ...formData, institution: e.target.value });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Degree Level
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {degreeOptions.slice(0, 8).map((deg) => (
                <button
                  type="button"
                  key={deg}
                  onClick={() => {
                    setFormData({ ...formData, degree: deg });
                    setIsSaved(false);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                    formData.degree === deg
                      ? "bg-brand-600 text-white border-brand-500 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  {deg}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Academic Details */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            <span>2. Academic Details & CGPA</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Branch / Specialization
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => {
                  setFormData({ ...formData, branch: e.target.value });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Current Year of Study
              </label>
              <select
                value={formData.currentYear}
                onChange={(e) => {
                  setFormData({ ...formData, currentYear: Number(e.target.value) });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value={1}>1st Year (Freshman)</option>
                <option value={2}>2nd Year (Sophomore)</option>
                <option value={3}>3rd Year (Junior)</option>
                <option value={4}>4th Year (Senior / Final)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Graduation Year
              </label>
              <select
                value={formData.graduationYear}
                onChange={(e) => {
                  setFormData({ ...formData, graduationYear: Number(e.target.value) });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
              >
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
                <option value={2028}>2028</option>
                <option value={2029}>2029</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Current CGPA (out of 10.0)
              </label>
              <span className="text-xs font-bold text-brand-500">
                {formData.cgpa.toFixed(1)} CGPA
              </span>
            </div>
            <input
              type="range"
              min="5.0"
              max="10.0"
              step="0.1"
              value={formData.cgpa}
              onChange={(e) => {
                setFormData({ ...formData, cgpa: parseFloat(e.target.value) });
                setIsSaved(false);
              }}
              className="w-full accent-brand-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Section 3: Personal Eligibility */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="w-5 h-5 text-emerald-400" />
            <span>3. Personal Eligibility Criteria</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Age
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => {
                  setFormData({ ...formData, age: parseInt(e.target.value) || 20 });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => {
                  setFormData({ ...formData, state: e.target.value });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => {
                  setFormData({ ...formData, city: e.target.value });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => {
                  setFormData({ ...formData, gender: e.target.value as any });
                  setIsSaved(false);
                }}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="all">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Skills */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <Code className="w-5 h-5 text-purple-400" />
            <span>4. Key Skills ({formData.skills.length})</span>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              placeholder="Add a new skill (e.g. Next.js, PyTorch)..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
            />
            <button
              type="button"
              onClick={addCustomSkill}
              className="px-4 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {availableSkillsList.map((skill) => {
              const isSelected = formData.skills.includes(skill);
              return (
                <button
                  type="button"
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-brand-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>{skill}</span>
                  {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3 opacity-50" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 5: Opportunity Preferences */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            <HeartHandshake className="w-5 h-5 text-amber-400" />
            <span>5. Opportunity Interests</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {interestOptions.map((item) => {
              const Icon = item.icon;
              const isSelected = formData.interests.includes(item.id);
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => toggleInterest(item.id)}
                  className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    isSelected
                      ? "bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-300 font-bold"
                      : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs">{item.label}</span>
                  </div>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs sm:text-sm transition-all shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Profile & Recalculate Matches</span>
          </button>
        </div>
      </form>
    </div>
  );
}
