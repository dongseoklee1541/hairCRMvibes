'use client';

import { useCallback, useEffect, useRef } from 'react';

const GUARD_KEY = '__hairCrmUnsavedChangesGuard';
const IDLE = 'idle';
const ALLOWING_TRAVERSE = 'allowing-traverse';

function getGuard() {
  return window[GUARD_KEY];
}

export function useUnsavedChangesGuard({ isDirty, message }) {
  const ownerRef = useRef(null);

  if (ownerRef.current === null) {
    ownerRef.current = {};
  }

  useEffect(() => {
    const guard = getGuard();
    if (!guard) return undefined;

    const owner = ownerRef.current;
    guard.owner = owner;
    guard.dirty = isDirty;
    guard.message = message;

    return () => {
      if (guard.owner !== owner) return;
      guard.owner = null;
      guard.dirty = false;
      guard.phase = IDLE;
      if (guard.allowTimer !== null) {
        window.clearTimeout(guard.allowTimer);
        guard.allowTimer = null;
      }
    };
  }, [isDirty, message]);

  return useCallback((action, options = {}) => {
    const guard = getGuard();
    const {
      prompt = true,
      traverse = false,
      message: overrideMessage = guard?.message,
    } = options;

    if (!guard) {
      action();
      return true;
    }

    if (guard.owner !== ownerRef.current) return false;
    if (guard.phase !== IDLE) return false;
    if (prompt && guard.dirty && !window.confirm(overrideMessage)) return false;

    if (traverse) {
      if (guard.beginAllowedTraversal) {
        guard.beginAllowedTraversal();
      } else {
        guard.phase = ALLOWING_TRAVERSE;
      }
    }

    try {
      action();
      return true;
    } catch (error) {
      if (traverse) {
        guard.phase = IDLE;
        if (guard.allowTimer !== null) {
          window.clearTimeout(guard.allowTimer);
          guard.allowTimer = null;
        }
      }
      throw error;
    }
  }, []);
}
