import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, LogIn, UserPlus, Shield, Loader2, AlertCircle, MailCheck, Settings } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [emailUnconfirmedAlert, setEmailUnconfirmedAlert] = useState(false);
  const [emailDisabledAlert, setEmailDisabledAlert] = useState(false);
  const [signUpSuccessMsg, setSignUpSuccessMsg] = useState('');

  const { login, signup } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const toggleMode = () => {
    setIsSignUp((prev) => !prev);
    setPassword('');
    setConfirmPassword('');
    setEmailUnconfirmedAlert(false);
    setEmailDisabledAlert(false);
    setSignUpSuccessMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEmailUnconfirmedAlert(false);
    setEmailDisabledAlert(false);
    setSignUpSuccessMsg('');

    if (!email || !password) {
      toast.error('Please fill in all required fields.');
      return;
    }

    if (isSignUp) {
      if (password !== confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        toast.error('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error, session } = await signup(email, password, fullName);
        if (error) {
          const msg = error.message || '';
          if (msg.toLowerCase().includes('disabled')) {
            setEmailDisabledAlert(true);
            toast.error('Email authentication is disabled in your Supabase dashboard.');
          } else {
            toast.error(msg || 'Signup failed. Please try again.');
          }
        } else if (session) {
          toast.success('Account created and logged in!');
          navigate('/dashboard');
        } else {
          setSignUpSuccessMsg(`Confirmation email sent to ${email}. Please check your inbox and verify before signing in.`);
          toast.info('Check your email inbox to confirm your account.');
          setIsSignUp(false);
        }
      } else {
        const { error } = await login(email, password);
        if (error) {
          const msg = error.message || '';
          if (msg.toLowerCase().includes('email not confirmed')) {
            setEmailUnconfirmedAlert(true);
            toast.error('Email not confirmed. Please check your inbox for the verification link.');
          } else if (msg.toLowerCase().includes('disabled')) {
            setEmailDisabledAlert(true);
            toast.error('Email login is currently disabled in your Supabase project.');
          } else {
            toast.error(msg || 'Invalid email or password.');
          }
        } else {
          toast.success('Login Success! Welcome back.');
          navigate('/dashboard');
        }
      }
    } catch (err) {
      toast.error(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <Card className="shadow-lg border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 backdrop-blur-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 mb-2">
            <Activity className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
            {isSignUp ? 'Create CivicPulse Account' : 'Sign In to CivicPulse'}
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {isSignUp
              ? 'Join your community to report issues and track municipal resolutions.'
              : 'Access your civic reporting dashboard and track active issues.'}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {signUpSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
              <MailCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{signUpSuccessMsg}</p>
            </div>
          )}

          {emailDisabledAlert && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-rose-800 dark:text-rose-300">
                <Settings className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>Email Provider is Disabled in Supabase</span>
              </div>
              <p className="leading-relaxed text-rose-700 dark:text-rose-300/90">
                Email Authentication has been turned off in your Supabase project settings.
              </p>
              <div className="pt-1 text-[11px] text-rose-900/90 dark:text-rose-300/80 border-t border-rose-200/60 dark:border-rose-800/60 font-mono leading-relaxed">
                <strong>Fix in Supabase Dashboard:</strong><br />
                1. Go to <em>Authentication &gt; Providers &gt; Email</em><br />
                2. Turn <strong>"Enable Email provider"</strong> to <strong>ON</strong><br />
                3. Click <strong>Save</strong>
              </div>
            </div>
          )}

          {emailUnconfirmedAlert && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Email Address Not Confirmed</span>
              </div>
              <p className="leading-relaxed text-amber-700 dark:text-amber-300/90">
                Supabase requires email confirmation before logging in. Please check your inbox (and spam folder) for the verification link.
              </p>
              <div className="pt-1 text-[11px] text-amber-800/80 dark:text-amber-300/80 border-t border-amber-200/60 dark:border-amber-800/60">
                <strong>Dev Tip:</strong> To disable email verification for testing, go to your <em>Supabase Dashboard &gt; Authentication &gt; Providers &gt; Email</em> and turn off <strong>"Confirm email"</strong>.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <Input
                label="Full Name"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="citizen@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {isSignUp && (
              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            )}

            {!isSignUp && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500" />
                  Remember me
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info('Password reset instructions will be sent to your email.');
                  }}
                  className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-medium shadow-md shadow-blue-600/20 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4 ml-0 mr-2" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 ml-0 mr-2" />
                  Sign In
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline focus:outline-none cursor-pointer"
              >
                {isSignUp ? 'Sign In' : 'Create Account'}
              </button>
            </p>
            <div className="flex items-center justify-center gap-1.5 text-slate-400 text-xs pt-2">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <span>Secured with Supabase Authentication</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
