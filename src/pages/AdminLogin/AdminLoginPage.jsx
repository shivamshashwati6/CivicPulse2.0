import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, KeyRound, Mail, Lock, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function AdminLoginPage() {
  const { adminLogin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [authMode, setAuthMode] = useState('passcode'); // 'passcode' or 'credentials'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let res;
      if (authMode === 'passcode') {
        if (!passcode.trim()) {
          toast.error('Please enter the Municipal Security Passcode.');
          setIsSubmitting(false);
          return;
        }
        res = await adminLogin({ passcode: passcode.trim() });
      } else {
        if (!email.trim() || !password) {
          toast.error('Please enter your municipal email and password.');
          setIsSubmitting(false);
          return;
        }
        res = await adminLogin({ email: email.trim(), password });
      }

      if (res.success) {
        toast.success('Municipal Authority Authenticated successfully.');
        navigate('/admin');
      } else {
        toast.error(res.error?.message || 'Access Denied: Invalid Admin Credentials or Passcode.');
      }
    } catch (err) {
      console.error('Admin authentication error:', err);
      toast.error('Authentication failure. Please verify your admin credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-[#0a0f1d] text-slate-900 dark:text-slate-100 relative overflow-hidden transition-colors duration-300">
      {/* Background Glow Overlay */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        
        {/* Portal Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400 mb-2 shadow-lg shadow-blue-500/10">
            <Building2 className="w-8 h-8" />
          </div>
          
          <div className="space-y-1">
            <Badge variant="indigo" className="text-[10px] uppercase font-bold tracking-widest bg-blue-100 dark:bg-blue-900/60 border border-blue-200 dark:border-blue-700/50 text-blue-800 dark:text-blue-300 px-3 py-1">
              Municipal Portal Access
            </Badge>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors duration-300">
              Admin Authority Login
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto transition-colors duration-300">
              Restricted portal for municipal staff, city engineers, and emergency dispatch teams.
            </p>
          </div>
        </div>

        {/* Authentication Card */}
        <Card className="bg-white border border-slate-200 shadow-xl dark:bg-slate-900/80 dark:border-slate-800 p-6 sm:p-8 backdrop-blur-xl transition-colors duration-300">
          
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 text-xs font-semibold transition-colors duration-300">
            <button
              type="button"
              onClick={() => setAuthMode('passcode')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'passcode'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Security Passcode
            </button>

            <button
              type="button"
              onClick={() => setAuthMode('credentials')}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'credentials'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Staff Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {authMode === 'passcode' ? (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-300">
                  Municipal Security Passcode <span className="text-rose-500 dark:text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Enter municipal security passcode"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    required
                    className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-10 focus:border-blue-500 text-sm transition-colors duration-300"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-300">
                    Municipal Email <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="admin@civicpulse.gov"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-10 focus:border-blue-500 text-sm transition-colors duration-300"
                    />
                    <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors duration-300">
                    Password <span className="text-rose-500 dark:text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-10 focus:border-blue-500 text-sm transition-colors duration-300"
                    />
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-3 pointer-events-none" />
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Enter Admin Panel <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </form>
        </Card>

        {/* Back to Citizen App Link */}
        <div className="text-center">
          <Link
            to="/login"
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors font-medium hover:underline inline-flex items-center"
          >
            ← Back to Citizen Login
          </Link>
        </div>

      </div>
    </div>
  );
}
