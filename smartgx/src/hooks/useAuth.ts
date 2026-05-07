import { useAuthStore } from "../store/authStore";

export const useAuth = () => {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const users = useAuthStore((s) => s.users);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const logout = useAuthStore((s) => s.logout);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const completeMyKadScan = useAuthStore((s) => s.completeMyKadScan);
  const completeSelfieVerification = useAuthStore((s) => s.completeSelfieVerification);
  const completeEkycReview = useAuthStore((s) => s.completeEkycReview);
  const completeFinancialProfile = useAuthStore((s) => s.completeFinancialProfile);
  const completeSmartGXSetup = useAuthStore((s) => s.completeSmartGXSetup);
  const completeSecuritySetup = useAuthStore((s) => s.completeSecuritySetup);
  const activateDemoAccount = useAuthStore((s) => s.activateDemoAccount);

  return {
    currentUser,
    isAuthenticated,
    users,
    login,
    register,
    logout,
    verifyOtp,
    completeMyKadScan,
    completeSelfieVerification,
    completeEkycReview,
    completeFinancialProfile,
    completeSmartGXSetup,
    completeSecuritySetup,
    activateDemoAccount,
  };
};
