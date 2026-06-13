/**
 * Vertxing — Real-Time Video Meeting Platform
 * ─────────────────────────────────────────────────────────────────────────────
 * File:    apps/web/app/page.tsx
 * Layer:   Web / Route (client component) — the landing page
 * Purpose: The public marketing front door. A motion-first hero (staggered
 *          reveal + parallax + a floating live-call mock), scroll-revealed
 *          feature and how-it-works sections, and conversion CTAs. Auth-aware:
 *          the nav swaps to "Open app" when a session exists. Pure presentation —
 *          all real product flows live behind /login, /register, /dashboard.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use client';

import { motion, useScroll, useTransform, type Variants } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  MessageSquareText,
  MonitorUp,
  ShieldCheck,
  Smile,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { Logo } from '@/components/brand/Logo';
import { useAuth } from '@/lib/auth-context';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09 } },
};

const FEATURES = [
  { icon: Video, title: 'Crystal-clear video', body: 'Adaptive WebRTC carried by a scalable SFU — smooth from 1:1 to a packed room.' },
  { icon: ShieldCheck, title: 'Waiting room + RBAC', body: 'Approve who enters. Hosts and co-hosts can mute, remove, or end for everyone.' },
  { icon: MessageSquareText, title: 'Live chat & reactions', body: 'Talk and react in real time over the data channel — no third-party plugins.' },
  { icon: CalendarClock, title: 'Schedule & reschedule', body: 'Plan ahead or start instantly. Move meetings around with a tap.' },
  { icon: MonitorUp, title: 'One-tap screen share', body: 'Present a window or your whole screen with a single control.' },
  { icon: Sparkles, title: 'AI recaps', body: 'Automatic summaries and action items, so nobody takes notes again.', soon: true },
];

const STEPS = [
  { icon: Video, title: 'Start or schedule', body: 'Spin up an instant room or put one on the calendar.' },
  { icon: Users, title: 'Share the link', body: 'Send the link or code. Guests knock; you let them in.' },
  { icon: Smile, title: 'Meet beautifully', body: 'Chat, react, present, and wrap with an AI recap.' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const mockY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const mockRotate = useTransform(scrollYProgress, [0, 1], [0, -6]);

  const primaryHref = user ? '/app' : '/register';
  const primaryLabel = user ? 'Open app' : 'Get started free';

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* Nav */}
      <nav
        className="glass"
        style={{
          position: 'sticky',
          top: 12,
          zIndex: 50,
          margin: '12px auto 0',
          maxWidth: 1100,
          width: 'calc(100% - 28px)',
          borderRadius: 999,
          padding: '10px 18px',
        }}
      >
        <div className="between">
          <Logo size={24} />
          <div className="row" style={{ gap: 10 }}>
            {user ? (
              <Link href="/app" className="btn btn-sm">
                Open app <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm hide-mobile">
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-sm">
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header ref={heroRef} className="container" style={{ paddingTop: 70, paddingBottom: 40, textAlign: 'center' }}>
        <motion.div variants={stagger} initial="hidden" animate="show">
          <motion.div variants={fadeUp} style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <span className="chip">
              <Sparkles size={14} /> Meetings, reimagined
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} style={{ fontSize: 'clamp(38px, 7vw, 72px)', lineHeight: 1.05, maxWidth: 900, margin: '0 auto' }}>
            The video platform your team will <span className="gradient-text">actually love</span>.
          </motion.h1>

          <motion.p variants={fadeUp} className="muted" style={{ fontSize: 'clamp(16px, 2.2vw, 20px)', maxWidth: 620, margin: '20px auto 0' }}>
            Instant rooms, waiting-room control, live chat and reactions, and AI recaps —
            wrapped in an interface that feels fast and effortless.
          </motion.p>

          <motion.div variants={fadeUp} className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
            <Link href={primaryHref} className="btn" style={{ padding: '14px 24px', fontSize: 16 }}>
              {primaryLabel} <ArrowRight size={18} />
            </Link>
            <Link href="/login" className="btn btn-ghost" style={{ padding: '14px 24px', fontSize: 16 }}>
              Sign in
            </Link>
          </motion.div>
          <motion.p variants={fadeUp} className="faint" style={{ fontSize: 13, marginTop: 14 }}>
            No credit card · Be in a call in 30 seconds
          </motion.p>
        </motion.div>

        {/* Floating product mock */}
        <motion.div style={{ y: mockY, rotate: mockRotate, marginTop: 56, perspective: 1200 }}>
          <CallMock />
        </motion.div>
      </header>

      {/* Features */}
      <Section title="Everything a meeting needs" subtitle="No add-ons, no clutter — just the tools that matter, built in.">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} variants={fadeUp} className="card card-hover">
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 12,
                  background: 'var(--grad-brand-soft)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 14,
                  color: 'var(--brand-3)',
                }}
              >
                <f.icon size={22} />
              </div>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <strong style={{ fontSize: 17 }}>{f.title}</strong>
                {f.soon && <span className="badge badge-muted-meta">Soon</span>}
              </div>
              <p className="muted" style={{ fontSize: 14 }}>{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* How it works */}
      <Section title="Up and running in three steps" subtitle="From zero to face-to-face, fast.">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}
        >
          {STEPS.map((s, i) => (
            <motion.div key={s.title} variants={fadeUp} className="card" style={{ position: 'relative' }}>
              <span className="gradient-text" style={{ fontSize: 40, fontWeight: 800, opacity: 0.5 }}>
                0{i + 1}
              </span>
              <div className="row" style={{ gap: 10, margin: '8px 0 6px' }}>
                <s.icon size={20} style={{ color: 'var(--brand-2)' }} />
                <strong style={{ fontSize: 17 }}>{s.title}</strong>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* CTA */}
      <Section>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="card"
          style={{ textAlign: 'center', padding: '54px 24px', background: 'var(--grad-brand-soft)' }}
        >
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)' }}>
            Your next meeting could be <span className="gradient-text">remarkable</span>.
          </h2>
          <p className="muted" style={{ maxWidth: 460, margin: '12px auto 24px' }}>
            Join teams already meeting the better way.
          </p>
          <Link href={primaryHref} className="btn" style={{ padding: '14px 26px', fontSize: 16 }}>
            {primaryLabel} <ArrowRight size={18} />
          </Link>
        </motion.div>
      </Section>

      {/* Footer */}
      <footer className="container between" style={{ paddingTop: 24, paddingBottom: 48, flexWrap: 'wrap', gap: 12 }}>
        <Logo size={20} />
        <span className="faint" style={{ fontSize: 13 }}>
          © 2026 Vertxing. Built for people who meet.
        </span>
      </footer>
    </div>
  );
}

