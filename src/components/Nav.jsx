import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { openDevPanel } from './DevPanel.jsx';
import Icon, { Logo } from './Icons.jsx';

const LINKS = [
  ['/', 'Home'],
  ['/agents', 'Agents'],
  ['/demo', 'Live demo'],
  ['/about', 'About'],
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <header className={`nav ${scrolled ? 'is-scrolled' : ''} ${open ? 'is-open' : ''}`}>
      <div className="wrap nav-row">
        <Link className="logo" to="/" aria-label="ReviewMind home">
          <i>
            <Logo />
          </i>
          ReviewMind
        </Link>
        <nav className="nav-links" aria-label="Main">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {label}
            </NavLink>
          ))}
        </nav>
        <button className="dev-btn" type="button" onClick={openDevPanel} aria-label="For developers: architecture, model, API" title="For developers">
          <Icon name="code" />
          <span>Developers</span>
        </button>
        <Link className="btn solid nav-cta" to="/hire">
          Hire me
        </Link>
        <button className="menu-btn" type="button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name={open ? 'close' : 'menu'} />
        </button>
      </div>
      <div className="mobile-menu" hidden={!open}>
        {[...LINKS, ['/hire', 'Hire me']].map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
            <Icon name="arrow" />
          </NavLink>
        ))}
      </div>
    </header>
  );
}
