"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { ApplicationStage, StudentApplication } from "@/types";
import { useToast } from "./ToastContext";
import { applicationService } from "@/services/applicationService";

interface ApplicationContextType {
  applications: StudentApplication[];
  moveStage: (applicationId: string, newStage: ApplicationStage) => void;
  addApplication: (opportunityId: string, stage?: ApplicationStage, notes?: string) => void;
  removeApplication: (applicationId: string) => void;
  updateNotes: (applicationId: string, notes: string) => void;
  getApplicationByOppId: (opportunityId: string) => StudentApplication | undefined;
}

const ApplicationContext = createContext<ApplicationContextType | undefined>(undefined);

export const ApplicationProvider = ({ children }: { children: ReactNode }) => {
  const [applications, setApplications] = useState<StudentApplication[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadApps() {
      try {
        const apps = await applicationService.getApplications();
        setApplications(apps);
      } catch (e) {
        console.error("Failed to load applications:", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadApps();
  }, []);

  const moveStage = (applicationId: string, newStage: ApplicationStage) => {
    const stageTitles: Record<ApplicationStage, string> = {
      saved: "Saved",
      applied: "Applied",
      assessment: "Assessment",
      interview: "Interview",
      selected: "Selected 🎉",
      rejected: "Archived / Not Selected",
    };

    setApplications((prev) => {
      const updated = prev.map((app) => {
        if (app.id === applicationId) {
          return {
            ...app,
            stage: newStage,
            updatedDate: new Date().toISOString().split("T")[0],
          };
        }
        return app;
      });

      if (typeof window !== "undefined") {
        localStorage.setItem("student_applications_tracker", JSON.stringify(updated));
      }
      return updated;
    });

    applicationService.updateApplicationStage(applicationId, newStage);

    showToast(
      `Moved to ${stageTitles[newStage]}`,
      "Your application progress has been updated.",
      newStage === "selected" ? "success" : "info"
    );
  };

  const addApplication = async (
    opportunityId: string,
    stage: ApplicationStage = "applied",
    notes: string = ""
  ) => {
    const created = await applicationService.createApplication(opportunityId, stage, notes);
    setApplications((prev) => {
      const exists = prev.find((a) => a.opportunityId === opportunityId);
      let updatedList: StudentApplication[];
      if (exists) {
        updatedList = prev.map((a) =>
          a.opportunityId === opportunityId
            ? { ...a, stage, notes: notes || a.notes, updatedDate: new Date().toISOString().split("T")[0] }
            : a
        );
      } else {
        updatedList = [...prev, created];
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("student_applications_tracker", JSON.stringify(updatedList));
      }
      return updatedList;
    });
    showToast("Added to Application Tracker", "Track deadlines and interview stages.", "success");
  };

  const removeApplication = async (applicationId: string) => {
    setApplications((prev) => {
      const updated = prev.filter((a) => a.id !== applicationId);
      if (typeof window !== "undefined") {
        localStorage.setItem("student_applications_tracker", JSON.stringify(updated));
      }
      return updated;
    });
    await applicationService.deleteApplication(applicationId);
    showToast("Application Removed", "Removed from tracker.", "info");
  };

  const updateNotes = async (applicationId: string, notes: string) => {
    setApplications((prev) => {
      const updated = prev.map((a) =>
        a.id === applicationId
          ? { ...a, notes, updatedDate: new Date().toISOString().split("T")[0] }
          : a
      );
      if (typeof window !== "undefined") {
        localStorage.setItem("student_applications_tracker", JSON.stringify(updated));
      }
      return updated;
    });
    await applicationService.updateApplicationNotes(applicationId, notes);
    showToast("Notes Saved", "Application notes updated.", "success");
  };

  const getApplicationByOppId = (opportunityId: string) => {
    return applications.find((a) => a.opportunityId === opportunityId);
  };

  return (
    <ApplicationContext.Provider
      value={{
        applications,
        moveStage,
        addApplication,
        removeApplication,
        updateNotes,
        getApplicationByOppId,
      }}
    >
      {children}
    </ApplicationContext.Provider>
  );
};

export const useApplication = () => {
  const context = useContext(ApplicationContext);
  if (!context) {
    throw new Error("useApplication must be used within an ApplicationProvider");
  }
  return context;
};
