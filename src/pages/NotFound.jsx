import { Link } from 'react-router-dom';
import Icon from '../components/Icons.jsx';

export default function NotFound() {
  return (
    <section className="notfound">
      <img src="/img/echo-head.webp" alt="" width="160" height="160" />
      <h1>Page not found</h1>
      <p>Even Lens couldn’t find this page. It may have moved.</p>
      <Link className="btn solid" to="/">
        Back to home <Icon name="arrow" />
      </Link>
    </section>
  );
}
