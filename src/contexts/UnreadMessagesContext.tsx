import React, { createContext, useContext } from 'react';
import { useUnreadMessagesSource } from '../hooks/useUnreadMessages';

type UnreadMessagesValue = ReturnType<typeof useUnreadMessagesSource>;

const UnreadMessagesContext = createContext<UnreadMessagesValue | null>(null);

/** Runs the chat unread listeners once for the whole app. */
export function UnreadMessagesProvider({ children }: { children: React.ReactNode }) {
  const value = useUnreadMessagesSource();
  return <UnreadMessagesContext.Provider value={value}>{children}</UnreadMessagesContext.Provider>;
}

export function useUnreadMessages(): UnreadMessagesValue {
  const value = useContext(UnreadMessagesContext);
  if (!value) throw new Error('useUnreadMessages must be used inside UnreadMessagesProvider');
  return value;
}
