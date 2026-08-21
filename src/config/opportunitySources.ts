import type { SourceProvenanceType } from "@/types";

export interface OpportunitySourceConfig {
  id: string;
  sourceName: string;
  sourceType: SourceProvenanceType;
  baseUrl: string;
  allowedDomains: string[];
  discoveryUrls: string[];
  enabled: boolean;
  crawlDepth: number;
  rateLimitMs: number;
  description: string;
}

export const CONFIGURED_OPPORTUNITY_SOURCES: OpportunitySourceConfig[] = [
  {
    id: "src-meity-gov",
    sourceName: "Ministry of Electronics & Information Technology (MeitY)",
    sourceType: "official",
    baseUrl: "https://www.meity.gov.in",
    allowedDomains: ["meity.gov.in", "www.meity.gov.in", "digitalindia.gov.in", "nic.in"],
    discoveryUrls: [
      "https://www.meity.gov.in/internship-scheme",
      "https://www.meity.gov.in/schemes",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Official government ministry portal for student internships and fellowship schemes.",
  },
  {
    id: "src-flipkart-tech",
    sourceName: "Flipkart Tech & Campus Programs",
    sourceType: "official",
    baseUrl: "https://tech.flipkart.com",
    allowedDomains: ["tech.flipkart.com", "blog.flipkart.tech", "flipkart.com"],
    discoveryUrls: [
      "https://tech.flipkart.com",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Official engineering and robotics challenges hosted by Flipkart.",
  },
  {
    id: "src-sih-gov",
    sourceName: "Smart India Hackathon (Ministry of Education / AICTE)",
    sourceType: "official",
    baseUrl: "https://sih.gov.in",
    allowedDomains: ["sih.gov.in", "www.sih.gov.in", "aicte-india.org", "gov.in"],
    discoveryUrls: [
      "https://sih.gov.in",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "National institutional and student innovation hackathon by Government of India.",
  },
  {
    id: "src-niti-aayog",
    sourceName: "NITI Aayog Official Scheme Portal",
    sourceType: "official",
    baseUrl: "https://niti.gov.in",
    allowedDomains: ["niti.gov.in", "www.niti.gov.in", "gov.in"],
    discoveryUrls: [
      "https://niti.gov.in",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Public policy, governance, and development research internships at NITI Aayog.",
  },
  {
    id: "src-drdo-rac",
    sourceName: "DRDO Recruitment & Assessment Centre (RAC)",
    sourceType: "official",
    baseUrl: "https://rac.gov.in",
    allowedDomains: ["rac.gov.in", "drdo.gov.in", "gov.in"],
    discoveryUrls: [
      "https://rac.gov.in",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Defence Research and Development Organisation junior research and scientist appointments.",
  },
  {
    id: "src-isro-careers",
    sourceName: "ISRO Centralised Recruitment Board (ICRB)",
    sourceType: "official",
    baseUrl: "https://www.isro.gov.in",
    allowedDomains: ["isro.gov.in", "www.isro.gov.in", "isro.dos.gov.in", "gov.in"],
    discoveryUrls: [
      "https://www.isro.gov.in/Careers.html",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Indian Space Research Organisation national scientist/engineer and research positions.",
  },
  {
    id: "src-upsc-gov",
    sourceName: "Union Public Service Commission (UPSC)",
    sourceType: "official",
    baseUrl: "https://upsc.gov.in",
    allowedDomains: ["upsc.gov.in", "www.upsc.gov.in", "upsconline.nic.in", "nic.in"],
    discoveryUrls: [
      "https://upsc.gov.in",
    ],
    enabled: true,
    crawlDepth: 2,
    rateLimitMs: 500,
    description: "Combined Engineering Services (ESE), Civil Services, and premier technical examinations.",
  },
  {
    id: "src-unstop-partner",
    sourceName: "Unstop Partner Discovery Feed",
    sourceType: "partner",
    baseUrl: "https://unstop.com",
    allowedDomains: ["unstop.com", "d2c.in", "dare2compete.com"],
    discoveryUrls: [
      "https://unstop.com/competitions",
    ],
    enabled: true,
    crawlDepth: 1,
    rateLimitMs: 1000,
    description: "Authorized third-party partner aggregator for student hackathons and competitions.",
  },
];
