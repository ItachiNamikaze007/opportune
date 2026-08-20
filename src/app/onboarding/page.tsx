"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/context/StudentContext";
import { useToast } from "@/context/ToastContext";
import { Degree, OpportunityCategory } from "@/types";
import { availableSkillsList } from "@/data/mockStudent";
import {
  GraduationCap,
  BookOpen,
  User,
  Code,
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Plus,
  X,
  Building2,
  Globe2,
  Award,
  Compass,
  Trophy,
  Briefcase,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const { studentProfile, updateProfile } = useStudent();
  const { showToast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [customSkillInput, setCustomSkillInput] = useState("");

  // Form State initialized from current profile
  const [formData, setFormData] = useState({
    name: studentProfile.name || "Aarav Sharma",
    degree: (studentProfile.degree || "B.Tech") as Degree,
    institution: studentProfile.institution || "National Institute of Technology, Karnataka (NITK)",
    branch: studentProfile.branch || "Computer Science & Engineering",
    currentYear: studentProfile.currentYear || 3,
    graduationYear: studentProfile.graduationYear || 2027,
    cgpa: studentProfile.cgpa || 8.8,
    age: studentProfile.age || 20,
    country: studentProfile.country || "India",
    state: studentProfile.state || "Karnataka",
    city: studentProfile.city || "Bengaluru",
    gender: studentProfile.gender || "male",
    categoryQuota: studentProfile.categoryQuota || "General",
    skills: studentProfile.skills.length > 0 ? studentProfile.skills : [
      "Python",
      "JavaScript",
      "React",
      "Machine Learning",
      "SQL",
    ],
    interests: studentProfile.interests.length > 0 ? studentProfile.interests : [
      "hackathon",
      "government_internship",
      "private_internship",
      "scholarship",
      "research_internship",
      "job",
    ] as OpportunityCategory[],
  });

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
  };

  const addCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSkillInput.trim() && !formData.skills.includes(customSkillInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, customSkillInput.trim()],
      }));
      setCustomSkillInput("");
    }
  };

  const toggleInterest = (cat: OpportunityCategory) => {
    setFormData((prev) => {
      const exists = prev.interests.includes(cat);
      const updated = exists ? prev.interests.filter((i) => i !== cat) : [...prev.interests, cat];
      return { ...prev, interests: updated };
    });
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    } else {
      // Complete Onboarding
      updateProfile({
        ...formData,
        completedOnboarding: true,
      });
      setCurrentStep(6); // Celebration screen
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progressPercent = Math.min(100, Math.round((currentStep / 5) * 100));

  return (
    <div className="min-h-[90vh] flex flex-col justify-center px-4 py-8 sm:py-12">
      <div className="max-w-2xl w-full mx-auto">
        {/* Step Progress Bar Header (Only steps 1-5) */}
        {currentStep <= 5 && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-brand-500 dark:text-brand-400 uppercase tracking-wider">
                Step {currentStep} of 5
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                Profile {progressPercent}% complete
              </span>
            </div>

            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-brand-600 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Wizard Card Container */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl transition-all">
          {/* ================= STEP 1: EDUCATION ================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center mb-3">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  What are you currently studying?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We use this to verify degree eligibility for government and corporate opportunities.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Degree Level
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {degreeOptions.slice(0, 8).map((deg) => (
                      <button
                        type="button"
                        key={deg}
                        onClick={() => setFormData({ ...formData, degree: deg })}
                        className={`p-3 rounded-2xl border text-xs font-semibold text-center transition-all ${
                          formData.degree === deg
                            ? "bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-600/20"
                            : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-400"
                        }`}
                      >
                        {deg}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    College / University Name
                  </label>
                  <input
                    type="text"
                    value={formData.institution}
                    onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                    placeholder="e.g. National Institute of Technology, Karnataka"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: ACADEMIC DETAILS ================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Academic details
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Branch and CGPA are the top filtering criteria used by organizations.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Branch / Discipline
                  </label>
                  <input
                    type="text"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    placeholder="e.g. Computer Science & Engineering, Electronics, Mechanical"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Current Year of Study
                    </label>
                    <select
                      value={formData.currentYear}
                      onChange={(e) => setFormData({ ...formData, currentYear: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer"
                    >
                      <option value={1}>1st Year (Freshman)</option>
                      <option value={2}>2nd Year (Sophomore)</option>
                      <option value={3}>3rd Year (Junior / Pre-final)</option>
                      <option value={4}>4th Year (Final Year)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Expected Graduation
                    </label>
                    <select
                      value={formData.graduationYear}
                      onChange={(e) => setFormData({ ...formData, graduationYear: Number(e.target.value) })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50 cursor-pointer"
                    >
                      <option value={2026}>2026</option>
                      <option value={2027}>2027</option>
                      <option value={2028}>2028</option>
                      <option value={2029}>2029</option>
                      <option value={2030}>2030</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Current CGPA (out of 10.0) or %
                    </label>
                    <span className="text-xs font-bold text-brand-500 dark:text-brand-400">
                      {formData.cgpa.toFixed(1)} CGPA
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5.0"
                    max="10.0"
                    step="0.1"
                    value={formData.cgpa}
                    onChange={(e) => setFormData({ ...formData, cgpa: parseFloat(e.target.value) })}
                    className="w-full accent-brand-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>5.0</span>
                    <span>7.0</span>
                    <span>8.5 (First Class with Dist.)</span>
                    <span>10.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: PERSONAL ELIGIBILITY ================= */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Personal eligibility
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Age, state domicile, and gender criteria required for government exam age cutoffs & scholarships.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Your Age (Years)
                    </label>
                    <input
                      type="number"
                      min={16}
                      max={40}
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 20 })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Gender
                    </label>
                    <select
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female (Unlocks Women in STEM grants)</option>
                      <option value="all">Other / Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      State / Domicile
                    </label>
                    <input
                      type="text"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="e.g. Karnataka, Maharashtra, Delhi"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      City
                    </label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="e.g. Bengaluru, Mumbai, Delhi"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: SKILLS ================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                  <Code className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  What skills do you have?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Select your top technical & analytical capabilities. You can also add custom skills.
                </p>
              </div>

              {/* Custom Skill Input */}
              <form onSubmit={addCustomSkill} className="flex gap-2">
                <input
                  type="text"
                  value={customSkillInput}
                  onChange={(e) => setCustomSkillInput(e.target.value)}
                  placeholder="Type a skill & press enter (e.g. Rust, PyTorch, Figma)"
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-2xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-500 transition-colors flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </form>

              {/* Skills Chips */}
              <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
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
                          : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      <span>{skill}</span>
                      {isSelected ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3 h-3 opacity-50" />}
                    </button>
                  );
                })}
              </div>

              {/* Selected Count Indicator */}
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>{formData.skills.length} skills selected</span>
                <span className="text-brand-400 font-medium">+10 points in eligibility match</span>
              </div>
            </div>
          )}

          {/* ================= STEP 5: INTERESTS ================= */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  What opportunities are you looking for?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We'll prioritize these tracks on your personalized dashboard feed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {interestOptions.map((item) => {
                  const Icon = item.icon;
                  const isSelected = formData.interests.includes(item.id);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => toggleInterest(item.id)}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? "bg-brand-500/10 border-brand-500 text-brand-600 dark:text-brand-300 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isSelected ? "bg-brand-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold">{item.label}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================= STEP 6: CELEBRATION SCREEN ================= */}
          {currentStep === 6 && (
            <div className="text-center py-6 space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce">
                <Sparkles className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                  Profile Setup Complete
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  You're all set 🎉
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
                  We've evaluated your degree in <span className="font-semibold text-brand-400">{formData.branch}</span> ({formData.cgpa} CGPA) against 20+ active opportunities.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 max-w-sm mx-auto text-xs text-emerald-300 font-semibold space-y-1">
                <p>✓ 47+ Live Opportunities Evaluated</p>
                <p>✓ Personalized Eligibility Match Active</p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm transition-all shadow-xl shadow-brand-600/30 flex items-center justify-center gap-2 mx-auto"
                >
                  <span>Show My Opportunities</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Navigation Controls (Steps 1-5) */}
          {currentStep <= 5 && (
            <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  currentStep === 1
                    ? "opacity-30 cursor-not-allowed text-slate-400"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="px-6 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-lg shadow-brand-600/20 flex items-center gap-1.5"
              >
                <span>{currentStep === 5 ? "Finish & Discover" : "Continue"}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
