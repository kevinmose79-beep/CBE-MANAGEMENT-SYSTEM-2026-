import { resolveBackNavigationAction, BackNavigationContext } from './backNavigationHandler';

console.log('--- RUNNING ANDROID BACK NAVIGATION HANDLER TESTS ---');

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

// Test 1: Locked Session Blocks Back Action
let sessionLockedResult = resolveBackNavigationAction({
  isSessionLocked: true,
  isModalOpen: true,
  isDrawerOpen: true,
  canGoBack: true,
});
assert(
  sessionLockedResult.action === 'LOCKED_SESSION_BLOCKED' && sessionLockedResult.handled === true,
  'Locked session intercept: Back navigation is blocked when session is locked'
);

// Test 2: Modal Open -> Closes Modal (Top Priority)
const test2State = { modalClosed: false };
let modalResult = resolveBackNavigationAction({
  isModalOpen: true,
  onCloseModal: () => { test2State.modalClosed = true; },
  isDrawerOpen: true,
  onCloseDrawer: () => {},
  canGoBack: true,
});
assert(
  modalResult.action === 'DISMISS_MODAL' && modalResult.handled === true && test2State.modalClosed === true,
  'Modal open priority: Closes active modal dialog first'
);

// Test 3: Drawer Open -> Closes Drawer
const test3State = { drawerClosed: false };
let drawerResult = resolveBackNavigationAction({
  isModalOpen: false,
  isDrawerOpen: true,
  onCloseDrawer: () => { test3State.drawerClosed = true; },
  canGoBack: true,
});
assert(
  drawerResult.action === 'DISMISS_DRAWER' && drawerResult.handled === true && test3State.drawerClosed === true,
  'Drawer open: Closes navigation drawer when modal is not active'
);

// Test 4: Previous Tab Exists -> Returns to Previous Tab
const test4State = { navigatedBack: false };
let navResult = resolveBackNavigationAction({
  isModalOpen: false,
  isDrawerOpen: false,
  canGoBack: true,
  onGoBack: () => { test4State.navigatedBack = true; },
});
assert(
  navResult.action === 'NAVIGATE_BACK' && navResult.handled === true && test4State.navigatedBack === true,
  'History navigation: Navigates back to previous view when history stack exists'
);

// Test 5: Root View -> Exits/Backgrounds App
let rootResult = resolveBackNavigationAction({
  isModalOpen: false,
  isDrawerOpen: false,
  canGoBack: false,
  isRootView: true,
});
assert(
  rootResult.action === 'EXIT_APP' && rootResult.handled === false,
  'Root view: Yields to system/exits application when on root dashboard'
);

console.log(`\nBACK NAVIGATION TEST SUMMARY: ${passed}/${total} assertions passed.`);
if (passed !== total) {
  process.exit(1);
}
