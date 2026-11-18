import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import type {
  AllowedEmailRecord,
  AssetDefinition,
  UserRole,
  UserWatchlistDoc,
} from '../types/market';

export const BOOTSTRAPPED_ADMINS = [
  'sunnyguy664@gmail.com',
  'sandipyashpal@gmail.com',
] as const;

const DEFAULT_FAVORITES = ['USDCHF=X', 'NVDA', 'T.TO', 'XAUUSD'];

export type AuthStatus =
  | 'loading'
  | 'signed_out'
  | 'checking'
  | 'unauthorized'
  | 'authorized';

function sanitizeAsset(asset: AssetDefinition): AssetDefinition {
  const symbol = asset.symbol.trim().toUpperCase().slice(0, 24);
  const yahooSymbol = (asset.yahooSymbol || symbol).trim().toUpperCase().slice(0, 24);
  const displaySymbol = (asset.displaySymbol || symbol).trim().toUpperCase().slice(0, 24);
  const name = (asset.name || displaySymbol).trim().slice(0, 80);
  return {
    symbol,
    yahooSymbol,
    displaySymbol,
    name: name || displaySymbol,
    type: asset.type,
  };
}

export function isBootstrappedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return (BOOTSTRAPPED_ADMINS as readonly string[]).includes(lower);
}

