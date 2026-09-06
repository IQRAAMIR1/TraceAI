import { Link } from 'react-router-dom';
import {
  FilePlus2,
  Eye,
  Search,
  ShieldCheck,
  Users,
  Landmark,
  ClipboardEdit,
  Brain,
  TrendingUp,
  MapPinned,
  Heart,
  ChevronRight,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import PakistanMotif from '../components/PakistanMotif';
import pakistanHeroMobile from '../assets/pakistan-hero-mobile.jpg';

export default function Landing() {
  return (
    <div className="page">
      <header className="hero-dark has-mobile-bg">
        <img src={pakistanHeroMobile} alt="" className="hero-mobile-bg" aria-hidden="true" />
        <PakistanMotif />
        <div className="container">
          <Navbar />

          <div style={{ maxWidth: 560, marginTop: '1.5rem' }}>
            <h1 className="hero-headline" style={{ lineHeight: 1.15, margin: '0 0 1rem' }}>
              Find Missing People. <span style={{ color: 'var(--color-accent-light)' }}>Faster.</span>
              <br />
              <span style={{ color: 'var(--color-accent-light)' }}>Smarter.</span> Together.{' '}
              <Heart size={28} color="var(--color-accent-light)" style={{ verticalAlign: 'middle' }} />
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', marginBottom: '2rem' }}>
              TraceAI connects families, citizens, NGOs and law enforcement through AI-powered
              matching, verified sightings and real-time intelligence.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', maxWidth: 360 }}>
              <Link to="/report" className="btn btn-primary">
                <FilePlus2 size={18} /> Report a Missing Person <ChevronRight size={16} />
              </Link>
              <Link to="/sighting" className="btn btn-outline">
                <Eye size={18} /> Submit a Sighting <ChevronRight size={16} />
              </Link>
              <Link to="/browse" className="btn btn-outline">
                <Search size={18} /> Browse Missing Persons <ChevronRight size={16} />
              </Link>
            </div>

            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '1.25rem' }}>
              <ShieldCheck size={16} /> Your information is secure and confidential
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={16} /> Trusted by Families
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users size={16} /> NGOs
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Landmark size={16} /> Law Enforcement
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="section-light">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.6rem' }}>How TraceAI Works</h2>
          <div className="steps-grid">
            <Step icon={<ClipboardEdit size={26} />} num={1} title="Report" text="Report a missing person with details and photo" />
            <Step icon={<Eye size={26} />} num={2} title="Sightings Submitted" text="Citizens & NGOs submit possible sightings" />
            <Step icon={<Brain size={26} />} num={3} title="AI Matches & Verifies" text="Our AI matches, verifies and scores credibility" />
            <Step icon={<ShieldCheck size={26} />} num={4} title="Police Get Prioritized Leads" text="High confidence leads delivered to authorities" />
          </div>
        </div>
      </section>

      <section className="section-light" style={{ paddingTop: 0 }}>
        <div className="container">
          <h2 style={{ fontSize: '1.6rem', textAlign: 'center' }}>Powerful AI Features</h2>
          <div className="feature-grid">
            <FeatureCard
              icon={<Brain size={22} />}
              title="AI Face Matching"
              text="Advanced visual and descriptive comparison for accurate matches"
            />
            <FeatureCard
              icon={<TrendingUp size={22} />}
              title="Match Confidence Scoring"
              text="AI scores every sighting against open cases for reliability"
            />
            <FeatureCard
              icon={<MapPinned size={22} />}
              title="Smart Hotspot Map"
              text="Real-time sighting clusters help focus search efforts"
            />
            <FeatureCard
              icon={<ShieldCheck size={22} />}
              title="Private by Design"
              text="Sighting photos stay private — only staff and reporters can view them"
            />
          </div>

          <Link to="/browse" className="cta-banner">
            <span className="cta-banner-icon">
              <Heart size={20} />
            </span>
            <span style={{ flex: 1 }}>
              <strong style={{ display: 'block' }}>Every Minute Matters</strong>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                Together, we can bring them home.
              </span>
            </span>
            <span className="cta-banner-arrow">
              <ChevronRight size={18} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Step({ icon, title, text }) {
  return (
    <div>
      <div className="step-circle">{icon}</div>
      <h3 style={{ margin: '0 0 0.4rem' }}>{title}</h3>
      <p className="muted" style={{ fontSize: '0.88rem' }}>{text}</p>
    </div>
  );
}

function FeatureCard({ icon, title, text }) {
  return (
    <div className="feature-card">
      <span className="icon-badge">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
