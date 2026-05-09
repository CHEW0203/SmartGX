import { getSupabase } from "../../lib/supabase";
import { fetchUsersProfile, mapProfileToAuthUser } from "../../features/auth/supabaseAuth.service";
import { useAuthStore } from "../../store/authStore";
import { hydrateUserDataStores } from "./hydrate";
import { resetAllDataStores } from "./resetStores";

let initDone = false;
let initResolvers: Array<() => void> = [];
let initPromise: Promise<void> | null = null;
let authListenerRegistered = false;

export function waitForAuthHydration(): Promise<void> {
  if (initDone) return Promise.resolve();
  return new Promise<void>((resolve) => initResolvers.push(resolve));
}

export function initializeAuthSession(): Promise<void> {
  if (!initPromise) initPromise = runInitializeAuthSession();
  return initPromise;
}

async function runInitializeAuthSession(): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    finishInit();
    return;
  }

  try {
    const {
      data: { session },
    } = await sb.auth.getSession();

    if (session?.user) {
      const profile = await fetchUsersProfile(session.user.id);
      if (profile) {
        const authUser = mapProfileToAuthUser(profile, session.user);
        useAuthStore.setState({ currentUser: authUser, isAuthenticated: true, users: [] });
        const h = await hydrateUserDataStores(session.user.id);
        if (!h.ok && __DEV__) console.warn("[SmartGX] hydrate on cold start", h.message);
      }
    }

    if (!authListenerRegistered) {
      authListenerRegistered = true;
      sb.auth.onAuthStateChange(async (event, nextSession) => {
        if (event === "INITIAL_SESSION") return;
        if (event === "SIGNED_OUT" || !nextSession?.user) {
          resetAllDataStores();
          useAuthStore.setState({ currentUser: null, isAuthenticated: false, users: [] });
          return;
        }
        if (event === "SIGNED_IN") {
          const profile = await fetchUsersProfile(nextSession.user.id);
          if (profile) {
            const authUser = mapProfileToAuthUser(profile, nextSession.user);
            useAuthStore.setState({ currentUser: authUser, isAuthenticated: true, users: [] });
            await hydrateUserDataStores(nextSession.user.id);
          }
        }
      });
    }
  } catch (e) {
    if (__DEV__) console.warn("[SmartGX] auth session init", e);
  } finally {
    finishInit();
  }
}

function finishInit() {
  initDone = true;
  initResolvers.forEach((r) => r());
  initResolvers = [];
}