export function useSignalGapAuth() {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [customAssets, setCustomAssets] = useState<AssetDefinition[]>([]);
  const [removedSymbols, setRemovedSymbols] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVORITES);
  const [watchlistReady, setWatchlistReady] = useState(false);

  const [allowedEmails, setAllowedEmails] = useState<AllowedEmailRecord[]>([]);

  if (fatalError) {
    throw fatalError;
  }

  // Listen to Firebase Auth state and verify email allowlist + role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setCustomAssets([]);
        setRemovedSymbols([]);
        setFavorites(DEFAULT_FAVORITES);
        setAllowedEmails([]);
        setWatchlistReady(false);
        setStatus('signed_out');
        return;
      }

      const email = (firebaseUser.email || '').trim().toLowerCase();
      if (!email || !firebaseUser.emailVerified) {
        setUser(firebaseUser);
        setRole(null);
        setStatus('unauthorized');
        return;
      }

      setUser(firebaseUser);
      setStatus('checking');

      try {
        if (isBootstrappedAdminEmail(email)) {
          setRole('admin');
          setStatus('authorized');

          // Ensure both bootstrapped admins appear in allowed_emails
          for (const adminEmail of BOOTSTRAPPED_ADMINS) {
            const adminRef = doc(db, 'allowed_emails', adminEmail);
            try {
              const snap = await getDoc(adminRef);
              if (!snap.exists()) {
                await setDoc(adminRef, {
                  email: adminEmail,
                  role: 'admin',
                  addedBy: email,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
            } catch {
              // Ignore race if created concurrently
            }
          }
          return;
        }

        const allowRef = doc(db, 'allowed_emails', email);
        const allowSnap = await getDoc(allowRef);
        if (!allowSnap.exists()) {
          setRole(null);
          setStatus('unauthorized');
          return;
        }

        const data = allowSnap.data() as AllowedEmailRecord;
        const resolvedRole: UserRole = data.role === 'admin' ? 'admin' : 'member';
        setRole(resolvedRole);
        setStatus('authorized');
      } catch (err) {
        try {
          handleFirestoreError(err, 'get', `allowed_emails/${email}`);
        } catch (wrapped) {
          setFatalError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const watchlistId =
    status === 'authorized' && user && role
      ? role === 'admin'
        ? 'shared_admin'
        : user.uid
      : null;

  // Real-time Firestore listener for shared_admin (admins) or personal UID watchlist (members)
  useEffect(() => {
    if (!watchlistId || !user || !role) {
      setWatchlistReady(false);
      return;
    }

    const email = (user.email || '').trim().toLowerCase();
    const watchlistPath = `watchlists/${watchlistId}`;
    const watchlistRef = doc(db, 'watchlists', watchlistId);

    const unsubscribe = onSnapshot(
      watchlistRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          const initialDoc: UserWatchlistDoc = {
            ownerId: watchlistId,
            scope: role === 'admin' ? 'shared_admin' : 'personal',
            customAssets: [],
            removedSymbols: [],
            favorites: DEFAULT_FAVORITES,
            updatedBy: email,
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(watchlistRef, initialDoc);
          } catch (err) {
            try {
              handleFirestoreError(err, 'create', watchlistPath);
            } catch (wrapped) {
              setFatalError(
                wrapped instanceof Error ? wrapped : new Error(String(wrapped))
              );
            }
          }
          return;
        }

        const data = snapshot.data() as Partial<UserWatchlistDoc>;
        setCustomAssets(Array.isArray(data.customAssets) ? data.customAssets : []);
        setRemovedSymbols(
          Array.isArray(data.removedSymbols) ? data.removedSymbols : []
        );
        setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
        setWatchlistReady(true);
      },
      (err) => {
        try {
          handleFirestoreError(err, 'get', watchlistPath);
        } catch (wrapped) {
          setFatalError(
            wrapped instanceof Error ? wrapped : new Error(String(wrapped))
          );
        }
      }
    );

    return () => unsubscribe();
  }, [watchlistId, user, role]);

  // Real-time Firestore listener for allowlisted users (admins only)
  useEffect(() => {
    if (status !== 'authorized' || role !== 'admin') {
      setAllowedEmails([]);
      return;
    }

    const q = query(collection(db, 'allowed_emails'), orderBy('email'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: AllowedEmailRecord[] = snap.docs.map(
          (d) => d.data() as AllowedEmailRecord
        );
        setAllowedEmails(list);
      },
      (err) => {
        try {
          handleFirestoreError(err, 'list', 'allowed_emails');
        } catch (wrapped) {
          setFatalError(
            wrapped instanceof Error ? wrapped : new Error(String(wrapped))
          );
        }
      }
    );

    return () => unsubscribe();
  }, [status, role]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In did not complete.';

      if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        setAuthError(
          `Domain "${host}" is not authorized in Firebase Authentication. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (
        code === 'auth/operation-not-allowed' ||
        msg.includes('auth/operation-not-allowed')
      ) {
        setAuthError(
          'Google Sign-In is disabled on this Firebase project. Open Firebase Console → Authentication → Sign-in method → Google → toggle Enable and click Save.'
        );
      } else if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const persistWatchlistFields = useCallback(
    async (
      nextCustom: AssetDefinition[],
      nextRemoved: string[],
      nextFavorites: string[]
    ) => {
      if (!watchlistId || !user) return;
      const email = (user.email || '').trim().toLowerCase();
      const watchlistPath = `watchlists/${watchlistId}`;
      const watchlistRef = doc(db, 'watchlists', watchlistId);

      try {
        await updateDoc(watchlistRef, {
          customAssets: nextCustom.slice(0, 60).map(sanitizeAsset),
          removedSymbols: nextRemoved.slice(0, 50),
          favorites: nextFavorites.slice(0, 80),
          updatedBy: email,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, 'update', watchlistPath);
      }
    },
    [watchlistId, user]
  );

  const addTickerToList = useCallback(
    async (asset: AssetDefinition) => {
      const sanitized = sanitizeAsset(asset);
      const upper = sanitized.symbol.toUpperCase();

      const nextRemoved = removedSymbols.filter((s) => s.toUpperCase() !== upper);
      const filteredCustom = customAssets.filter(
        (c) => c.symbol.toUpperCase() !== upper
      );
      const nextCustom = [...filteredCustom, sanitized];

      await persistWatchlistFields(nextCustom, nextRemoved, favorites);
    },
    [customAssets, removedSymbols, favorites, persistWatchlistFields]
  );

  const removeTickerFromList = useCallback(
    async (symbol: string) => {
      const upper = symbol.trim().toUpperCase();
      const nextCustom = customAssets.filter(
        (c) => c.symbol.toUpperCase() !== upper
      );
      const nextRemoved = removedSymbols.some((s) => s.toUpperCase() === upper)
        ? removedSymbols
        : [...removedSymbols, symbol.trim().slice(0, 24)];
      const nextFavorites = favorites.filter((s) => s.toUpperCase() !== upper);

      await persistWatchlistFields(nextCustom, nextRemoved, nextFavorites);
    },
    [customAssets, removedSymbols, favorites, persistWatchlistFields]
  );

  const toggleFavorite = useCallback(
    async (symbol: string) => {
      const upper = symbol.trim().toUpperCase();
      const exists = favorites.some((s) => s.toUpperCase() === upper);
      const nextFavorites = exists
        ? favorites.filter((s) => s.toUpperCase() !== upper)
        : [...favorites, symbol.trim().slice(0, 24)];

      await persistWatchlistFields(customAssets, removedSymbols, nextFavorites);
    },
    [customAssets, removedSymbols, favorites, persistWatchlistFields]
  );

  const addAllowedEmail = useCallback(
    async (rawEmail: string, targetRole: UserRole) => {
      if (!user || role !== 'admin') return;
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanEmail)) {
        throw new Error('Please enter a valid email address.');
      }

      const actorEmail = (user.email || '').trim().toLowerCase();
      const ref = doc(db, 'allowed_emails', cleanEmail);
      const path = `allowed_emails/${cleanEmail}`;

      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const finalRole: UserRole = isBootstrappedAdminEmail(cleanEmail)
            ? 'admin'
            : targetRole;
          await updateDoc(ref, {
            role: finalRole,
            addedBy: actorEmail,
            updatedAt: serverTimestamp(),
          });
        } else {
          const finalRole: UserRole = isBootstrappedAdminEmail(cleanEmail)
            ? 'admin'
            : targetRole;
          await setDoc(ref, {
            email: cleanEmail,
            role: finalRole,
            addedBy: actorEmail,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, 'write', path);
      }
    },
    [user, role]
  );

  const updateAllowedEmailRole = useCallback(
    async (targetEmail: string, targetRole: UserRole) => {
      if (!user || role !== 'admin') return;
      const cleanEmail = targetEmail.trim().toLowerCase();
      if (isBootstrappedAdminEmail(cleanEmail)) return;
      const actorEmail = (user.email || '').trim().toLowerCase();
      const ref = doc(db, 'allowed_emails', cleanEmail);

      try {
        await updateDoc(ref, {
          role: targetRole,
          addedBy: actorEmail,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, 'update', `allowed_emails/${cleanEmail}`);
      }
    },
    [user, role]
  );

  const removeAllowedEmail = useCallback(
    async (targetEmail: string) => {
      if (!user || role !== 'admin') return;
      const cleanEmail = targetEmail.trim().toLowerCase();
      if (isBootstrappedAdminEmail(cleanEmail)) return;
      const ref = doc(db, 'allowed_emails', cleanEmail);

      try {
        await deleteDoc(ref);
      } catch (err) {
        handleFirestoreError(err, 'delete', `allowed_emails/${cleanEmail}`);
      }
    },
    [user, role]
  );

  return {
    status,
    user,
    role,
    authError,
    watchlistReady,
    customAssets,
    removedSymbols,
    favorites,
    allowedEmails,
    signInWithGoogle,
    signOutUser,
    addTickerToList,
    removeTickerFromList,
    toggleFavorite,
    addAllowedEmail,
    updateAllowedEmailRole,
    removeAllowedEmail,
  };
}