/** Section wrapper with a scroll-revealed heading. */
function Section({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="container" style={{ paddingTop: 60, paddingBottom: 20 }}>
      {title && (
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          style={{ textAlign: 'center', marginBottom: 34 }}
        >
          <motion.h2 variants={fadeUp} style={{ fontSize: 'clamp(26px, 4vw, 38px)' }}>{title}</motion.h2>
          {subtitle && (
            <motion.p variants={fadeUp} className="muted" style={{ marginTop: 8, maxWidth: 560, marginInline: 'auto' }}>
              {subtitle}
            </motion.p>
          )}
        </motion.div>
      )}
      {children}
    </section>
  );
}

/** Animated mock of the in-call UI, floating gently. */
function CallMock() {
  const seats = ['AR', 'ZK', 'MJ', 'PD', 'SL', 'TN'];
  return (
    <motion.div
      animate={{ y: [0, -12, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="glass"
      style={{ maxWidth: 880, margin: '0 auto', padding: 16, borderRadius: 22 }}
    >
      <div className="between" style={{ marginBottom: 12, padding: '2px 6px' }}>
        <span className="badge badge-live"><span className="dot" /> LIVE</span>
        <span className="chip" style={{ fontSize: 12 }}>{seats.length} people</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {seats.map((s, i) => (
          <motion.div
            key={s}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            style={{
              aspectRatio: '16/10',
              borderRadius: 12,
              background: 'linear-gradient(160deg, rgba(124,92,255,0.18), rgba(52,224,200,0.10))',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: 46, height: 46, borderRadius: '50%', background: 'var(--grad-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
              }}
            >
              {s}
            </div>
          </motion.div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 14 }}>
        {[Video, MonitorUp, MessageSquareText, Users].map((Icon, i) => (
          <div key={i} className="ctrl" style={{ width: 42, height: 42 }}>
            <Icon size={17} />
          </div>
        ))}
        <div className="ctrl danger" style={{ width: 42, height: 42 }}>
          <Video size={17} />
        </div>
      </div>
    </motion.div>
  );
}
