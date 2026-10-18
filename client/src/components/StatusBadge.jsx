const TONES = {
  Green: 'green', Delivered: 'green', Available: 'green', Resolved: 'green',
  Amber: 'amber', Warning: 'amber', Pending: 'amber', Acknowledged: 'amber',
  Red: 'red', Critical: 'red', Cancelled: 'red', Busy: 'red',
  Informational: 'blue', Open: 'blue', Assigned: 'blue', Preparing: 'blue', 'Out for Delivery': 'blue',
};

export default function StatusBadge({ value }) {
  if (!value) return <span className="badge badge-grey">—</span>;
  return <span className={`badge badge-${TONES[value] || 'grey'}`}>{value}</span>;
}