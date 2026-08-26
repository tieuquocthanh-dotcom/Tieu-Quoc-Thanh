import React from 'react';
import { View } from '../types';

export interface AppDefinition {
  id: View;
  title: string;
  category: 'ban_hang' | 'tai_chinh' | 'kho_hang' | 'bao_cao' | 'he_thong';
  categoryLabel: string;
  iconName: string;
  color: string;
  adminOnly?: boolean;
  defaultSize?: { width: number; height: number };
  badgeCount?: number;
}

export interface WindowState {
  id: string; // Unique window ID (usually the View name or view_instance)
  view: View;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  prevPosition?: { x: number; y: number; width: number; height: number };
}
