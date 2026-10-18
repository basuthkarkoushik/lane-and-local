import { Check, Package, CookingPot, Bike, CheckCircle2, XCircle } from 'lucide-react';

const STEPS = [
  { key: 'Pending', label: 'Request received', Icon: Package },
  { key: 'Assigned', label: 'Rider assigned', Icon: Bike },
  { key: 'Preparing', label: 'Preparing food', Icon: CookingPot },
  { key: 'Out for Delivery', label: 'On the way', Icon: Bike },
  { key: 'Delivered', label: 'Delivered', Icon: CheckCircle2 },
];

export default function OrderTimeline({ status }) {
  if (status === 'Cancelled') {
    return <div className="tracker-cancelled"><XCircle size={19} /> This order has been cancelled.</div>;
  }

  const current = Math.max(0, STEPS.findIndex((step) => step.key === status));
  const finished = status === 'Delivered';
  const progress = finished ? 82 : Math.min(82, (current / (STEPS.length - 1)) * 82);
  const currentStep = STEPS[current] || STEPS[0];
  const CurrentIcon = currentStep.Icon;

  return (
    <div className="customer-tracker">
      <div className="customer-tracker-heading">
        <div>
          <h2>Your order, step by step</h2>
          <p>We’ll keep this timeline updated as the restaurant progresses.</p>
        </div>
        {!finished && <span className="tracker-live-pill"><span /> Updating automatically</span>}
        {finished && <span className="tracker-live-pill"><CheckCircle2 size={12} /> Complete</span>}
      </div>

      <div className="timeline" style={{ '--tracker-progress': `${progress}%` }}>
        {!finished && <span className="tracker-delivery-emoji" aria-hidden="true">🛵</span>}
        {STEPS.map((step, index) => {
          const done = index < current || finished;
          const isCurrent = index === current && !finished;
          const Icon = step.Icon;
          return (
            <div key={step.key} className={`tl-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`} aria-current={isCurrent ? 'step' : undefined}>
              <div className="tl-dot">{done ? <Check size={15} /> : <Icon size={14} />}</div>
              <span>{step.label}</span>
            </div>
          );
        })}
      </div>

      <div className="tracker-progress-note">
        <CurrentIcon size={16} />
        <span>{finished ? 'Your order has arrived. We hope you enjoy every bite.' : (status === 'Pending' ? 'The restaurant is reviewing your request. We’ll update you as soon as it is accepted.' : status === 'Assigned' ? 'Your order is accepted and a rider is assigned. You can still cancel at this stage with Lane & Local Plus.' : status === 'Preparing' ? 'The kitchen has started preparing your food. Online cancellation is now closed.' : 'Your rider is on the way. Keep an eye out for your delivery.')}</span>
      </div>
    </div>
  );
}
