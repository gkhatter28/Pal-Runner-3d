import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  type PlayerSaveState,
  type LeaderboardEntry,
  type FriendshipRecord,
  DEFAULT_SAVE_STATE,
  clampInt,
  sanitizeIdString,
  sanitizeDisplayName,
  deriveFriendCode,
} from '../types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connection on initial boot
async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

function sanitizeSavePayload(uid: string, state: PlayerSaveState) {
  const ownedSkins = Array.from(
    new Set(['street_kid', ...state.ownedSkins.map((s) => sanitizeIdString(s, 32))]),
  ).slice(0, 12);
  const equippedSkin = ownedSkins.includes(state.equippedSkin)
    ? sanitizeIdString(state.equippedSkin, 32)
    : 'street_kid';
  const purchases = state.purchases
    .map((p) => String(p).slice(0, 64))
    .slice(-30);

  return {
    ownerId: sanitizeIdString(uid, 128),
    coins: clampInt(state.coins, 0, 100000000),
    highScore: clampInt(state.highScore, 0, 100000000),
    bestDistance: clampInt(state.bestDistance, 0, 10000000),
    totalRuns: clampInt(state.totalRuns, 0, 1000000),
    ownedSkins,
    equippedSkin,
    magnetLevel: clampInt(state.magnetLevel, 1, 5),
    jetpackLevel: clampInt(state.jetpackLevel, 1, 5),
    multiplierLevel: clampInt(state.multiplierLevel, 1, 5),
    hoverboards: clampInt(state.hoverboards, 0, 999),
    adFree: Boolean(state.adFree),
    personalizedAds: Boolean(state.personalizedAds),
    audioSfx: Boolean(state.audioSfx),
    audioMusic: Boolean(state.audioMusic),
    qualityPreset: (['auto', 'low', 'high'].includes(state.qualityPreset)
      ? state.qualityPreset
      : 'auto') as 'auto' | 'low' | 'high',
    touchControls: Boolean(state.touchControls),
    purchases,
  };
}

export function mergeSaveStates(local: PlayerSaveState, remote: Partial<PlayerSaveState>): PlayerSaveState {
  const mergedSkins = Array.from(
    new Set([
      'street_kid',
      ...(local.ownedSkins ?? []),
      ...(Array.isArray(remote.ownedSkins) ? remote.ownedSkins : []),
    ]),
  ).slice(0, 12);
  const mergedPurchases = Array.from(
    new Set([...(local.purchases ?? []), ...(Array.isArray(remote.purchases) ? remote.purchases : [])]),
  ).slice(-30);

  return {
    coins: Math.max(local.coins, remote.coins ?? 0),
    highScore: Math.max(local.highScore, remote.highScore ?? 0),
    bestDistance: Math.max(local.bestDistance, remote.bestDistance ?? 0),
    totalRuns: Math.max(local.totalRuns, remote.totalRuns ?? 0),
    ownedSkins: mergedSkins,
    equippedSkin: mergedSkins.includes(remote.equippedSkin ?? '')
      ? (remote.equippedSkin as string)
      : local.equippedSkin,
    magnetLevel: Math.max(local.magnetLevel, remote.magnetLevel ?? 1),
    jetpackLevel: Math.max(local.jetpackLevel, remote.jetpackLevel ?? 1),
    multiplierLevel: Math.max(local.multiplierLevel, remote.multiplierLevel ?? 1),
    hoverboards: Math.max(local.hoverboards, remote.hoverboards ?? 0),
    adFree: Boolean(local.adFree || remote.adFree),
    personalizedAds: remote.personalizedAds ?? local.personalizedAds,
    audioSfx: remote.audioSfx ?? local.audioSfx,
    audioMusic: remote.audioMusic ?? local.audioMusic,
    qualityPreset: remote.qualityPreset ?? local.qualityPreset,
    touchControls: remote.touchControls ?? local.touchControls,
    purchases: mergedPurchases,
    privacyConsent: remote.privacyConsent ?? local.privacyConsent,
  };
}

