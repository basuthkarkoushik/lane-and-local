import {
  LayoutDashboard,
  ClipboardList,
  FilePlus2,
  Bike,
  ShieldCheck,
  SlidersHorizontal,
  BellRing,
  Target,
  BarChart3,
  History,
  Settings,
  PackageSearch,
  ShoppingBag,
  Gem,
  Users,
  Utensils,
} from 'lucide-react';

const STAFF = ['owner', 'dispatcher'];
const OWNER = ['owner'];

export const NAV = [
  {
    path: '/overview',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: STAFF,
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: ClipboardList,
    roles: STAFF,
  },
  {
    path: '/orders/new',
    label: 'Quotes & Simulator',
    icon: FilePlus2,
    roles: STAFF,
  },
  {
    path: '/riders',
    label: 'Rider Management',
    icon: Bike,
    roles: STAFF,
  },
  {
    path: '/feasibility',
    label: 'Smart Feasibility',
    icon: ShieldCheck,
    roles: STAFF,
  },
  {
    path: '/simulator',
    label: 'What-If Profit Simulator',
    icon: SlidersHorizontal,
    roles: STAFF,
  },
  {
    path: '/alerts',
    label: 'Early-Warning Alerts',
    icon: BellRing,
    roles: STAFF,
  },
  {
    path: '/team',
    label: 'Team & Access',
    icon: Users,
    roles: OWNER,
  },
  {
    path: '/menu',
    label: 'Menu',
    icon: Utensils,
    roles: OWNER,
  },
  {
    path: '/radius',
    label: 'Service Radius',
    icon: Target,
    roles: OWNER,
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: OWNER,
  },
  {
    path: '/history',
    label: 'Decision History',
    icon: History,
    roles: STAFF,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: OWNER,
  },
];

export const DISPATCHER_NAV = [
  {
    path: '/overview',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: ['dispatcher'],
  },
  {
    path: '/orders',
    label: 'Orders',
    icon: ClipboardList,
    roles: ['dispatcher'],
  },
  {
    path: '/orders/new',
    label: 'Quote & Simulator',
    icon: FilePlus2,
    roles: ['dispatcher'],
  },
  {
    path: '/riders',
    label: 'Riders',
    icon: Bike,
    roles: ['dispatcher'],
  },
  {
    path: '/feasibility',
    label: 'Feasibility',
    icon: ShieldCheck,
    roles: ['dispatcher'],
  },
  {
    path: '/history',
    label: 'Decision History',
    icon: History,
    roles: ['dispatcher'],
  },
];

export const OWNER_NAV = [
  {
    path: '/overview',
    label: 'Overview',
    icon: LayoutDashboard,
    roles: OWNER,
  },
  {
    path: '/orders',
    label: 'Order status',
    icon: ClipboardList,
    roles: OWNER,
  },
  {
    path: '/menu',
    label: 'Menu',
    icon: Utensils,
    roles: OWNER,
  },
  {
    path: '/team',
    label: 'Team & Access',
    icon: Users,
    roles: OWNER,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: OWNER,
  },
  {
    path: '/history',
    label: 'Order history',
    icon: History,
    roles: OWNER,
  },
  {
    path: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    roles: OWNER,
  },
];

export const CUSTOMER_NAV = [
  {
    path: '/my-orders/new',
    label: 'Order food',
    icon: ShoppingBag,
  },
  {
    path: '/my-orders',
    label: 'My Orders',
    icon: PackageSearch,
  },
  {
    path: '/premium',
    label: 'Lane & Local Plus',
    icon: Gem,
  },
];

export const navFor = (role) =>
  role === 'customer'
    ? CUSTOMER_NAV
    : role === 'owner'
      ? OWNER_NAV
      : role === 'dispatcher'
        ? DISPATCHER_NAV
        : role === 'rider'
          ? [
              {
                path: '/rider/orders',
                label: 'My deliveries',
                icon: Bike,
                roles: ['rider'],
              },
            ]
          : NAV.filter((item) =>
              item.roles.includes(role)
            );

export const homeFor = (role) =>
  role === 'customer'
    ? '/my-orders/new'
    : role === 'rider'
      ? '/rider/orders'
      : '/overview';