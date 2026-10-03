import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Hotel, CurrencyCode } from '../types';
import toast from 'react-hot-toast';

export interface CompareItem {
  hotel: Hotel;
  priceFrom?: number | null;
  priceCurrency?: CurrencyCode;
  rating?: { average: number; count: number } | null;
}

interface CompareContextType {
  selectedHotels: CompareItem[];
  toggleHotel: (item: CompareItem) => void;
  clearSelection: () => void;
  isCompareModalOpen: boolean;
  setIsCompareModalOpen: (isOpen: boolean) => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selectedHotels, setSelectedHotels] = useState<CompareItem[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  const toggleHotel = (item: CompareItem) => {
    const isSelected = selectedHotels.some(h => h.hotel.id === item.hotel.id);
    if (!isSelected && selectedHotels.length >= 3) {
      // Outside the state updater so StrictMode's double-invoke can't fire it twice.
      toast.error('You can compare up to 3 properties at a time.');
      return;
    }
    setSelectedHotels(prev => {
      if (prev.some(h => h.hotel.id === item.hotel.id)) {
        return prev.filter(h => h.hotel.id !== item.hotel.id);
      }
      return prev.length >= 3 ? prev : [...prev, item];
    });
  };

  const clearSelection = () => {
    setSelectedHotels([]);
    setIsCompareModalOpen(false);
  };

  return (
    <CompareContext.Provider value={{ selectedHotels, toggleHotel, clearSelection, isCompareModalOpen, setIsCompareModalOpen }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}

