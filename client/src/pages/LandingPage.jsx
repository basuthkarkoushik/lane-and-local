import { ArrowRight, ArrowUpRight, Bike, Check, Clock3, Leaf, Package, Store, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

function NeighbourhoodScene() {
  return (
    <svg className="landing-scene" viewBox="0 0 760 510" role="img" aria-label="A local shop, delivery rider and nearby homes" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="scene-ground" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5EBDD" />
          <stop offset="100%" stopColor="#E0E8D8" />
        </linearGradient>
        <linearGradient id="scene-shop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E5E9DE" />
        </linearGradient>
        <filter id="scene-shadow" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="12" floodColor="#364832" floodOpacity=".12" />
        </filter>
      </defs>

      <rect width="760" height="510" rx="30" fill="#F0EBDD" />
      <circle cx="590" cy="113" r="96" fill="#F9F5EB" />
      <path d="M0 335 142 253 286 321 436 235 760 359V510H0Z" fill="#DDE5D5" />
      <path d="M0 414Q164 373 329 417T760 404V510H0Z" fill="url(#scene-ground)" />
      <path d="M30 434Q173 467 311 425T560 423T730 441" fill="none" stroke="#D7CDBD" strokeWidth="2" strokeDasharray="6 10" />

      {/* Homes in the distance */}
      <g opacity=".9">
        <path d="M455 221 527 160 600 221V350H455Z" fill="#F8F4E9" />
        <path d="M443 223 527 151 613 223Z" fill="#6F8A6D" />
        <rect x="476" y="242" width="29" height="36" rx="2" fill="#B9CCB4" />
        <rect x="535" y="242" width="29" height="36" rx="2" fill="#B9CCB4" />
        <rect x="509" y="296" width="33" height="54" fill="#C3C9B6" />
        <path d="M584 286 637 241 695 286V366H584Z" fill="#E7D8C6" />
        <path d="M575 287 637 232 705 287Z" fill="#D28D69" />
        <rect x="600" y="306" width="22" height="28" fill="#B7CAC0" />
        <rect x="648" y="306" width="22" height="28" fill="#B7CAC0" />
      </g>

      {/* Local shop */}
      <g filter="url(#scene-shadow)">
        <path d="M47 239 193 153 355 240V404H47Z" fill="url(#scene-shop)" />
        <path d="M31 241 193 143 370 242 354 258 193 169 49 257Z" fill="#31543E" />
        <path d="M79 235 192 170 318 238 207 304Z" fill="#FAF6EC" />
        <path d="M100 236 193 183 295 238 205 290Z" fill="#DDE7D4" />
        <text x="202" y="237" textAnchor="middle" fontFamily="Arial, sans-serif" fontSize="19" fontWeight="700" fill="#31513B">Lane &amp; Local</text>

        <path d="M63 264 193 188 346 267V296L193 218 64 294Z" fill="#E77548" />
        <path d="M94 246 120 231 120 279 94 294Z" fill="#F8E9D9" />
        <path d="M148 214 174 199 174 248 148 263Z" fill="#F7B58D" />
        <path d="M205 224 232 238 232 286 205 272Z" fill="#F8E9D9" />
        <path d="M263 254 289 267 289 314 263 300Z" fill="#F7B58D" />
        <path d="M68 297 193 224 346 303V404H68Z" fill="#F5F0E5" />
        <path d="M90 321 183 267V404H90Z" fill="#B8CCB2" />
        <path d="M204 278 324 343V404H204Z" fill="#E2E8D9" />
        <path d="M193 225V404" stroke="#D6DDCF" strokeWidth="4" />

        {/* Fresh produce and shop counter */}
        <path d="M80 351 190 289V309L80 372Z" fill="#C89768" />
        <path d="M80 372 190 309V325L80 388Z" fill="#AD7A53" />
        <g fill="#7F9B68">
          <ellipse cx="113" cy="341" rx="14" ry="8" transform="rotate(-25 113 341)" />
          <ellipse cx="136" cy="329" rx="13" ry="8" transform="rotate(-15 136 329)" />
          <ellipse cx="158" cy="326" rx="13" ry="8" transform="rotate(22 158 326)" />
        </g>
        <g fill="#E2774A">
          <circle cx="115" cy="353" r="7" />
          <circle cx="133" cy="345" r="7" />
          <circle cx="153" cy="342" r="7" />
        </g>
        <path d="M224 355 258 336 291 354 257 373Z" fill="#D5B083" />
        <path d="M224 355 257 373V405L224 386Z" fill="#B98A63" />
        <path d="M257 373 291 354V386L257 405Z" fill="#CDA176" />
        <path d="M252 339 261 344V399L252 394Z" fill="#F0D8B8" />
      </g>

      {/* Delivery route */}
      <path d="M146 438Q279 473 387 414T583 428" fill="none" stroke="#E77548" strokeWidth="3" strokeLinecap="round" strokeDasharray="4 9" />
      <circle cx="146" cy="438" r="6" fill="#FFF" stroke="#E77548" strokeWidth="3" />
      <circle cx="583" cy="428" r="6" fill="#FFF" stroke="#E77548" strokeWidth="3" />

      {/* Delivery bicycle / rider */}
      <g filter="url(#scene-shadow)">
        <circle cx="372" cy="413" r="27" fill="#344036" />
        <circle cx="372" cy="413" r="13" fill="#DCE0D3" />
        <circle cx="476" cy="413" r="27" fill="#344036" />
        <circle cx="476" cy="413" r="13" fill="#DCE0D3" />
        <path d="M372 412 412 376 445 413 398 413Z" fill="none" stroke="#52664E" strokeWidth="6" strokeLinejoin="round" />
        <path d="M412 376 441 374 458 413" fill="none" stroke="#52664E" strokeWidth="6" strokeLinecap="round" />
        <path d="M435 375 454 361 478 365" fill="none" stroke="#354535" strokeWidth="5" strokeLinecap="round" />
        <path d="M399 414 405 398 450 397 459 410Z" fill="#E77548" />
        <path d="M424 347 444 378 430 397" fill="none" stroke="#3B4938" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M415 353 404 378 389 391" fill="none" stroke="#52664E" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M407 312Q429 300 445 316L455 350 425 366 405 343Z" fill="#E77548" />
        <circle cx="428" cy="299" r="14" fill="#BC8464" />
        <path d="M412 300Q409 281 429 280Q447 281 444 301L434 296Z" fill="#31543E" />
        <path d="M433 284Q447 288 444 300" fill="none" stroke="#E2E9DC" strokeWidth="3" />
        <path d="M453 315 486 296 520 314 486 334Z" fill="#D5B083" />
        <path d="M453 315 486 334V369L453 350Z" fill="#B98A63" />
        <path d="M486 334 520 314V348L486 369Z" fill="#CDA176" />
        <path d="M477 304 486 309V362L477 357Z" fill="#F0D8B8" />
      </g>

      {/* Trees */}
      <g>
        <path d="M642 410V461" stroke="#8A765B" strokeWidth="5" strokeLinecap="round" />
        <ellipse cx="630" cy="406" rx="18" ry="23" fill="#8DA47E" />
        <ellipse cx="651" cy="402" rx="18" ry="23" fill="#6F8D68" />
        <ellipse cx="641" cy="385" rx="17" ry="24" fill="#B9C9AB" />
      </g>

      {/* Floating note */}
      <g filter="url(#scene-shadow)">
        <rect x="408" y="75" width="242" height="77" rx="17" fill="#FFFFFF" />
        <circle cx="435" cy="102" r="12" fill="#EAF1E3" />
        <path d="M429 102 434 107 442 97" fill="none" stroke="#6B8A59" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="458" y="101" fontFamily="Arial, sans-serif" fontSize="10" fill="#899184" letterSpacing="1">A LITTLE MORE CARE</text>
        <text x="430" y="130" fontFamily="Arial, sans-serif" fontSize="17" fontWeight="700" fill="#2F4A35">Good things, delivered.</text>
      </g>
    </svg>
  );
}

const highlights = [
  {
    icon: Package,
    title: 'Thoughtful dispatch',
    description: 'See every order clearly and choose the right next step.',
  },
  {
    icon: Bike,
    title: 'Riders, in balance',
    description: 'Know who is available before making a delivery promise.',
  },
  {
    icon: Wallet,
    title: 'Healthier margins',
    description: 'Understand what each order contributes after its costs.',
  },
];

export default function LandingPage({ onEnter }) {
  return (
    <main className="ll-landing">
      <header className="ll-nav-wrap">
        <nav className="ll-nav">
          <a href="/" className="ll-logo" aria-label="Lane and Local home">
            <span>Lane <em>&amp; Local</em></span><b>.</b>
          </a>
          <div className="ll-nav-links">
            <a href="#approach">Our approach</a>
            <a href="#how-it-works">How it works</a>
          </div>
          <Link to="/my-orders/new" className="ll-nav-browse">Browse food</Link>
          <button type="button" className="ll-nav-cta" onClick={onEnter}>
            Open workspace <ArrowRight size={15} />
          </button>
        </nav>
      </header>

      <section className="ll-hero">
        <div className="ll-hero-copy">
          <div className="ll-eyebrow"><span /> MADE FOR THE NEIGHBOURHOOD</div>
          <h1>Local roots.<br />Better routes.<br /><em>Closer together.</em></h1>
          <p>
            Helping neighbourhood businesses deliver thoughtfully—with
            happier riders, reliable promises and clearer decisions.
          </p>
          <div className="ll-hero-actions">
            <button type="button" className="ll-primary-cta" onClick={onEnter}>
              Step into your workspace <ArrowRight size={16} />
            </button>
            <a href="#approach" className="ll-secondary-cta">
              Our approach <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="ll-trust-points">
            <span><Check size={14} /> Every order, understood</span>
            <span><Check size={14} /> Every promise, considered</span>
          </div>
        </div>

        <div className="ll-hero-art">
          <div className="ll-art-glow" />
          <NeighbourhoodScene />
          <div className="ll-art-note">
            <span className="ll-art-note-icon"><Clock3 size={18} /></span>
            <span><small>The little things matter</small><strong>One promise at a time.</strong></span>
          </div>
        </div>
      </section>

      <section className="ll-value-strip" id="how-it-works">
        <div><span className="ll-value-icon"><Store size={20} /></span><span><strong>Local businesses first</strong><small>One clear place to make decisions</small></span></div>
        <div><span className="ll-value-icon"><Bike size={20} /></span><span><strong>A fairer day for riders</strong><small>Workloads you can actually handle</small></span></div>
        <div><span className="ll-value-icon"><Wallet size={20} /></span><span><strong>Know what you earn</strong><small>Costs and contribution before commitment</small></span></div>
      </section>

      <section className="ll-approach" id="approach">
        <div className="ll-section-heading">
          <div>
            <div className="ll-eyebrow"><span /> A BETTER WAY TO WORK</div>
            <h2>Good deliveries begin<br />with good decisions.</h2>
          </div>
          <p>
            From checking order economics to finding an available rider,
            Lane &amp; Local brings everyday delivery decisions together.
          </p>
        </div>

        <div className="ll-feature-grid">
          {highlights.map(({ icon: Icon, title, description }) => (
            <button className="ll-feature-card" key={title} onClick={onEnter}>
              <span className="ll-feature-icon"><Icon size={21} /></span>
              <ArrowUpRight className="ll-feature-arrow" size={18} />
              <strong>{title}</strong>
              <p>{description}</p>
              <span className="ll-feature-link">Explore workspace <ArrowRight size={13} /></span>
            </button>
          ))}
        </div>
      </section>

      <section className="ll-bottom-cta">
        <div>
          <div className="ll-bottom-eyebrow"><Leaf size={14} /> YOUR NEIGHBOURHOOD WORKSPACE</div>
          <h2>Shall we get moving?</h2>
          <p>Your next delivery decision starts here.</p>
        </div>
        <button type="button" onClick={onEnter}>Enter workspace <ArrowRight size={16} /></button>
      </section>

      <footer className="ll-footer">
        <Link to="/" className="ll-footer-logo">Lane <em>&amp; Local</em><b>.</b></Link>
        <span>Delivery, done thoughtfully.</span>
      </footer>
    </main>
  );
}
