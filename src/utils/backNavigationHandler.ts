import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export interface BackNavigationContext {
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
  isSessionLocked?: boolean;
  canGoBack?: boolean;
  onGoBack?: () => void;
  isRootView?: boolean;
}

export type BackActionType = 'DISMISS_MODAL' | 'DISMISS_DRAWER' | 'LOCKED_SESSION_BLOCKED' | 'NAVIGATE_BACK' | 'EXIT_APP';

export function resolveBackNavigationAction(ctx: BackNavigationContext): { action: BackActionType; handled: boolean } {
  // 1. If session is locked, prevent bypassing the lock screen
  if (ctx.isSessionLocked) {
    return { action: 'LOCKED_SESSION_BLOCKED', handled: true };
  }

  // 2. If a modal is open, top priority is closing the modal
  if (ctx.isModalOpen && ctx.onCloseModal) {
    ctx.onCloseModal();
    return { action: 'DISMISS_MODAL', handled: true };
  }

  // 3. If a mobile drawer / sidebar is open, close the drawer
  if (ctx.isDrawerOpen && ctx.onCloseDrawer) {
    ctx.onCloseDrawer();
    return { action: 'DISMISS_DRAWER', handled: true };
  }

  // 4. If there is a previous view/tab in stack
  if (ctx.canGoBack && ctx.onGoBack) {
    ctx.onGoBack();
    return { action: 'NAVIGATE_BACK', handled: true };
  }

  // 5. If on root view with nothing to dismiss, exit or background app
  if (ctx.isRootView) {
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.exitApp();
    }
    return { action: 'EXIT_APP', handled: false };
  }

  return { action: 'EXIT_APP', handled: false };
}

let backButtonListenerRegistered = false;

export function setupHardwareBackNavigation(getContext: () => BackNavigationContext): () => void {
  if (!Capacitor.isNativePlatform()) {
    // Return no-op cleanup for non-native web environments
    return () => {};
  }

  if (backButtonListenerRegistered) {
    return () => {};
  }

  backButtonListenerRegistered = true;

  const listenerHandlePromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    const ctx = getContext();
    resolveBackNavigationAction({
      ...ctx,
      canGoBack: ctx.canGoBack ?? canGoBack,
    });
  });

  return () => {
    listenerHandlePromise.then((handle) => handle.remove());
    backButtonListenerRegistered = false;
  };
}
