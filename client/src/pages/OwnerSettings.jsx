import { useState } from 'react';
import {
  SlidersHorizontal,
  Target,
  MapPin,
} from 'lucide-react';

import ServiceRadius from './ServiceRadius';
import WhatIfSimulator from './WhatIfSimulator';
import RestaurantLocation from './RestaurantLocation';

const TABS = [
  {
    id: 'radius',
    label: 'Service radius',
    icon: Target,
  },
  {
    id: 'simulator',
    label: 'What-if simulator',
    icon: SlidersHorizontal,
  },
  {
    id: 'location',
    label: 'Restaurant location',
    icon: MapPin,
  },
];

export default function OwnerSettings() {
  const [active, setActive] = useState('radius');

  return (
    <div className="owner-settings-page">
      <div
        className="owner-settings-tabs"
        role="tablist"
        aria-label="Settings sections"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={active === id}
            className={`owner-settings-tab${
              active === id ? ' active' : ''
            }`}
            onClick={() => setActive(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <div className="owner-settings-content">
        {active === 'radius' && <ServiceRadius />}
        {active === 'simulator' && <WhatIfSimulator />}
        {active === 'location' && <RestaurantLocation />}
      </div>
    </div>
  );
}