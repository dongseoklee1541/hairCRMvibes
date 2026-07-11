import Script from 'next/script';

const bootstrapSource = `
(() => {
  const key = '__hairCrmUnsavedChangesGuard';
  const historyMetaKey = '__hairCrmNavGuardV1';
  if (window[key]) return;

  const rawPushState = window.history.pushState.bind(window.history);
  const rawReplaceState = window.history.replaceState.bind(window.history);
  const readHistoryIndex = (state) => {
    const value = state?.[historyMetaKey]?.index;
    return Number.isInteger(value) ? value : null;
  };
  const withHistoryIndex = (state, index) => ({
    ...(state && typeof state === 'object' && !Array.isArray(state) ? state : {}),
    [historyMetaKey]: { index },
  });
  let historyIndex = readHistoryIndex(window.history.state) ?? 0;

  const guard = {
    owner: null,
    dirty: false,
    message: '',
    phase: 'idle',
    allowTimer: null,
  };

  const clearAllowTimer = () => {
    if (guard.allowTimer === null) return;
    window.clearTimeout(guard.allowTimer);
    guard.allowTimer = null;
  };

  const beginAllowedTraversal = () => {
    clearAllowTimer();
    guard.phase = 'allowing-traverse';
    guard.allowTimer = window.setTimeout(() => {
      if (guard.phase === 'allowing-traverse') {
        guard.phase = 'idle';
      }
      guard.allowTimer = null;
    }, 1000);
  };

  guard.beginAllowedTraversal = beginAllowedTraversal;

  window[key] = guard;

  rawReplaceState(
    withHistoryIndex(window.history.state, historyIndex),
    '',
    window.location.href
  );

  window.history.pushState = function pushState(state, title, url) {
    const nextIndex = historyIndex + 1;
    const result = rawPushState(withHistoryIndex(state, nextIndex), title, url);
    historyIndex = nextIndex;
    return result;
  };

  window.history.replaceState = function replaceState(state, title, url) {
    return rawReplaceState(withHistoryIndex(state, historyIndex), title, url);
  };

  window.addEventListener('beforeunload', (event) => {
    if (!guard.dirty || guard.phase === 'allowing-traverse') return;
    event.preventDefault();
    event.returnValue = '';
  });

  window.navigation?.addEventListener('navigate', (event) => {
    if (
      event.navigationType !== 'traverse' ||
      guard.phase !== 'idle' ||
      !guard.dirty ||
      !event.cancelable
    ) {
      return;
    }

    if (!window.confirm(guard.message)) {
      event.preventDefault();
      return;
    }

    beginAllowedTraversal();
  });

  window.addEventListener('popstate', (event) => {
    const destinationIndex = readHistoryIndex(event.state);

    if (guard.phase === 'allowing-traverse') {
      clearAllowTimer();
      historyIndex = destinationIndex ?? historyIndex;
      guard.phase = 'idle';
      return;
    }

    if (guard.phase === 'restoring') {
      event.stopImmediatePropagation();
      historyIndex = destinationIndex ?? historyIndex;
      guard.phase = 'idle';
      return;
    }

    if (!guard.dirty || window.confirm(guard.message)) {
      historyIndex = destinationIndex ?? historyIndex;
      return;
    }

    if (destinationIndex === null) return;

    const restoreDelta = historyIndex - destinationIndex;
    if (restoreDelta === 0) return;

    event.stopImmediatePropagation();
    historyIndex = destinationIndex;
    guard.phase = 'restoring';
    window.history.go(restoreDelta);
  });

  window.addEventListener('pageshow', () => {
    const shownIndex = readHistoryIndex(window.history.state);
    historyIndex = shownIndex ?? historyIndex;
    clearAllowTimer();
    guard.phase = 'idle';
  });
})();
`;

export default function UnsavedChangesGuardBootstrap() {
  return (
    <Script id="hair-crm-unsaved-changes-guard" strategy="beforeInteractive">
      {bootstrapSource}
    </Script>
  );
}
