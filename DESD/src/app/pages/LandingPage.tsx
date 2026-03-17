import { Link } from 'react-router';

import { MarketingAuthNav } from '../components/MarketingAuthNav';
import '../../styles/marketing-auth.css';

const stats = [
  { number: '28+', label: 'Local Producers' },
  { number: '500+', label: 'Fresh Products' },
  { number: '48h', label: 'Average Delivery' },
];

const features = [
  {
    icon: '\u{1F96C}',
    title: 'Farm Fresh Quality',
    description:
      'Direct from local producers to your table. Seasonal produce at peak freshness with full transparency on sourcing.',
  },
  {
    icon: '\u{1F4CD}',
    title: 'Local Sourcing',
    description:
      'Know exactly where your food comes from. Track food miles, harvest dates, and connect directly with producers.',
  },
  {
    icon: '\u{1F69A}',
    title: 'Fast Delivery',
    description:
      'Coordinated community deliveries in 48 hours or less. Multiple delivery options tailored to your needs.',
  },
  {
    icon: '\u{1F49A}',
    title: 'Supporting Community',
    description:
      'Every purchase directly supports local farmers and producers, strengthening your neighborhood economy.',
  },
  {
    icon: '\u{1F512}',
    title: 'Transparent & Safe',
    description:
      'Full allergen information, organic certification details, and detailed product sourcing for complete peace of mind.',
  },
  {
    icon: '\u{1F381}',
    title: 'Flexible Orders',
    description:
      'One-off purchases, recurring orders, or bulk community buys. Order exactly what you need, when you need it.',
  },
];

const roles = [
  {
    icon: '\u{1F6D2}',
    title: 'Customer',
    description:
      'Shop fresh local produce and products. Support local farmers while enjoying the highest quality ingredients.',
    cta: 'Shop Now',
    role: 'CUSTOMER',
  },
  {
    icon: '\u{1F3EA}',
    title: 'Restaurant',
    description:
      'Source consistent supply of premium local ingredients. Create repeatable orders and manage your supply chain efficiently.',
    cta: 'Partner With Us',
    role: 'RESTAURANT',
  },
  {
    icon: '\u{1F465}',
    title: 'Community Organizer',
    description:
      'Coordinate bulk orders across your network. Manage community deliveries and support local food access for all.',
    cta: 'Get Involved',
    role: 'COMMUNITY',
  },
  {
    icon: '\u{1F33E}',
    title: 'Producer',
    description:
      'Sell directly to your local community. Reach customers who value quality and are willing to pay fairly for your work.',
    cta: 'Sell Your Produce',
    role: 'PRODUCER',
  },
];

export function LandingPage() {
  return (
    <div className="lfm-page">
      <MarketingAuthNav />

      <main>
        <section className="lfm-hero">
          <div className="lfm-hero-content">
            <h1>Local Food, Fresher Every Day</h1>
            <p>
              Connect directly with local farmers, producers, and community vendors. Buy fresh, eat local, support your
              neighbors.
            </p>
            <div className="lfm-hero-buttons">
              <Link to="/select-portal?mode=register" className="lfm-btn lfm-btn-primary lfm-btn-large">
                Get Started
              </Link>
              <a href="#features" className="lfm-btn lfm-btn-secondary lfm-btn-large">
                Learn More
              </a>
            </div>

            <div className="lfm-stats">
              {stats.map((stat) => (
                <div key={stat.label} className="lfm-stat-item">
                  <div className="lfm-stat-number">{stat.number}</div>
                  <div className="lfm-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="lfm-features">
          <div className="lfm-section-header">
            <div className="lfm-section-label">Why Choose Us</div>
            <h2 className="lfm-section-title">Built for Your Community</h2>
            <p className="lfm-section-subtitle">
              Everything you need to support local agriculture and build stronger communities
            </p>
          </div>

          <div className="lfm-features-grid">
            {features.map((feature) => (
              <article key={feature.title} className="lfm-feature-card">
                <div className="lfm-feature-icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lfm-roles">
          <div className="lfm-roles-content">
            <div className="lfm-section-header">
              <div className="lfm-section-label">Get Involved</div>
              <h2 className="lfm-section-title">Choose Your Role</h2>
              <p className="lfm-section-subtitle">Multiple ways to participate in our local food community</p>
            </div>

            <div className="lfm-roles-grid">
              {roles.map((role) => (
                <article key={role.title} className="lfm-role-card">
                  <div className="lfm-role-icon" aria-hidden="true">
                    {role.icon}
                  </div>
                  <h3>{role.title}</h3>
                  <p>{role.description}</p>
                  <Link to={`/select-portal?mode=register`} className="lfm-btn">
                    {role.cta}
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="lfm-marketing-footer">
        <p>&copy; 2026 Local Food Marketplace. Supporting local farmers and communities.</p>
        <p>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </p>
      </footer>
    </div>
  );
}
