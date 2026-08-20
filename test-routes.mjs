import http from 'http';

const routes = [
  { path: '/', expect: 'You don\'t find opportunities' },
  { path: '/login', expect: 'Welcome back to Opportune' },
  { path: '/signup', expect: 'Create your student profile' },
  { path: '/onboarding', expect: 'What are you currently studying' },
  { path: '/dashboard', expect: 'Personalized Discovery Feed' },
  { path: '/explore', expect: 'Explore Opportunities' },
  { path: '/opportunities/real-isro-2026-001', expect: 'ISRO Scientist' },
  { path: '/opportunities/real-meity-2026-002', expect: 'Digital India AI' },
  { path: '/saved', expect: 'Saved Opportunities' },
  { path: '/applications', expect: 'Application Tracker' },
  { path: '/profile', expect: 'My Profile &amp; Eligibility' },
  { path: '/settings', expect: 'Settings &amp; Notifications' },
  { path: '/admin/review', expect: 'Opportunity Review' },
];

async function checkRoute(route) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${route.path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const hasExpect = data.includes(route.expect) || data.toLowerCase().includes(route.expect.toLowerCase());
        resolve({
          path: route.path,
          status: res.statusCode,
          passed: res.statusCode === 200 && hasExpect,
          contentLength: data.length,
          preview: data.substring(0, 100).replace(/\s+/g, ' ')
        });
      });
    }).on('error', (err) => {
      resolve({ path: route.path, status: 'ERROR', passed: false, error: err.message });
    });
  });
}

async function run() {
  console.log('Testing all Next.js App Router endpoints...\n');
  let allPass = true;
  for (const r of routes) {
    const res = await checkRoute(r);
    if (res.passed) {
      console.log(`✅ [200 OK] ${r.path.padEnd(25)} (Bytes: ${res.contentLength})`);
    } else {
      allPass = false;
      console.log(`❌ [FAILED] ${r.path.padEnd(25)} Status: ${res.status}`);
    }
  }
  console.log('\nResult: ' + (allPass ? 'ALL ROUTES PASSED VERIFICATION! 🚀' : 'SOME ROUTES FAILED'));
}

run();