export async function loadAndSyncCloudSave(
  user: User,
  localState: PlayerSaveState,
): Promise<PlayerSaveState> {
  const savePath = `saves/${user.uid}`;
  const privatePath = `users_private/${user.uid}`;
  let merged = { ...localState };

  try {
    const snap = await getDoc(doc(db, 'saves', user.uid));
    if (snap.exists()) {
      const data = snap.data() as Partial<PlayerSaveState>;
      merged = mergeSaveStates(localState, data);
      const payload = sanitizeSavePayload(user.uid, merged);
      await updateDoc(doc(db, 'saves', user.uid), {
        coins: payload.coins,
        highScore: payload.highScore,
        bestDistance: payload.bestDistance,
        totalRuns: payload.totalRuns,
        ownedSkins: payload.ownedSkins,
        equippedSkin: payload.equippedSkin,
        magnetLevel: payload.magnetLevel,
        jetpackLevel: payload.jetpackLevel,
        multiplierLevel: payload.multiplierLevel,
        hoverboards: payload.hoverboards,
        adFree: payload.adFree,
        personalizedAds: payload.personalizedAds,
        audioSfx: payload.audioSfx,
        audioMusic: payload.audioMusic,
        qualityPreset: payload.qualityPreset,
        touchControls: payload.touchControls,
        purchases: payload.purchases,
        updatedAt: serverTimestamp(),
      });
    } else {
      const payload = sanitizeSavePayload(user.uid, merged);
      await setDoc(doc(db, 'saves', user.uid), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, savePath);
  }

  // Sync isolated PII record
  try {
    const privSnap = await getDoc(doc(db, 'users_private', user.uid));
    const safeEmail = (user.email ?? '').slice(0, 254);
    if (privSnap.exists()) {
      await updateDoc(doc(db, 'users_private', user.uid), {
        email: safeEmail,
        privacyConsent: Boolean(merged.privacyConsent),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'users_private', user.uid), {
        ownerId: sanitizeIdString(user.uid, 128),
        email: safeEmail,
        privacyConsent: Boolean(merged.privacyConsent),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }

  await upsertLeaderboardEntry(user, merged);
  return merged;
}

export async function saveProgressToCloud(
  user: User,
  state: PlayerSaveState,
): Promise<void> {
  const savePath = `saves/${user.uid}`;
  const payload = sanitizeSavePayload(user.uid, state);
  try {
    const snap = await getDoc(doc(db, 'saves', user.uid));
    if (snap.exists()) {
      await updateDoc(doc(db, 'saves', user.uid), {
        coins: payload.coins,
        highScore: payload.highScore,
        bestDistance: payload.bestDistance,
        totalRuns: payload.totalRuns,
        ownedSkins: payload.ownedSkins,
        equippedSkin: payload.equippedSkin,
        magnetLevel: payload.magnetLevel,
        jetpackLevel: payload.jetpackLevel,
        multiplierLevel: payload.multiplierLevel,
        hoverboards: payload.hoverboards,
        adFree: payload.adFree,
        personalizedAds: payload.personalizedAds,
        audioSfx: payload.audioSfx,
        audioMusic: payload.audioMusic,
        qualityPreset: payload.qualityPreset,
        touchControls: payload.touchControls,
        purchases: payload.purchases,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'saves', user.uid), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, savePath);
  }

  await upsertLeaderboardEntry(user, state);
}

export async function upsertLeaderboardEntry(
  user: User,
  state: PlayerSaveState,
): Promise<void> {
  const path = `leaderboard/${user.uid}`;
  const uid = sanitizeIdString(user.uid, 128);
  const displayName = sanitizeDisplayName(user.displayName ?? 'Metro Runner');
  const friendCode = deriveFriendCode(uid);
  const equippedSkin = sanitizeIdString(state.equippedSkin, 32);
  const highScore = clampInt(state.highScore, 0, 100000000);
  const bestDistance = clampInt(state.bestDistance, 0, 10000000);

  try {
    const ref = doc(db, 'leaderboard', uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existingData = snap.data() as Partial<LeaderboardEntry>;
      await updateDoc(ref, {
        displayName,
        equippedSkin,
        highScore: Math.max(highScore, existingData.highScore ?? 0),
        bestDistance: Math.max(bestDistance, existingData.bestDistance ?? 0),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        displayName,
        friendCode,
        equippedSkin,
        highScore,
        bestDistance,
        isPublic: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  const path = 'leaderboard';
  try {
    const q = query(
      collection(db, 'leaderboard'),
      where('isPublic', '==', true),
      orderBy('highScore', 'desc'),
      limit(25),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function findPlayerByFriendCode(code: string): Promise<LeaderboardEntry | null> {
  const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 6 || cleaned.length > 12) return null;

  const path = 'leaderboard';
  try {
    const q = query(
      collection(db, 'leaderboard'),
      where('isPublic', '==', true),
      where('friendCode', '==', cleaned),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as LeaderboardEntry;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchFriendships(uid: string): Promise<FriendshipRecord[]> {
  const path = 'friendships';
  try {
    const q1 = query(collection(db, 'friendships'), where('requesterId', '==', uid));
    const q2 = query(collection(db, 'friendships'), where('targetId', '==', uid));
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const map = new Map<string, FriendshipRecord>();
    for (const d of [...s1.docs, ...s2.docs]) {
      const data = d.data() as Omit<FriendshipRecord, 'id'>;
      map.set(d.id, { id: d.id, ...data });
    }
    return Array.from(map.values());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function sendFriendRequest(
  currentUser: User,
  target: LeaderboardEntry,
): Promise<void> {
  const requesterId = sanitizeIdString(currentUser.uid, 128);
  const targetId = sanitizeIdString(target.userId, 128);
  if (requesterId === targetId) {
    throw new Error('You cannot add yourself as a friend.');
  }
  const friendshipId = [requesterId, targetId].sort().join('_');
  const path = `friendships/${friendshipId}`;

  try {
    const ref = doc(db, 'friendships', friendshipId);
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) {
      throw new Error('A friend connection already exists with this runner.');
    }
    await setDoc(ref, {
      requesterId,
      targetId,
      requesterName: sanitizeDisplayName(currentUser.displayName ?? 'Metro Runner'),
      targetName: sanitizeDisplayName(target.displayName),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function acceptFriendRequest(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await updateDoc(doc(db, 'friendships', friendshipId), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeFriendship(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchFriendsLeaderboard(
  currentUser: User,
  friendships: FriendshipRecord[],
): Promise<LeaderboardEntry[]> {
  const acceptedUids = new Set<string>([currentUser.uid]);
  for (const f of friendships) {
    if (f.status === 'accepted') {
      acceptedUids.add(f.requesterId === currentUser.uid ? f.targetId : f.requesterId);
    }
  }
  const entries: LeaderboardEntry[] = [];
  await Promise.all(
    Array.from(acceptedUids).map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'leaderboard', uid));
        if (snap.exists()) {
          entries.push(snap.data() as LeaderboardEntry);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `leaderboard/${uid}`);
      }
    }),
  );
  return entries.sort((a, b) => b.highScore - a.highScore);
}

export async function deleteAllCloudAccountData(user: User): Promise<void> {
  const uid = user.uid;
  try {
    await Promise.all([
      deleteDoc(doc(db, 'saves', uid)),
      deleteDoc(doc(db, 'users_private', uid)),
      deleteDoc(doc(db, 'leaderboard', uid)),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `saves/${uid}`);
  }
}

const LOCAL_STORAGE_KEY = 'metro_dash_3d_save_v1';

export function loadLocalSave(): PlayerSaveState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_STATE };
    const parsed = JSON.parse(raw) as Partial<PlayerSaveState>;
    return {
      ...DEFAULT_SAVE_STATE,
      ...parsed,
      ownedSkins: Array.isArray(parsed.ownedSkins) && parsed.ownedSkins.length > 0
        ? parsed.ownedSkins
        : ['street_kid'],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
    };
  } catch {
    return { ...DEFAULT_SAVE_STATE };
  }
}

export function persistLocalSave(state: PlayerSaveState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}
