export type NavigationLockWindow = {
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
  history: {
    pushState(data: unknown, unused: string, url?: string | null): void;
  };
  location: {
    href: string;
  };
};

export function createBackNavigationGuard(
  win: NavigationLockWindow,
  shouldStayLocked: () => boolean,
  onUnlock?: () => void
): () => void {
  if (!shouldStayLocked()) {
    onUnlock?.();
    return () => {};
  }

  const handler = () => {
    if (shouldStayLocked()) {
      win.history.pushState(null, "", win.location.href);
    } else {
      onUnlock?.();
      win.removeEventListener("popstate", handler);
    }
  };

  win.history.pushState(null, "", win.location.href);
  win.addEventListener("popstate", handler);

  return () => {
    win.removeEventListener("popstate", handler);
  };
}
