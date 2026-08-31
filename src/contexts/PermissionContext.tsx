import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import PermissionRequiredDialog, { PermissionType } from '../components/PermissionRequiredDialog';
import toast from 'react-hot-toast';

interface PermissionContextValue {
  requestPermission: (type: PermissionType) => Promise<boolean>;
}

const PermissionContext = createContext<PermissionContextValue>({
  requestPermission: async () => false
});

export const usePermission = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<PermissionType | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const requestPermission = useCallback((permType: PermissionType): Promise<boolean> => {
    return new Promise(async (resolve) => {
      // Rely on a soft local cache to avoid showing our custom explainer every single time.
      // We cannot use navigator.permissions.query() because the AI Studio environment
      // violently intercepts it and shows a generic unstyled popup immediately.
      if (localStorage.getItem('perm_granted_' + permType) === 'true') {
        return resolve(true);
      }
      
      setType(permType);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  }, []);

  const handleAllow = () => {
    setIsOpen(false);
    if (resolveRef.current) resolveRef.current(true);
  };

  const handleDeny = () => {
    setIsOpen(false);
    if (resolveRef.current) resolveRef.current(false);
  };

  return (
    <PermissionContext.Provider value={{ requestPermission }}>
      {children}
      <PermissionRequiredDialog 
        isOpen={isOpen}
        type={type}
        onAllow={handleAllow}
        onDeny={handleDeny}
      />
    </PermissionContext.Provider>
  );
};
