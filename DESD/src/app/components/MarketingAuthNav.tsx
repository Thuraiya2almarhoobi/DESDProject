import { Link } from 'react-router';

type MarketingAuthNavProps = {
  active?: 'login' | 'register' | null;
};

export function MarketingAuthNav({ active = null }: MarketingAuthNavProps) {
  return (
    <nav className="lfm-nav" aria-label="Primary">
      <Link to="/" className="lfm-logo">
        <span className="lfm-logo-icon" aria-hidden="true">&#127793;</span>
        Local Food Marketplace
      </Link>

      <div className="lfm-nav-buttons">
        <Link
          to="/login"
          className="lfm-btn lfm-btn-secondary"
          aria-current={active === 'login' ? 'page' : undefined}
        >
          Sign In
        </Link>
        <Link
          to="/select-portal?mode=register"
          className="lfm-btn lfm-btn-primary"
          aria-current={active === 'register' ? 'page' : undefined}
        >
          Sign Up
        </Link>
      </div>
    </nav>
  );
}
