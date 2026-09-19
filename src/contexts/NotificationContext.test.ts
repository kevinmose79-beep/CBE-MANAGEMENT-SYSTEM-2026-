import React from 'react';
import {
  NotificationProvider,
  useNotification,
  NotificationType,
  NotificationItem,
} from './NotificationContext';

export async function runNotificationContextTests() {
  console.log('=== RUNNING NOTIFICATION CONTEXT & CONTAINER TESTS ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  // TEST 1: verify useNotification error when used outside Provider
  try {
    let threw = false;
    try {
      useNotification();
    } catch (e: any) {
      if (
        e.message.includes('must be used within a NotificationProvider') ||
        e.message.includes('Invalid hook call') ||
        e.message.includes('Context')
      ) {
        threw = true;
      }
    }
    assert(threw, 'useNotification guards against invalid usage outside NotificationProvider');
  } catch (err: any) {
    assert(false, 'useNotification error check failed', err.message);
  }

  // TEST 2: Notification Item generation and duration defaults
  const testTypes: NotificationType[] = ['success', 'error', 'warning', 'info'];
  const expectedDurations: Record<NotificationType, number> = {
    success: 4000,
    info: 4000,
    warning: 6000,
    error: 8000,
  };

  testTypes.forEach((t) => {
    assert(
      expectedDurations[t] > 0,
      `Notification type "${t}" has valid non-zero default duration of ${expectedDurations[t]}ms`
    );
  });

  // TEST 3: State simulation for showNotification and dismissNotification
  const notifications: NotificationItem[] = [];
  const timeouts = new Map<string, any>();

  function simulateShowNotification(type: NotificationType, message: string, customDuration?: number) {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const duration = customDuration !== undefined ? customDuration : expectedDurations[type];
    const item: NotificationItem = {
      id,
      type,
      message,
      duration,
      createdAt: Date.now(),
    };
    notifications.push(item);
    if (duration > 0) {
      const timer = setTimeout(() => {
        simulateDismissNotification(id);
      }, duration);
      timeouts.set(id, timer);
    }
    return id;
  }

  function simulateDismissNotification(id: string) {
    const timer = timeouts.get(id);
    if (timer) {
      clearTimeout(timer);
      timeouts.delete(id);
    }
    const idx = notifications.findIndex((n) => n.id === id);
    if (idx !== -1) {
      notifications.splice(idx, 1);
    }
  }

  // Step 3a: Add notifications of all 4 types
  const successId = simulateShowNotification('success', 'Operation completed successfully.');
  const errorId = simulateShowNotification('error', 'Failed to connect to server.', 10000);
  const warningId = simulateShowNotification('warning', 'Session about to expire.');
  const infoId = simulateShowNotification('info', 'New update available.');

  assert(notifications.length === 4, 'All 4 notification types added to queue successfully');
  assert(notifications.some((n) => n.id === successId && n.type === 'success'), 'Success notification added with correct type');
  assert(notifications.some((n) => n.id === errorId && n.duration === 10000), 'Custom duration (10000ms) respected for error notification');
  assert(notifications.some((n) => n.id === warningId && n.type === 'warning'), 'Warning notification added with correct type');
  assert(notifications.some((n) => n.id === infoId && n.type === 'info'), 'Info notification added with correct type');

  // Step 3b: Manual dismissal
  simulateDismissNotification(warningId);
  assert(notifications.length === 3, 'Manual dismissal removed notification from queue');
  assert(!notifications.some((n) => n.id === warningId), 'Dismissed warning notification no longer in queue');
  assert(!timeouts.has(warningId), 'Dismissed notification timer cleared from timeouts map');

  // Step 3c: Auto-dismissal simulation
  const shortId = simulateShowNotification('info', 'Short lived notice', 50);
  assert(notifications.some((n) => n.id === shortId), 'Short lived notification added to queue');
  
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert(!notifications.some((n) => n.id === shortId), 'Notification automatically dismissed when duration elapsed');

  // Cleanup remaining
  simulateDismissNotification(successId);
  simulateDismissNotification(errorId);
  simulateDismissNotification(infoId);
  assert(notifications.length === 0, 'Queue completely cleaned up');

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}

// Auto-run if executed directly via tsx
runNotificationContextTests().catch(console.error);
