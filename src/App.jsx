import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import DevPanel from './components/DevPanel.jsx';
import Footer from './components/Footer.jsx';
import Nav from './components/Nav.jsx';
import About from './pages/About.jsx';
import Agents from './pages/Agents.jsx';
import Demo from './pages/Demo.jsx';
import Hire from './pages/Hire.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

const TITLES = {
  '/': 'ReviewMind · AI review analysis for Roman Urdu and English',
  '/agents': 'The agents · ReviewMind',
  '/demo': 'Live demo · ReviewMind',
  '/about': 'About · ReviewMind',
  '/hire': 'Hire me · ReviewMind',
};

export default function App() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = TITLES[pathname] || 'Page not found · ReviewMind';
    if (!hash || hash === '#developers') window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/about" element={<About />} />
          <Route path="/hire" element={<Hire />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <DevPanel />
    </>
  );
}
