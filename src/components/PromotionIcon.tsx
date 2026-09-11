import React from 'react';
import { SaleType } from '../types';
import { getSaleTypeIconName, SaleTypeIconName } from '../lib/promotions';
import { Zap, Calendar, CalendarDays, Clock, Leaf, Briefcase, Star, Tag } from 'lucide-react';

interface PromotionIconProps {
  saleType?: SaleType;
  iconName?: SaleTypeIconName;
  className?: string;
}

export default function PromotionIcon({ saleType, iconName, className = 'w-3.5 h-3.5' }: PromotionIconProps) {
  const name = iconName || getSaleTypeIconName(saleType);

  switch (name) {
    case 'Zap':
      return <Zap className={className} />;
    case 'Calendar':
      return <Calendar className={className} />;
    case 'CalendarDays':
      return <CalendarDays className={className} />;
    case 'Clock':
      return <Clock className={className} />;
    case 'Leaf':
      return <Leaf className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'Star':
      return <Star className={className} />;
    case 'Tag':
    default:
      return <Tag className={className} />;
  }
}
