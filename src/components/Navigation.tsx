import React, { useState } from 'react';
import {
  QrCode,
  Users,
  CalendarCheck,
  BarChart3,
  Settings,
  Layers,
  CreditCard,
  Menu,
  X,
  ShieldCheck,
  Wifi,
  WifiOff
} from 'lucide-react';
import { UserRole, School } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  school: School;
  isOnline: boolean;
  hasSupabaseConfigured: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  school,
  isOnline,
  hasSupabaseConfigured
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'staff'] },
    { id: 'scanner', label: 'Scan QR', icon: QrCode, roles: ['admin', 'staff'], highlight: true },
    { id: 'register', label: 'Register', icon: CalendarCheck, roles: ['admin', 'staff'] },
    { id: 'students', label: 'Students', icon: Users, roles: ['admin'] },
    { id: 'classes', label: 'Classes', icon: Layers, roles: ['admin'] },
    { id: 'idcards', label: 'ID Badges', icon: CreditCard, roles: ['admin'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin'] },
    { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin'] }
  ];

  const visibleItems = navItems.filter(item => item.roles.includes(currentRole));

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 text-left group focus:outline-hidden"
            >
              <div className="w-9 h-9 rounded-lg bg-stone-900 flex items-center justify-center text-orange-500 shadow-xs group-hover:bg-stone-800 transition">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-stone-900 block leading-tight font-display whitespace-nowrap">
                  EduPulse
                </span>
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-medium block">
                  {school.name.split(' ')[0]} {school.code}
                </span>
              </div>
            </button>
          </div>

          {/* Zone 2: Single-line Nav Links (Desktop/Tablet) */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {visibleItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? item.highlight
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-stone-100 text-stone-950 font-bold'
                      : item.highlight
                      ? 'text-orange-600 hover:bg-orange-50'
                      : 'text-stone-600 hover:text-stone-950 hover:bg-stone-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action & Status / Role Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Online Indicator */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${
                isOnline
                  ? hasSupabaseConfigured
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-stone-50 text-stone-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
              title={
                isOnline
                  ? hasSupabaseConfigured
                    ? 'Connected to live Supabase PostgreSQL'
                    : 'Online mode (Demo dataset active. Enter Supabase keys in Settings to connect live)'
                  : 'Offline — Attendance recording is paused'
              }
            >
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  <span className="tabular-nums">
                    {hasSupabaseConfigured ? 'Supabase Live' : 'Online'}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-600" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Role Switcher (Admin vs Staff demonstration) */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs">
              <button
                onClick={() => setCurrentRole('admin')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                  currentRole === 'admin'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Switch to School Administrator View"
              >
                Admin
              </button>
              <button
                onClick={() => setCurrentRole('staff')}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition ${
                  currentRole === 'staff'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Switch to Staff / Scanner Operator View"
              >
                Staff
              </button>
            </div>

            {/* Install PWA Button */}
            <PWAInstallButton />

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-md"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-stone-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? item.highlight
                      ? 'bg-orange-600 text-white'
                      : 'bg-stone-100 text-stone-950 font-bold'
                    : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
