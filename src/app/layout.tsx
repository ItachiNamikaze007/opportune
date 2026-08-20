import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import { StudentProvider } from "@/context/StudentContext";
import { SavedProvider } from "@/context/SavedContext";
import { ApplicationProvider } from "@/context/ApplicationContext";
import { SettingsProvider } from "@/context/SettingsContext";
import { AppLayout } from "@/components/layout/AppLayout";

export const metadata: Metadata = {
  title: "Opportune 2026 | You Don't Find Opportunities. Opportunities Find You.",
  description:
    "Create your student profile once and automatically discover government exams, internships, hackathons, scholarships, jobs, research fellowships and international programs you are eligible for.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-light dark:bg-surface-dark font-sans">
        <ThemeProvider>
          <ToastProvider>
            <StudentProvider>
              <SavedProvider>
                <ApplicationProvider>
                  <SettingsProvider>
                    <AppLayout>{children}</AppLayout>
                  </SettingsProvider>
                </ApplicationProvider>
              </SavedProvider>
            </StudentProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
