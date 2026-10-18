import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, ShoppingBag, Store } from 'lucide-react';
import { useAuth } from '../auth';
import { homeFor } from '../nav';
import { ErrorBox } from '../components/Feedback';
import BrandMark from '../components/BrandMark';

export default function AuthPage() {
  const { signIn, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('customer');
  const [form, setForm] = useState({ name: '', email: '', password: '', restaurant_name: '', cuisine: 'Neighbourhood kitchen' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = mode === 'login'
        ? await signIn(form.email, form.password)
        : await register({ ...form, role: accountType });
      const role = result.user.role;
      const defaultPath = homeFor(role);
      const requested = location.state?.from;
      navigate(role === 'customer' && requested?.startsWith('/my-orders') ? requested : defaultPath, { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Link to="/" className="auth-brand"><span className="auth-brand-mark"><BrandMark size={25} /></span><span>Lane <em>&amp; Local</em><b>.</b></span></Link>
        <div className="auth-brand-message">
          <div className="auth-eyebrow">GOOD THINGS, DELIVERED</div>
          <h1>Closer to home.<br /><em>Better together.</em></h1>
          <p>One neighbourhood. A little more care in every order.</p>
        </div>
        <div className="auth-brand-foot"><span>Customer</span><span>Owner</span><span>Dispatcher</span><span>Rider</span></div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <Link to="/" className="auth-back"><ArrowRight size={14} /> Back to home</Link>
          <div className="auth-form-heading">
            <div className="auth-form-icon">{mode === 'register' ? <Store size={20} /> : <LockKeyhole size={20} />}</div>
            <h2>{mode === 'login' ? 'Welcome back' : 'Join Lane & Local'}</h2>
            <p>{mode === 'login' ? 'Sign in to continue.' : 'Create your account to get started.'}</p>
          </div>

          {error && <div className="auth-error"><ErrorBox message={error} /></div>}

          {mode === 'register' && (
            <div className="auth-type-switch" role="group" aria-label="Account type">
              <button type="button" className={accountType === 'customer' ? 'active' : ''} onClick={() => setAccountType('customer')}><ShoppingBag size={15} /> Customer</button>
              <button type="button" className={accountType === 'owner' ? 'active' : ''} onClick={() => setAccountType('owner')}><Building2 size={15} /> Restaurant owner</button>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label><span>Your name</span><input value={form.name} onChange={update('name')} autoComplete="name" placeholder="Full name" required minLength={2} maxLength={80} /></label>}
            <label><span>Email address</span><div className="auth-input-icon"><Mail size={16} /><input type="email" value={form.email} onChange={update('email')} autoComplete="email" placeholder="you@example.com" required maxLength={160} /></div></label>
            <label><span>Password</span><div className="auth-input-icon"><LockKeyhole size={16} /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" required minLength={8} maxLength={128} /><button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
            {mode === 'register' && accountType === 'owner' && <><label><span>Restaurant name</span><input value={form.restaurant_name} onChange={update('restaurant_name')} placeholder="Your restaurant" required minLength={2} maxLength={80} /></label><label><span>Cuisine</span><input value={form.cuisine} onChange={update('cuisine')} placeholder="e.g. South Indian" maxLength={80} /></label></>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : accountType === 'owner' ? 'Create restaurant account' : 'Create customer account'} <ArrowRight size={16} /></button>
          </form>

          <div className="auth-mode-switch">{mode === 'login' ? <>New to Lane &amp; Local? <button type="button" onClick={() => { setMode('register'); setError(''); }}>Create an account</button></> : <>Already have an account? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>}</div>
          {mode === 'register' && <p className="auth-dispatcher-note">Dispatchers and riders are invited by their restaurant owner and sign in with the account they receive.</p>}
        </div>
      </section>
    </div>
  );
}
