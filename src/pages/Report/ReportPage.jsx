import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  Sparkles,
  MapPin,
  Camera,
  FileText,
  Send,
  Loader2,
  X,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LocationPicker } from '../../components/common/LocationPicker';
import { ISSUE_CATEGORIES, SEVERITY_LEVELS } from '../../utils/constants';
import { analyzeImageWithGemini, geminiService } from '../../services/geminiService';
import { issueService } from '../../services/issueService';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

import { supabase } from '../../services/supabaseClient';

function formatConfidencePercentage(val) {
  if (val === null || val === undefined) return '85%';
  const num = Number(val);
  if (isNaN(num)) return '85%';
  if (num <= 1) {
    return `${Math.round(num * 100)}%`;
  }
  return `${Math.round(num)}%`;
}

export function ReportPage() {
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('pothole');
  const [severity, setSeverity] = useState('Medium');
  const [description, setDescription] = useState('');

  // Location State (Initial state unconfirmed - NO hardcoded defaults)
  const [locationData, setLocationData] = useState({
    address: '',
    latitude: null,
    longitude: null,
    locationSelected: false,
    accuracy: null,
  });

  // Image Upload & AI State
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds 10MB limit.');
        return;
      }
      setSelectedFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
      runAiAnalysis(file);
    }
  };

  // Run Gemini 1.5 Vision Analysis
  const runAiAnalysis = async (file) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeImageWithGemini(file);
      setAiAnalysisResult(result);

      if (result.category && result.confidence > 0.4) {
        setCategory(result.category.toLowerCase());
      }
      if (result.severity) {
        setSeverity(result.severity);
      }
      if (result.suggestedTitle) {
        setTitle(result.suggestedTitle);
      }
      if (result.descriptionSummary) {
        setDescription(result.descriptionSummary);
      }

      toast.success(`AI Analysis Complete! Detected ${result.category || 'civic issue'}.`);
    } catch (err) {
      console.error('AI Analysis failed:', err);
      toast.error('AI pre-analysis failed. Please fill details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setAiAnalysisResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Resilient Form Submission Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Immediately flag submission in progress to lock UI & prevent rapid double-clicks
    setIsSubmitting(true);

    try {
      if (authLoading) {
        toast.info('Restoring authentication session... Please try submitting again in a moment.');
        return;
      }

      if (!title.trim() || !description.trim()) {
        toast.error('Please enter an issue title and description.');
        return;
      }

      const latNum = Number(locationData.latitude);
      const lngNum = Number(locationData.longitude);

      if (
        !locationData.locationSelected ||
        locationData.latitude === null ||
        locationData.latitude === undefined ||
        locationData.longitude === null ||
        locationData.longitude === undefined ||
        isNaN(latNum) ||
        isNaN(lngNum) ||
        latNum < -90 ||
        latNum > 90 ||
        lngNum < -180 ||
        lngNum > 180 ||
        !locationData.address ||
        !locationData.address.trim()
      ) {
        toast.error('Please select a valid location on the map before submitting.');
        return;
      }

      // Verify actual Supabase authentication session as single source of truth
      let activeUser = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          activeUser = session.user;
        }
      } catch (authErr) {
        console.warn('Could not fetch session from supabase.auth.getSession():', authErr);
      }

      if (!activeUser && user?.id) {
        activeUser = user;
      }

      if (!activeUser || !activeUser.id) {
        toast.error('Please log in with an authenticated account to submit a report.');
        navigate('/login');
        return;
      }

      // 1. Upload image via issueService (handles Supabase storage with base64 fallback)
      let uploadedImageUrl = null;
      if (selectedFile) {
        const uploadRes = await issueService.uploadComplaintImage(selectedFile, activeUser.id);
        uploadedImageUrl = uploadRes.publicUrl || null;
      }

      // 2. Create Issue Record via issueService (verifies active session)
      console.log('[Location] complaint submission starts...');
      console.log('[Location] final selected location:', {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        source: locationData.source,
        accuracy: locationData.accuracy,
      });

      const res = await issueService.createIssue({
        userId: activeUser.id,
        userEmail: activeUser.email || '',
        userName: activeUser.user_metadata?.full_name || activeUser.user_metadata?.name || activeUser.email || 'Citizen User',
        title: title.trim(),
        description: description.trim(),
        category,
        severity,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        address: locationData.address,
        priority: severity === 'Critical' ? 'High' : severity === 'High' ? 'High' : 'Medium',
        imageUrl: uploadedImageUrl,
      });

      const createdIssue = res?.data;
      const error = res?.error;
      const isDuplicate = res?.isDuplicate || createdIssue?.isDuplicate;

      if (error && (!createdIssue || !createdIssue.id)) {
        toast.error(`Submission failed: ${error.message || 'Server error'}`);
      } else if (isDuplicate) {
        toast.info('Similar open issue detected nearby (within 100m). Your support ("I Face This Too") was automatically added to the existing report!');
        navigate('/dashboard');
      } else {
        // 3. Optional: save AI analysis metadata safely in background if ID exists
        if (createdIssue?.id && selectedFile) {
          geminiService.processAndSaveAiAnalysis(createdIssue.id, selectedFile).catch((aiErr) => {
            console.warn('Background AI analysis update notice:', aiErr);
          });
        }

        toast.success('Civic Issue Report Submitted Successfully!');
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Report submission exception:', err);
      toast.error(`Submission failed: ${err.message || 'Network error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      {/* Header */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/30">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Google Gemini Vision Powered</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Report a Civic Issue
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Upload a photo of public infrastructure damage. Our AI model will auto-classify the category, severity rating, and location.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Step 1: Image Upload & AI Triage */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              1. Issue Photo & AI Triage
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-400">Step 1 of 3</span>
          </div>

          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-all space-y-3"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center border border-blue-100 dark:border-blue-500/30">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white">
                  Click or drag photo to upload
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Supports JPG, PNG, WEBP up to 10MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden max-h-80 bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                <img src={imagePreview} alt="Issue preview" className="object-contain max-h-80 w-full" />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* AI Analysis Result Panel */}
              {isAnalyzing ? (
                <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 flex items-center gap-3 text-blue-700 dark:text-blue-300 text-xs">
                  <Loader2 className="w-5 h-5 animate-spin shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Gemini Vision AI is analyzing image categories and severity...</span>
                </div>
              ) : aiAnalysisResult ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                      <Sparkles className="w-4 h-4" /> AI Auto-Detected Details
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      Confidence: {formatConfidencePercentage(aiAnalysisResult.confidence)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    "{aiAnalysisResult.descriptionSummary}"
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </Card>

        {/* Step 2: Location Details */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              2. Precise Location Tagging
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-400">Step 2 of 3</span>
          </div>

          <LocationPicker
            latitude={locationData.latitude}
            longitude={locationData.longitude}
            address={locationData.address}
            locationSelected={locationData.locationSelected}
            onChange={(loc) => setLocationData(loc)}
            onLocationSelect={(loc) => setLocationData(loc)}
          />
        </Card>

        {/* Step 3: Issue Details */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              3. Ticket Metadata
            </h3>
            <span className="text-xs text-slate-400 dark:text-slate-400">Step 3 of 3</span>
          </div>

          <div className="space-y-4">
            <Input
              label="Issue Title *"
              placeholder="e.g. Deep Pothole on Main Street Outer Lane"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-900 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
                >
                  {ISSUE_CATEGORIES.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Severity Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Urgency Severity *
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-900 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors cursor-pointer"
                >
                  {SEVERITY_LEVELS.map((sev) => (
                    <option key={sev} value={sev}>
                      {sev}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description Textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Detailed Description *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Describe the issue, dimensions, hazard impact, or nearby landmarks..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-100/80 border border-slate-200/80 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none dark:bg-slate-800/50 dark:border-slate-700/80 dark:text-white dark:placeholder-slate-500 focus:dark:border-blue-500 focus:dark:ring-1 focus:dark:ring-blue-500 transition-colors resize-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center cursor-pointer transition-all"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Submitting Report...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Civic Issue Report
              </>
            )}
          </Button>
        </Card>

      </form>
    </div>
  );
}
