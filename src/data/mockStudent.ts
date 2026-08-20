import { StudentProfile } from "@/types";

export const defaultStudentProfile: StudentProfile = {
  name: "Aarav Sharma",
  email: "aarav.sharma@example.edu",
  phone: "+91 98765 43210",
  avatarUrl: "",
  // Step 1: Education
  degree: "B.Tech",
  institution: "National Institute of Technology, Karnataka (NITK)",
  // Step 2: Academic details
  branch: "Computer Science & Engineering",
  currentYear: 3,
  graduationYear: 2027,
  cgpa: 8.8,
  // Step 3: Personal eligibility
  age: 20,
  country: "India",
  state: "Karnataka",
  city: "Bengaluru",
  gender: "male",
  categoryQuota: "General",
  // Step 4: Skills
  skills: [
    "Python",
    "JavaScript",
    "React",
    "Node.js",
    "Machine Learning",
    "SQL",
    "C++",
    "Data Structures",
    "Git",
  ],
  // Step 5: Interests
  interests: [
    "hackathon",
    "government_internship",
    "private_internship",
    "scholarship",
    "research_internship",
    "job",
  ],
  completedOnboarding: true,
};

export const availableSkillsList = [
  "Python",
  "C++",
  "Java",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Node.js",
  "Machine Learning",
  "AI & Deep Learning",
  "Data Science",
  "Computer Vision",
  "Natural Language Processing",
  "Cybersecurity",
  "Cloud (AWS / Azure / GCP)",
  "SQL & Databases",
  "MongoDB",
  "Docker & Kubernetes",
  "UI/UX & Figma",
  "Embedded Systems & IoT",
  "Robotics",
  "Web3 & Blockchain",
  "Competitive Programming",
  "Technical Writing",
  "Project Management",
];
