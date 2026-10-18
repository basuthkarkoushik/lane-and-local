import { useEffect, useState } from 'react';
import { Check, CirclePause, Edit3, Leaf, Plus, RefreshCw, Trash2, Utensils, X } from 'lucide-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';
import { ErrorBox, Loading } from '../components/Feedback';

const EMPTY = { name: '', description: '', category: 'Mains', price_inr: '', emoji: '🍽️', vegetarian: true };
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function MenuManagement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  async function reload() {
    setLoading(true); setError('');
    try { setData(await api.ownerMenu()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  function edit(item) {
    setEditingId(item.id);
    setForm({ name: item.name || '', description: item.description || '', category: item.category || 'Mains', price_inr: String(item.price_inr ?? ''), emoji: item.emoji || '🍽️', vegetarian: item.vegetarian !== false });
    setMessage(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setForm(EMPTY); setEditingId(null); setError(''); setMessage('');
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const body = { ...form, price_inr: Number(form.price_inr) };
      if (editingId) await api.updateMenuItem(editingId, body);
      else await api.addMenuItem(body);
      setMessage(editingId ? 'Menu item updated.' : 'Menu item added.');
      resetForm();
      await reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggle(item) {
    setError(''); setMessage('');
    try {
      const next = item.availability === 'paused' ? 'available' : 'paused';
      await api.setMenuAvailability(item.id, next);
      setMessage(next === 'paused' ? `${item.name} is temporarily unavailable.` : `${item.name} is available again.`);
      await reload();
    } catch (e) { setError(e.message); }
  }

  async function remove(item) {
    if (!window.confirm(`Remove “${item.name}” from your menu? This does not change past orders.`)) return;
    setError(''); setMessage('');
    try {
      await api.removeMenuItem(item.id);
      if (editingId === item.id) resetForm();
      setMessage(`${item.name} removed from the menu.`);
      await reload();
    } catch (e) { setError(e.message); }
  }

  const items = data?.items || [];
  const available = items.filter((item) => item.availability !== 'paused' && item.active !== false).length;
  const paused = items.length - available;

  return (
    <div className="owner-menu-page">
      <PageHeader title="Menu">
        <button type="button" className="btn" onClick={reload}><RefreshCw size={15} /> Refresh</button>
      </PageHeader>

      {error && <div className="menu-feedback"><ErrorBox message={error} /></div>}
      {message && <div className="success-box menu-feedback">{message}</div>}

      <div className="menu-summary-row">
        <div className="menu-summary"><span>Menu items</span><strong>{items.length}</strong></div>
        <div className="menu-summary"><span>Available</span><strong>{available}</strong></div>
        <div className="menu-summary"><span>Temporarily paused</span><strong>{paused}</strong></div>
      </div>

      <div className="owner-menu-layout">
        <section className="card owner-menu-form-card">
          <div className="owner-menu-form-heading">
            <span className="owner-menu-form-icon">{editingId ? <Edit3 size={18} /> : <Plus size={19} />}</span>
            <div><h2>{editingId ? 'Edit menu item' : 'Add menu item'}</h2><p>{data?.restaurant?.name || 'Your restaurant'}</p></div>
          </div>
          <form className="owner-menu-form" onSubmit={save}>
            <label className="field"><span>Item name</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength={2} maxLength={80} placeholder="e.g. Paneer rice bowl" required /></label>
            <label className="field"><span>Price (₹)</span><input className="input" type="number" min="1" max="100000" step="1" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} placeholder="199" required /></label>
            <label className="field"><span>Category</span><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} minLength={2} maxLength={40} placeholder="Mains, Drinks…" required /></label>
            <label className="field"><span>Short description</span><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={180} placeholder="What is in this dish?" /></label>
            <div className="owner-menu-form-row">
              <label className="field"><span>Icon / emoji</span><input className="input" value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={8} placeholder="🍽️" /></label>
              <label className="owner-menu-veg"><input type="checkbox" checked={form.vegetarian} onChange={(e) => setForm({ ...form, vegetarian: e.target.checked })} /><Leaf size={15} /> Vegetarian</label>
            </div>
            <div className="owner-menu-form-actions">
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add to menu'}</button>
              {editingId && <button className="btn" type="button" onClick={resetForm}><X size={15} /> Cancel edit</button>}
            </div>
          </form>
        </section>

        <section className="owner-menu-list-section">
          <div className="owner-menu-list-heading"><h2>Your items</h2><span>{items.length}</span></div>
          {loading && !data ? <Loading text="Loading menu…" /> : items.length === 0 ? (
            <div className="card"><div className="owner-menu-empty"><Utensils size={26} /><h3>Your menu is empty</h3><p>Add your first item to get started.</p></div></div>
          ) : (
            <div className="owner-menu-list">
              {items.map((item) => {
                const isPaused = item.availability === 'paused' || item.active === false;
                return (
                  <article className={`owner-menu-item${isPaused ? ' paused' : ''}`} key={item.id}>
                    <div className="owner-menu-item-emoji">{item.emoji || '🍽️'}</div>
                    <div className="owner-menu-item-main">
                      <div className="owner-menu-item-top"><h3>{item.name}</h3><strong>{money(item.price_inr)}</strong></div>
                      <div className="owner-menu-item-meta"><span>{item.category || 'Menu item'}</span><span className="owner-menu-dot">·</span><span className={item.vegetarian === false ? 'owner-menu-nonveg' : 'owner-menu-veg-label'}>{item.vegetarian === false ? 'Non-vegetarian' : 'Vegetarian'}</span></div>
                      {item.description && <p>{item.description}</p>}
                      <div className="owner-menu-item-bottom"><span className={`owner-menu-status${isPaused ? ' paused' : ''}`}><i />{isPaused ? 'Temporarily unavailable' : 'Available to order'}</span></div>
                    </div>
                    <div className="owner-menu-item-actions">
                      <button type="button" className="icon-btn" onClick={() => edit(item)} aria-label={`Edit ${item.name}`} title="Edit"><Edit3 size={15} /></button>
                      <button type="button" className="icon-btn" onClick={() => toggle(item)} aria-label={isPaused ? `Make ${item.name} available` : `Temporarily pause ${item.name}`} title={isPaused ? 'Make available' : 'Temporarily pause'}>{isPaused ? <Check size={15} /> : <CirclePause size={15} />}</button>
                      <button type="button" className="icon-btn owner-menu-delete" onClick={() => remove(item)} aria-label={`Remove ${item.name}`} title="Remove"><Trash2 size={15} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
