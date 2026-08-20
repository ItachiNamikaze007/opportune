"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { NotificationSettings, OpportunityCategory, UserSettings } from "@/types";
import { useToast } from "./ToastContext";

interface SettingsContextType {
  settings: UserSettings;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  toggleSubscribedCategory: (cat: OpportunityCategory) => void;
  resetAllAppData: () => void;
}

const defaultSettings: UserSettings = {
  theme: "dark",
  notifications: {
    emailAlerts: true,
    deadlineReminders: true,
    weeklyDigest: true,
    whatsappAlerts: false,
    eligibilityUpdates: true,
  },
  subscribedCategories: [
    "hackathon",
    "government_internship",
    "private_internship",
    "scholarship",
    "research_internship",
    "job",
  ],
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("student_app_user_settings");
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("student_app_user_settings", JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const updateNotifications = (updates: Partial<NotificationSettings>) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        ...updates,
      },
    }));
    showToast("Preferences Updated", "Your notification settings were saved.", "success");
  };

  const toggleSubscribedCategory = (cat: OpportunityCategory) => {
    setSettings((prev) => {
      const exists = prev.subscribedCategories.includes(cat);
      const updated = exists
        ? prev.subscribedCategories.filter((c) => c !== cat)
        : [...prev.subscribedCategories, cat];
      return { ...prev, subscribedCategories: updated };
    });
  };

  const resetAllAppData = () => {
    localStorage.clear();
    showToast("Demo Data Reset", "Local profile and tracker data reset.", "info");
    window.location.reload();
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateNotifications,
        toggleSubscribedCategory,
        resetAllAppData,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
