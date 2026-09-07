import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Camera,
  Sparkles,
  MapPin,
  Clock,
  CheckCircle2,
  BrainCircuit,
  Send,
  BarChart3,
  Layers,
  ShieldCheck,
  ArrowRight,
  Mail,
  Phone,
  Building2,
  Activity,
  Users,
  PlusCircle
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import heroArchitecture from '../../assets/hero_architecture.jpg';

export function LandingPage() {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (contactForm.name && contactForm.email && contactForm.message) {
      setContactSubmitted(true);
      setTimeout(() => {
        setContactSubmitted(false);
        setContactForm({ name: '', email: '', subject: '', message: '' });
      }, 4000);
    }
  };

  const stats = [
    { label: 'Issues Reported', value: '25,400+', icon: Activity, change: '+12% this month' },
    { label: 'Issues Resolved', value: '94.8%', icon: CheckCircle2, change: '24hr avg SLA' },
    { label: 'Active Citizens', value: '120,000+', icon: Users, change: 'Across 14 cities' },
    { label: 'Departments Connected', value: '45+', icon: Building2, change: 'Public works & sanitation' },
  ];

  const features = [
    {
      icon: BrainCircuit,
      title: 'AI Image Triage',
      description: 'Google Gemini AI vision models classify issue categories and rate urgency scores instantly from photo uploads.',
    },
    {
      icon: Send,
      title: 'Automated Department Routing',
      description: 'Smart ticket payloads are instantly dispatched to the appropriate municipal engineering or sanitation team.',
    },
    {
      icon: MapPin,
      title: 'Precise Geolocation Tagging',
      description: 'Automated GPS metadata extraction maps exact coordinates for OpenStreetMap GIS visualization.',
    },
    {
      icon: Clock,
      title: 'Real-Time Status Tracking',
      description: 'Transparent lifecycle tracking keeps citizens notified from initial report upload to final verified fix.',
    },
    {
      icon: Layers,
      title: 'Duplicate Issue Merging',
      description: 'AI pattern recognition detects and merges duplicate community reports, preventing municipal inbox congestion.',
    },
    {
      icon: BarChart3,
      title: 'Municipal Analytics & Heatmaps',
      description: 'Executive dashboards provide local authorities with SLA performance metrics and infrastructure heatmaps.',
    },
  ];

  const steps = [
    {
      step: '01',
      title: 'Capture',
      icon: Camera,
      description: 'Citizens snap a clear photo of the civic problem on any smartphone.',
    },
    {
      step: '02',
      title: 'AI Analysis',
      icon: Sparkles,
      description: 'Gemini AI evaluates the image, determines severity, and tags GPS coordinates.',
    },
    {
      step: '03',
      title: 'Smart Routing',
      icon: Send,
      description: 'The ticket payload is automatically dispatched to the responsible municipal department.',
    },
    {
      step: '04',
      title: 'Resolution',
      icon: CheckCircle2,
      description: 'Field crews complete repairs and upload verified resolution proof for citizens.',
    },
  ];

  return (
    <div className="space-y-24 pb-20 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* HERO SECTION */}
      <section id="home" className="relative pt-12 lg:pt-20 pb-8 overflow-hidden transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column Text Content */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/30">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Next-Gen Civic Technology Platform</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Report Smarter. <br />
                <span className="text-blue-600 dark:text-blue-400">Fix Faster.</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                AI-powered civic issue reporting platform that helps citizens report public problems and enables authorities to resolve them efficiently.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
                <Link to="/report" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg shadow-blue-600/25">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Report Issue
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>

                <Link to="/admin/login" className="w-full sm:w-auto">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700/80 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 px-6 py-3.5 rounded-xl font-semibold flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Admin Portal Login
                  </Button>
                </Link>
              </div>

            </div>

            {/* Right Column Product Architecture Graphic */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[500px] lg:max-w-none rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-900/5 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] transition-all duration-300">
                <img
                  src={heroArchitecture}
                  alt="CivicPulse Architecture - AI Triage Engine, GIS Mapping Network & Real-Time Database Schema"
                  className="w-full h-auto object-cover rounded-3xl"
                />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-white/80 dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-2xl p-8 sm:p-10 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          {stats.map((stat, i) => (
            <div key={i} className="space-y-2 border-b sm:border-b-0 sm:border-r border-slate-200/80 dark:border-slate-800/80 last:border-0 pb-6 sm:pb-0 pr-0 sm:pr-6">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-semibold uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{stat.value}</p>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{stat.change}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/30">
            <BrainCircuit className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Platform Capabilities</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            Engineered for High-Impact Municipal Efficiency
          </h2>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            From automated AI triage to OpenStreetMap GIS map visualization, CivicPulse streamlines the complete lifecycle of municipal maintenance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, i) => (
            <div
              key={i}
              className="p-6 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 rounded-2xl space-y-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-500/30">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/30">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Simple 4-Step Workflow</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            How CivicPulse Resolves Infrastructure Issues
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative p-6 bg-white/80 dark:bg-slate-900/60 dark:backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] hover:dark:border-blue-500/40 hover:dark:shadow-[0_0_20px_rgba(59,130,246,0.15)] space-y-4 transition-all duration-300">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400 font-mono">{step.step}</span>
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-slate-200/80 dark:border-slate-700/80">
                  <step.icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{step.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 bg-white/80 dark:bg-slate-900/60 dark:backdrop-blur-xl text-slate-900 dark:text-white rounded-2xl p-8 sm:p-12 shadow-sm border border-slate-200/80 dark:border-slate-800/80 dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
          
          {/* Left Column: Contact Details */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/30">
                <Mail className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Municipal Relations</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                Deploy CivicPulse in Your Municipality
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Interested in deploying CivicPulse for your city or public works department? Contact our team for institutional onboarding.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Institutional Email</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">support@civicpulse.ai</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Emergency & Support</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">+1 (800) 555-CIVIC</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/30 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Headquarters</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">100 Innovation Way, Suite 400</p>
                </div>
              </div>
            </div>

            {/* Quick Link to Admin Login */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
              <Link to="/admin/login" className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                <ShieldCheck className="w-4 h-4" />
                Municipal Authority Portal Sign In →
              </Link>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/40 text-slate-900 dark:text-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-700/80 transition-colors">
            {contactSubmitted ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center border border-emerald-200 dark:border-emerald-500/30">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Message Received!</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm mx-auto">
                  Thank you for reaching out. Our municipal onboarding team will contact you within 24 hours.
                </p>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Send an Inquiry</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane Doe"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Official Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="jane@city.gov"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Subject</label>
                  <input
                    type="text"
                    placeholder="Municipal Deployment / General Inquiry"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Message *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Tell us about your city, department, or inquiry..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors resize-none"
                  />
                </div>

                <Button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md shadow-blue-600/20">
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </Button>
              </form>
            )}
          </div>

        </div>
      </section>

    </div>
  );
}
