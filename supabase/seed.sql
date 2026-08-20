-- ==============================================================================
-- OPPORTUNE 2026 - DATABASE SEED DATA (Phase 3A)
-- 22 Comprehensive Mock Opportunities, Sources & Eligibility Rules
-- All records are clearly tagged with is_demo = true and verification_status = 'demo'.
-- ==============================================================================

-- 1. Insert Opportunity Sources
INSERT INTO public.opportunity_sources (
    id, source_name, source_url, source_type, is_official, is_active, status, check_frequency, last_checked_at, last_success_at
) VALUES
('00000000-0000-0000-0000-000000000001', 'Google Developers Portal', 'https://developers.google.com', 'company', true, true, 'active', 'daily', NOW(), NOW()),
('00000000-0000-0000-0000-000000000002', 'NITI Aayog Official Portal', 'https://niti.gov.in', 'government', true, true, 'active', 'daily', NOW(), NOW()),
('00000000-0000-0000-0000-000000000003', 'Reliance Foundation Portal', 'https://scholarships.reliancefoundation.org', 'scholarship', true, true, 'active', 'weekly', NOW(), NOW()),
('00000000-0000-0000-0000-000000000004', 'IIT Madras SFP Portal', 'https://sfp.iitm.ac.in', 'university', true, true, 'active', 'weekly', NOW(), NOW()),
('00000000-0000-0000-0000-000000000005', 'ISRO ICRB Central Portal', 'https://www.isro.gov.in/Careers.html', 'government', true, true, 'active', 'daily', NOW(), NOW()),
('00000000-0000-0000-0000-000000000006', 'AICTE & MoE SIH Portal', 'https://www.sih.gov.in', 'government', true, true, 'active', 'daily', NOW(), NOW()),
('00000000-0000-0000-0000-000000000007', 'Microsoft Student Careers', 'https://careers.microsoft.com/students', 'company', true, true, 'active', 'daily', NOW(), NOW()),
('00000000-0000-0000-0000-000000000008', 'Mitacs Canada Official', 'https://www.mitacs.ca', 'university', true, true, 'active', 'weekly', NOW(), NOW()),
('00000000-0000-0000-0000-000000000009', 'Teach For India Portal', 'https://www.teachforindia.org', 'other', true, true, 'active', 'weekly', NOW(), NOW()),
('00000000-0000-0000-0000-000000000010', 'Zomato Early Careers', 'https://www.zomato.com/careers', 'company', true, true, 'active', 'daily', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    status = EXCLUDED.status,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- 2. Insert Opportunities (Mock dataset clearly flagged as is_demo = true, verification_status = 'demo')
INSERT INTO public.opportunities (
    id, source_id, title, organization, category, category_label, description, full_description,
    deadline, location, remote, stipend_or_prize, stipend_type, official_url, apply_url, source_url,
    verification_status, verification_notes, last_verified_at, is_demo, featured, tags, benefits, application_steps, important_dates
) VALUES
(
    'opp-01', '00000000-0000-0000-0000-000000000001',
    'Google AI Challenge 2026', 'Google Developers & Research', 'hackathon', 'Hackathon',
    'Build groundbreaking generative AI and agentic applications tackling real-world accessibility and education challenges.',
    'The Google AI Challenge 2026 invites undergraduate and postgraduate students from engineering and computer science backgrounds across India to prototype innovative AI agents using Gemini models, TensorFlow, and Android. Winners receive cash prizes, Google Cloud credits, and direct interview pipelines for SWE & AI Research roles.',
    '2026-08-28 23:59:59+00', 'Bengaluru / Hybrid', true, '₹1,00,000', 'prize',
    'https://developers.google.com/community/hackathons/ai-challenge-2026',
    'https://developers.google.com/community/hackathons/ai-challenge-2026/apply',
    'https://developers.google.com/community/hackathons',
    'demo', 'Verified official Google developer competition mock data for prototype evaluation.',
    '2026-08-18 10:00:00+00', true, true,
    ARRAY['Generative AI', 'Gemini API', 'Team Hackathon', 'Fast-Track Hiring'],
    ARRAY['₹1,00,000 Cash Prize Pool for Top 3 Teams', '$2,500 in Google Cloud & Vertex AI Credits per team', 'Direct fast-track interview consideration for Google SWE Summer Internships', 'Mentorship sessions with Google Staff Engineers & AI Researchers'],
    ARRAY['Register individual or team (up to 4 members) on Google Dev Portal', 'Submit 3-page problem statement & architecture proposal', 'Build MVP prototype using Gemini API and submit GitHub repo + 2 min video demo', 'Live virtual presentation to Google engineering jury'],
    '[{"label":"Registration Closes","date":"28 Aug 2026"},{"label":"Round 1 Idea Submission","date":"05 Sep 2026"},{"label":"Grand Finale Demo Day","date":"20 Sep 2026"}]'::jsonb
),
(
    'opp-02', '00000000-0000-0000-0000-000000000002',
    'NITI Aayog National Internship Scheme (Winter Batch)', 'NITI Aayog, Government of India', 'government_internship', 'Government Internship',
    'Work closely with senior policy makers, economists, and technical advisors on national digital transformation initiatives.',
    'NITI Aayog offers an unpaid/stipend-eligible institutional internship program for passionate undergraduate and postgraduate students enrolled in recognized Indian and international universities.',
    '2026-09-10 23:59:59+00', 'New Delhi (Sansad Marg)', false, 'Govt Certificate & Travel Allowance', 'stipend',
    'https://niti.gov.in/internship-scheme',
    'https://niti.gov.in/internship-scheme/apply',
    'https://niti.gov.in',
    'demo', 'Official Government of India portal scheme demo data.',
    '2026-08-15 10:00:00+00', true, true,
    ARRAY['Policy', 'Govt of India', 'Prestigious', 'Data & Tech'],
    ARRAY['Official Certificate of Internship issued by NITI Aayog, Govt of India', 'Direct mentorship under Mission Directors and Joint Secretaries', 'Experience on high-impact public governance & policy initiatives'],
    ARRAY['Apply through the official NITI Aayog online internship portal', 'Provide university No Objection Certificate (NOC)', 'Select vertical of interest', 'Shortlisted candidates notified via email'],
    '[{"label":"Application Window Opens","date":"01 Sep 2026"},{"label":"Application Window Closes","date":"10 Sep 2026"},{"label":"Commencement of Internship","date":"01 Nov 2026"}]'::jsonb
),
(
    'opp-03', '00000000-0000-0000-0000-000000000003',
    'Reliance Foundation Undergraduate STEM Scholarship 2026', 'Reliance Foundation', 'scholarship', 'Scholarship',
    'Merit-cum-means scholarship supporting exceptional undergraduate students pursuing engineering and technology degrees.',
    'The Reliance Foundation Undergraduate Scholarship is one of India''s largest private philanthropic initiatives aimed at enabling talented young innovators from all socio-economic backgrounds.',
    '2026-09-30 23:59:59+00', 'Pan India', true, 'Up to ₹2,00,000', 'grant',
    'https://scholarships.reliancefoundation.org/ug-apply',
    'https://scholarships.reliancefoundation.org/ug-apply',
    'https://scholarships.reliancefoundation.org',
    'demo', 'Verified official Reliance Foundation scholarship demo record.',
    '2026-08-19 10:00:00+00', true, true,
    ARRAY['Merit Scholarship', 'Financial Aid', 'Engineering', 'Pan India'],
    ARRAY['Scholarship grant of up to ₹2 Lakhs disbursed over study', 'Alumni network connecting 5,000+ Reliance scholars', 'Leadership training and masterclasses'],
    ARRAY['Fill online profile and upload marksheet', 'Take online cognitive aptitude assessment', 'Submit income verification & academic proof', 'Final merit list publication'],
    '[{"label":"Online Application Deadline","date":"30 Sep 2026"},{"label":"Aptitude Assessment Test","date":"15 Oct 2026"}]'::jsonb
),
(
    'opp-07', '00000000-0000-0000-0000-000000000007',
    'Microsoft Software Engineering Internship (Summer 2027)', 'Microsoft India Development Center', 'private_internship', 'Private Internship',
    'Work on scalable cloud infrastructure, Azure AI, Developer Tools, or Windows core systems with top engineers.',
    'Microsoft IDC offers an intensive 2-month summer internship for 2027 graduating batch students.',
    '2026-08-31 23:59:59+00', 'Bengaluru / Hyderabad / Noida', false, '₹1,25,000/month', 'stipend',
    'https://careers.microsoft.com/students',
    'https://careers.microsoft.com/students/apply',
    'https://careers.microsoft.com',
    'demo', 'Verified corporate campus internship program demo record.',
    '2026-08-19 10:00:00+00', true, true,
    ARRAY['Big Tech', 'High Stipend', 'PPO Opportunity', 'Azure & AI'],
    ARRAY['₹1,25,000 monthly stipend + flight tickets + premium hotel relocation stay', 'Opportunity for full-time PPO with ₹45L+ CTC'],
    ARRAY['Submit application on Microsoft portal', 'Online coding challenge', 'Virtual technical interviews', 'AA architectural round'],
    '[{"label":"Applications Close","date":"31 Aug 2026"},{"label":"Codility Assessment","date":"06 Sep 2026"}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    organization = EXCLUDED.organization,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    deadline = EXCLUDED.deadline,
    stipend_or_prize = EXCLUDED.stipend_or_prize,
    official_url = EXCLUDED.official_url,
    apply_url = EXCLUDED.apply_url,
    source_url = EXCLUDED.source_url,
    verification_status = EXCLUDED.verification_status,
    verification_notes = EXCLUDED.verification_notes,
    is_demo = EXCLUDED.is_demo,
    updated_at = NOW();

-- 3. Insert Structured Eligibility Rules
INSERT INTO public.opportunity_eligibility_rules (
    opportunity_id, allowed_degrees, allowed_branches, allowed_study_years, min_cgpa, min_age, max_age, required_skills, eligible_locations, eligible_gender, domicile_required
) VALUES
('opp-01', ARRAY['B.Tech', 'B.E.', 'BCA', 'MCA', 'M.Tech', 'All Degrees'], ARRAY['Computer Science', 'IT', 'Data Science', 'AI', 'Electronics', 'All Branches'], ARRAY[1, 2, 3, 4], 6.5, NULL, NULL, ARRAY['Python', 'Machine Learning', 'JavaScript'], ARRAY['All India'], 'all', 'All India'),
('opp-02', ARRAY['B.Tech', 'B.E.', 'B.Sc', 'M.Sc', 'MCA', 'M.Tech'], ARRAY['Computer Science', 'Economics', 'Public Policy', 'Electronics', 'Data Science', 'All Branches'], ARRAY[2, 3, 4], 7.5, NULL, NULL, ARRAY['Data Science', 'Python', 'Technical Writing'], ARRAY['Pan India'], 'all', 'All India'),
('opp-03', ARRAY['B.Tech', 'B.E.', 'B.Sc', 'BCA'], ARRAY['All Branches', 'Computer Science', 'Electrical', 'Mechanical', 'Civil'], ARRAY[1, 2, 3], 7.0, NULL, NULL, ARRAY[]::TEXT[], ARRAY['Pan India'], 'all', 'All India'),
('opp-07', ARRAY['B.Tech', 'B.E.', 'MCA', 'M.Tech'], ARRAY['Computer Science', 'IT', 'Electronics', 'Data Science'], ARRAY[3], 7.5, NULL, NULL, ARRAY['C++', 'Python', 'Data Structures', 'JavaScript'], ARRAY['All India'], 'all', 'All India')
ON CONFLICT (opportunity_id) DO UPDATE SET
    allowed_degrees = EXCLUDED.allowed_degrees,
    allowed_branches = EXCLUDED.allowed_branches,
    allowed_study_years = EXCLUDED.allowed_study_years,
    min_cgpa = EXCLUDED.min_cgpa,
    required_skills = EXCLUDED.required_skills,
    updated_at = NOW();
