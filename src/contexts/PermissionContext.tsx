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
      // Check if already granted, so we don't annoy the user
      if (navigator.permissions) {
        try {
          const status = await navigator.permissions.query({ 
            name: permType === 'location' ? 'geolocation' : 'camera' as any 
          });
          if (status.state === 'granted') {
            return resolve(true);
          }
        } catch (e) {
          // ignore unsupported browsers
        }
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
