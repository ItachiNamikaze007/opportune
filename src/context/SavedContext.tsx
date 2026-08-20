"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "./ToastContext";
import { savedService } from "@/services/savedService";

interface SavedContextType {
  savedOpportunityIds: string[];
  isSaved: (id: string) => boolean;
  toggleSave: (id: string, title?: string) => void;
  savedCount: number;
}

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export const SavedProvider = ({ children }: { children: ReactNode }) => {
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<string[]>([
    "opp-01",
    "opp-02",
    "opp-07",
    "opp-08",
  ]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadSaved() {
      try {
        const list = await savedService.getSavedOpportunities();
        if (list && list.length > 0) {
          setSavedOpportunityIds(list);
        }
      } catch (e) {
        console.error("Failed to load saved items:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSaved();
  }, []);

  const isSaved = (id: string) => savedOpportunityIds.includes(id);

  const toggleSave = (id: string, title?: string) => {
    setSavedOpportunityIds((prev) => {
      const exists = prev.includes(id);
      if (exists) {
        savedService.unsaveOpportunity(id);
        showToast(
          "Removed from Saved",
          title ? `"${title}" removed from your list.` : "Opportunity removed from saved list.",
          "info"
        );
        const updated = prev.filter((item) => item !== id);
        if (typeof window !== "undefined") {
          localStorage.setItem("student_saved_opportunities", JSON.stringify(updated));
        }
        return updated;
      } else {
        savedService.saveOpportunity(id);
        showToast(
          "Saved Successfully 🎉",
          title ? `"${title}" has been saved.` : "Opportunity saved to your profile.",
          "success"
        );
        const updated = [...prev, id];
        if (typeof window !== "undefined") {
          localStorage.setItem("student_saved_opportunities", JSON.stringify(updated));
        }
        return updated;
      }
    });
  };

  return (
    <SavedContext.Provider
      value={{
        savedOpportunityIds,
        isSaved,
        toggleSave,
        savedCount: savedOpportunityIds.length,
      }}
    >
      {children}
    </SavedContext.Provider>
  );
};

export const useSaved = () => {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error("useSaved must be used within a SavedProvider");
  }
  return context;
};
