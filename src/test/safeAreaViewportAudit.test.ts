import fs from 'fs';
import path from 'path';
import { test, assert } from 'vitest';

test('1. Audit index.html for viewport-fit=cover and width=device-width', () => {
  const rootDir = process.cwd();
  const indexHtmlPath = path.resolve(rootDir, 'index.html');
  const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

  assert(
    indexHtmlContent.includes('viewport-fit=cover'),
    'index.html contains viewport-fit=cover in meta viewport tag'
  );
  assert(
    indexHtmlContent.includes('width=device-width'),
    'index.html contains width=device-width in meta viewport tag'
  );
});

test('2. Audit src/index.css for Safe-Area CSS Tokens and Viewport rules', () => {
  const rootDir = process.cwd();
  const indexCssPath = path.resolve(rootDir, 'src/index.css');
  const indexCssContent = fs.readFileSync(indexCssPath, 'utf8');

  assert(
    indexCssContent.includes('--sat: env(safe-area-inset-top, 0px);'),
    'src/index.css defines --sat safe-area top token with 0px fallback'
  );
  assert(
    indexCssContent.includes('--sab: env(safe-area-inset-bottom, 0px);'),
    'src/index.css defines --sab safe-area bottom token with 0px fallback'
  );
  assert(
    indexCssContent.includes('--sal: env(safe-area-inset-left, 0px);'),
    'src/index.css defines --sal safe-area left token with 0px fallback'
  );
  assert(
    indexCssContent.includes('--sar: env(safe-area-inset-right, 0px);'),
    'src/index.css defines --sar safe-area right token with 0px fallback'
  );
  assert(
    indexCssContent.includes('min-height: 100dvh;'),
    'src/index.css specifies modern dynamic viewport height min-height: 100dvh;'
  );
  assert(
    indexCssContent.includes('.pt-safe') &&
    indexCssContent.includes('.pb-safe') &&
    indexCssContent.includes('.pl-safe') &&
    indexCssContent.includes('.pr-safe') &&
    indexCssContent.includes('.p-safe'),
    'src/index.css provides reusable standards-compliant safe-area utility classes'
  );
});

test('3. Audit src/components/Header.tsx for Sticky Header Safe-Area Inset', () => {
  const rootDir = process.cwd();
  const headerPath = path.resolve(rootDir, 'src/components/Header.tsx');
  const headerContent = fs.readFileSync(headerPath, 'utf8');

  assert(
    headerContent.includes('pt-[env(safe-area-inset-top,0px)]') &&
    headerContent.includes('pl-[env(safe-area-inset-left,0px)]') &&
    headerContent.includes('pr-[env(safe-area-inset-right,0px)]'),
    'src/components/Header.tsx applies safe-area top and side insets to sticky header'
  );
});

test('4. Audit src/components/Sidebar.tsx for Mobile Drawer Safe-Area Inset', () => {
  const rootDir = process.cwd();
  const sidebarPath = path.resolve(rootDir, 'src/components/Sidebar.tsx');
  const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');

  assert(
    sidebarContent.includes('pt-[max(0.875rem,env(safe-area-inset-top,0px))]') ||
    sidebarContent.includes('env(safe-area-inset-top,0px)'),
    'src/components/Sidebar.tsx handles safe-area top in mobile drawer header'
  );
  assert(
    sidebarContent.includes('pb-[max(0.75rem,calc(0.75rem+env(safe-area-inset-bottom,0px)))]') ||
    sidebarContent.includes('env(safe-area-inset-bottom,0px)'),
    'src/components/Sidebar.tsx handles safe-area bottom in mobile drawer footer'
  );
});

test('5. Audit src/components/MobileBottomNav.tsx for Bottom Safe-Area Insets', () => {
  const rootDir = process.cwd();
  const mobileNavPath = path.resolve(rootDir, 'src/components/MobileBottomNav.tsx');
  const mobileNavContent = fs.readFileSync(mobileNavPath, 'utf8');

  assert(
    mobileNavContent.includes('pb-[env(safe-area-inset-bottom,0px)]'),
    'src/components/MobileBottomNav.tsx applies safe-area bottom padding to fixed nav bar'
  );
  assert(
    mobileNavContent.includes('pb-[max(2rem,calc(1.5rem+env(safe-area-inset-bottom,0px)))]'),
    'src/components/MobileBottomNav.tsx applies safe-area bottom padding to quick action bottom sheet'
  );
});

test('6. Audit src/components/LoginPage.tsx for Safe-Area Insets', () => {
  const rootDir = process.cwd();
  const loginPath = path.resolve(rootDir, 'src/components/LoginPage.tsx');
  const loginContent = fs.readFileSync(loginPath, 'utf8');

  assert(
    loginContent.includes('env(safe-area-inset-top,0px)') &&
    loginContent.includes('env(safe-area-inset-bottom,0px)'),
    'src/components/LoginPage.tsx protects full-screen container with safe-area insets'
  );
});

test('7. Audit src/App.tsx Loading / Synchronisation Screen for Safe-Area Insets', () => {
  const rootDir = process.cwd();
  const appPath = path.resolve(rootDir, 'src/App.tsx');
  const appContent = fs.readFileSync(appPath, 'utf8');

  assert(
    appContent.includes('env(safe-area-inset-top,0px)') &&
    appContent.includes('role="status"'),
    'src/App.tsx loading/synchronisation screen applies safe-area top inset'
  );
});

test('8. Audit Modals for Safe-Area Insets', () => {
  const rootDir = process.cwd();
  const globalSearchPath = path.resolve(rootDir, 'src/components/GlobalSearchModal.tsx');
  const globalSearchContent = fs.readFileSync(globalSearchPath, 'utf8');
  assert(
    globalSearchContent.includes('env(safe-area-inset-top,0px)'),
    'src/components/GlobalSearchModal.tsx backdrop incorporates safe-area top inset'
  );

  const learnerProfilePath = path.resolve(rootDir, 'src/components/LearnerProfileModal.tsx');
  const learnerProfileContent = fs.readFileSync(learnerProfilePath, 'utf8');
  assert(
    learnerProfileContent.includes('env(safe-area-inset-top,0px)'),
    'src/components/LearnerProfileModal.tsx backdrop incorporates safe-area top inset'
  );

  const schoolProfilePath = path.resolve(rootDir, 'src/components/SchoolProfileModal.tsx');
  const schoolProfileContent = fs.readFileSync(schoolProfilePath, 'utf8');
  assert(
    schoolProfileContent.includes('env(safe-area-inset-top,0px)'),
    'src/components/SchoolProfileModal.tsx backdrop incorporates safe-area top inset'
  );

  const sessionLockPath = path.resolve(rootDir, 'src/components/SessionLockModal.tsx');
  const sessionLockContent = fs.readFileSync(sessionLockPath, 'utf8');
  assert(
    sessionLockContent.includes('env(safe-area-inset-top,0px)'),
    'src/components/SessionLockModal.tsx backdrop incorporates safe-area top inset'
  );
});

test('9. Audit NotificationContainer for Safe-Area Inset', () => {
  const rootDir = process.cwd();
  const notifContextPath = path.resolve(rootDir, 'src/contexts/NotificationContext.tsx');
  const notifContextContent = fs.readFileSync(notifContextPath, 'utf8');
  assert(
    notifContextContent.includes('top-[calc(1rem+env(safe-area-inset-top,0px))]') &&
    notifContextContent.includes('aria-label="System Notifications"'),
    'src/contexts/NotificationContext.tsx NotificationContainer incorporates safe-area top inset'
  );
});
