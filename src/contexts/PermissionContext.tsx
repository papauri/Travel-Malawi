import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import PermissionRequiredDialog, { PermissionType } from '../components/PermissionRequiredDialog';

interface PermissionContextValue {
  requestPermission: (type: PermissionType, onGrantedAction?: () => void) => Promise<boolean>;
}

const PermissionContext = createContext<PermissionContextValue>({
  requestPermission: async () => false
});

export const usePermission = () => useContext(PermissionContext);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<PermissionType | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const actionRef = useRef<(() => void) | null>(null);

  const requestPermission = useCallback((permType: PermissionType, onGrantedAction?: () => void): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (localStorage.getItem('perm_granted_' + permType) === 'true') {
        if (onGrantedAction) {
          try { onGrantedAction(); } catch (e) {}
        }
        return resolve(true);
      }
      
      setType(permType);
      setIsOpen(true);
      resolveRef.current = resolve;
      actionRef.current = onGrantedAction || null;
    });
  }, []);

  const handleAllow = () => {
    setIsOpen(false);
    
    // Execute the action synchronously within the click event to preserve the browser's user-gesture token
    if (actionRef.current) {
      try { actionRef.current(); } catch (e) { console.error(e); }
    }
    
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
