import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'solune.adminRole';

/**
 * Holds the admin role value sent as `x-admin-role` on admin API calls.
 *
 * This is NOT real authentication - see the comment at the top of
 * server/src/routes/admin.ts. There is no admin login/session system in this
 * app; this context just remembers whatever role string the person typed
 * into the hidden admin entry screen so they don't have to retype it. Anyone
 * who knows a valid role name can get in. This must be replaced with real
 * authenticated admin sessions before this screen is ever shipped.
 */
interface AdminRoleContextValue {
  adminRole: string | null;
  setAdminRole: (role: string | null) => Promise<void>;
  loading: boolean;
}

const AdminRoleContext = createContext<AdminRoleContextValue | undefined>(undefined);

export function AdminRoleProvider({ children }: { children: React.ReactNode }) {
  const [adminRole, setAdminRoleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved) setAdminRoleState(saved);
      })
      .finally(() => setLoading(false));
  }, []);

  const setAdminRole = async (role: string | null) => {
    setAdminRoleState(role);
    if (role) {
      await AsyncStorage.setItem(STORAGE_KEY, role);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <AdminRoleContext.Provider value={{ adminRole, setAdminRole, loading }}>
      {children}
    </AdminRoleContext.Provider>
  );
}

export function useAdminRole() {
  const ctx = useContext(AdminRoleContext);
  if (!ctx) throw new Error('useAdminRole must be used within an AdminRoleProvider');
  return ctx;
}
