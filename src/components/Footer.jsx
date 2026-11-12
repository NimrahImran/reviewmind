import { Link } from 'react-router-dom';
import { SITE } from '../data/site.js';
import { openDevPanel } from './DevPanel.jsx';
import { Logo } from './Icons.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-row">
        <div className="footer-brand">
          <Link className="logo" to="/">
            <i>
              <Logo />
            </i>
            ReviewMind
          </Link>
          <p>Seven AI agents that read customer reviews in Roman Urdu and English.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/agents">Agents</Link>
          <Link to="/demo">Live demo</Link>
          <Link to="/about">About</Link>
          <Link to="/hire">Hire me</Link>
          <button type="button" className="footer-dev" onClick={openDevPanel}>
            For developers
          </button>
        </nav>
      </div>
      <div className="wrap footer-base">
        <span>
          Built by <strong>{SITE.owner}</strong>, {SITE.ownerRole}
        </span>
        <span>© {new Date().getFullYear()} ReviewMind</span>
      </div>
    </footer>
  );
}
