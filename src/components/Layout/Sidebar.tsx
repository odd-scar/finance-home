import { useState } from 'react'
import { Tab } from '../../types'
import {
  LayoutDashboard,
  TrendingUp,
  CreditCard,
  PiggyBank,
  Target,
  Plane,
  BarChart3,
  DollarSign,
  Receipt,
  Building2,
  Menu,
  X,
  Cloud,
} from 'lucide-react'

interface NavItem {
  id: Tab
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { id: 'stocks', label: 'Stocks', icon: <TrendingUp size={18} /> },
  { id: 'debt', label: 'Debt', icon: <CreditCard size={18} /> },
  { id: 'savings', label: 'Savings', icon: <PiggyBank size={18} /> },
  { id: 'goals', label: 'Goals', icon: <Target size={18} /> },
  { id: 'trips', label: 'Trip Planner', icon: <Plane size={18} /> },
  { id: 'budget', label: 'Budget', icon: <BarChart3 size={18} /> },
  { id: 'bills', label: 'Bills', icon: <Receipt size={18} /> },
  { id: 'assets', label: 'Assets', icon: <Building2 size={18} /> },
]

// Bottom nav primary tabs (shown directly)
const bottomNavPrimary: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={22} /> },
  { id: 'stocks', label: 'Stocks', icon: <TrendingUp size={22} /> },
  { id: 'budget', label: 'Budget', icon: <BarChart3 size={22} /> },
  { id: 'bills', label: 'Bills', icon: <Receipt size={22} /> },
]

// Bottom nav secondary tabs (shown in "More" sheet)
const bottomNavMore: NavItem[] = [
  { id: 'debt', label: 'Debt', icon: <CreditCard size={24} /> },
  { id: 'savings', label: 'Savings', icon: <PiggyBank size={24} /> },
  { id: 'goals', label: 'Goals', icon: <Target size={24} /> },
  { id: 'trips', label: 'Trip Planner', icon: <Plane size={24} /> },
  { id: 'assets', label: 'Assets', icon: <Building2 size={24} /> },
]

interface SidebarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <aside className="hidden lg:flex w-56 shrink-0 h-screen sticky top-0 flex-col bg-gray-950 border-r border-gray-800/60">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800/60">
        <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shadow-md shadow-brand-600/30">
          <DollarSign size={17} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-sm leading-none tracking-wide">Finance Home</p>
          <p className="text-[10px] text-brand-400 font-medium mt-0.5">Personal Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
              activeTab === item.id
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                : 'text-gray-500 hover:text-white hover:bg-gray-800/70'
            }`}
          >
            <span className={activeTab === item.id ? 'text-white' : 'text-gray-500 group-hover:text-white'}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800/60">
        <div className="flex items-center justify-center gap-1.5">
          <Cloud size={11} className="text-emerald-500" />
          <p className="text-[10px] text-gray-600">Synced to cloud</p>
        </div>
      </div>
    </aside>
  )
}

interface BottomNavProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const isMoreActive = bottomNavMore.some(item => item.id === activeTab)

  const handleTabChange = (tab: Tab) => {
    onTabChange(tab)
    setMoreOpen(false)
  }

  return (
    <>
      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-gray-950/95 backdrop-blur-md border-t border-gray-800/60">
        <div className="flex items-stretch">
          {bottomNavPrimary.map(item => {
            const isActive = activeTab === item.id && !moreOpen
            return (
              <button
                key={item.id}
                onClick={() => { setMoreOpen(false); onTabChange(item.id) }}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${
                  isActive ? 'text-brand-400' : 'text-gray-600 hover:text-gray-300'
                }`}
              >
                {/* Active indicator dot */}
                {isActive && <span className="absolute mt-[-18px] w-1 h-1 rounded-full bg-brand-400" />}
                <span>{item.icon}</span>
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </button>
            )
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${
              moreOpen || isMoreActive ? 'text-brand-400' : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            <span>{moreOpen ? <X size={22} /> : <Menu size={22} />}</span>
            <span className="text-[10px] font-medium leading-none">More</span>
          </button>
        </div>
      </nav>

      {/* More bottom sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          />

          {/* Sheet */}
          <div className="animate-slide-up fixed bottom-[57px] left-0 right-0 z-50 lg:hidden bg-gray-900 border-t border-gray-800 rounded-t-2xl shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <p className="text-sm font-semibold text-white">More</p>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 p-5">
              {bottomNavMore.map(item => {
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-brand-600/20 text-brand-400 border border-brand-600/40'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-transparent'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
