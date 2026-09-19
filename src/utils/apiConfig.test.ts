import { getApiBaseUrl, buildApiUrl, isNativeEnvironment } from './apiConfig';

console.log('--- RUNNING API CONFIG & URL ABSTRACTION TESTS ---');

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`✓ PASS: ${message}`);
  } else {
    console.error(`✗ FAIL: ${message}`);
  }
}

// Test 1: Standard same-origin web resolution (VITE_API_BASE_URL empty)
delete process.env.VITE_API_BASE_URL;
const defaultUrl1 = buildApiUrl('/api/admin/create-teacher');
assert(defaultUrl1 === '/api/admin/create-teacher', `Default resolution should be '/api/admin/create-teacher', got '${defaultUrl1}'`);

// Test 2: Path missing leading slash
const defaultUrl2 = buildApiUrl('api/auth/resolve-identifier');
assert(defaultUrl2 === '/api/auth/resolve-identifier', `Missing leading slash should normalize to '/api/auth/resolve-identifier', got '${defaultUrl2}'`);

// Test 3: Query parameters preserved
const defaultUrl3 = buildApiUrl('/api/learner/exam-ranking?exam_id=exam_test_123&token=test_tok');
assert(
  defaultUrl3 === '/api/learner/exam-ranking?exam_id=exam_test_123&token=test_tok',
  `Query params preserved in URL: '${defaultUrl3}'`
);

// Test 4: Web Browser Simulation — VITE_API_BASE_URL must NOT override same-origin web behaviour
(globalThis as any).window = {
  location: { protocol: 'https:', hostname: 'ais-dev-rok3qblhnjdijvy5suvgfe-428116850094.europe-west2.run.app' },
  localStorage: { getItem: () => null, removeItem: () => null, setItem: () => null },
};
process.env.VITE_API_BASE_URL = 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app';

assert(!isNativeEnvironment(), 'Web browser is correctly recognized as non-native');
assert(getApiBaseUrl() === '', `Web browser getApiBaseUrl() must return empty string '' even when VITE_API_BASE_URL is set, got '${getApiBaseUrl()}'`);
const webUpdateTeacherUrl = buildApiUrl('/api/admin/update-teacher');
assert(
  webUpdateTeacherUrl === '/api/admin/update-teacher',
  `Web browser buildApiUrl('/api/admin/update-teacher') must produce same-origin relative '/api/admin/update-teacher', got '${webUpdateTeacherUrl}'`
);

// Test 5: Native Capacitor Simulation — Configured VITE_API_BASE_URL is used for native app
(globalThis as any).window = {
  location: { protocol: 'capacitor:', hostname: 'localhost' },
  localStorage: { getItem: () => null, removeItem: () => null, setItem: () => null },
};
process.env.VITE_API_BASE_URL = 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/';

assert(isNativeEnvironment(), 'Capacitor protocol is recognized as native environment');
const nativeRemoteUrl1 = buildApiUrl('/api/admin/create-teacher');
assert(
  nativeRemoteUrl1 === 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/api/admin/create-teacher',
  `Native remote URL with trailing slash cleaned: '${nativeRemoteUrl1}'`
);

const nativeRemoteUrl2 = buildApiUrl('api/learner/class-teachers');
assert(
  nativeRemoteUrl2 === 'https://ais-dev-qp2jvx7kxfynygoizqe7hn-200552382270.europe-west2.run.app/api/learner/class-teachers',
  `Native remote URL without leading slash normalized: '${nativeRemoteUrl2}'`
);

// Test 6: Native Capacitor Simulation with empty VITE_API_BASE_URL produces relative path
process.env.VITE_API_BASE_URL = '';
const nativeResetUrl = buildApiUrl('/api/admin/delete-learner');
assert(nativeResetUrl === '/api/admin/delete-learner', `Native reset to empty env produces relative URL: '${nativeResetUrl}'`);

// Test 7: Native Capacitor Simulation — Rejection of obsolete backend URL in environment
process.env.VITE_API_BASE_URL = 'https://ais-dev-vjz5hjkvehacv2o4u33hs2-1003257184143.europe-west2.run.app';
const rejectedObsoleteUrl = buildApiUrl('/api/admin/update-teacher');
assert(rejectedObsoleteUrl === '/api/admin/update-teacher', `Obsolete backend URL in native is safely rejected and falls back to relative, got '${rejectedObsoleteUrl}'`);

// Cleanup globalThis.window & process.env
delete (globalThis as any).window;
delete process.env.VITE_API_BASE_URL;

console.log(`\nTEST SUMMARY: ${passed}/${total} tests passed.`);
if (passed !== total) {
  process.exit(1);
}

