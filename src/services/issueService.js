import { supabase } from './supabaseClient';
import { calculateUrbanImpactScore, getRecommendedDepartment } from '../utils/helpers';

/**
 * Helper to validate if a string is a standard UUID format
 */
function isValidUuid(idStr) {
  if (!idStr || typeof idStr !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
}

/**
 * Nominatim OSM type/class → granularity string
 * Determines whether a search result is an exact place or a broad area.
 */
function computeGranularity(item) {
  const type = item?.type || '';
  const cls = item?.class || '';
  const addr = item?.address || {};

  // Exact/fine-grained types
  if (['house', 'building', 'amenity', 'shop', 'office', 'tourism', 'historic'].includes(cls)) return 'building';
  if (type === 'house' || type === 'building') return 'building';
  if (cls === 'highway' && ['residential', 'secondary', 'tertiary', 'primary', 'service', 'unclassified', 'path', 'footway'].includes(type)) return 'road';
  if (cls === 'highway') return 'road';
  if (type === 'postcode' || addr.postcode) return 'postcode';
  if (['neighbourhood', 'suburb', 'quarter', 'residential'].includes(type)) return 'neighbourhood';
  if (['village', 'hamlet'].includes(type)) return 'village';
  if (['town'].includes(type)) return 'town';
  if (['city', 'municipality'].includes(type)) return 'city';
  if (['district', 'county', 'state_district'].includes(type)) return 'district';
  if (['state', 'province'].includes(type)) return 'state';
  return 'area';
}

/**
 * Returns true if a granularity value represents an approximate/broad area
 * (not a specific building, address, road, or amenity).
 */
export function isApproximateGranularity(granularity) {
  return ['city', 'town', 'village', 'district', 'state', 'area', 'neighbourhood', 'suburb'].includes(granularity);
}

/**
 * Normalize raw Nominatim address fields into a structured CivicPulse location object.
 * IMPORTANT: lat/lng are NEVER touched here. They are passed in from the call site.
 */
function normalizeNominatimAddress(addr) {
  const road = [
    addr.amenity || addr.building || addr.house_number || '',
    addr.road || addr.street || addr.pedestrian || addr.highway || '',
  ].filter(Boolean).join(' ').trim();

  const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.quarter || '';
  const city = addr.city || '';
  const town = addr.town || '';
  const village = addr.village || '';
  const municipality = addr.municipality || '';
  const district = addr.state_district || addr.district || addr.county || '';
  const state = addr.state || '';
  const postcode = addr.postcode || '';
  const country = addr.country || 'India';

  // Build display address from most-to-least specific parts
  const cityTownVillage = city || town || village || municipality || '';
  const parts = [road, locality, cityTownVillage, district, state ? (postcode ? `${state} - ${postcode}` : state) : postcode, country]
    .filter(Boolean);
  const cleanParts = parts.filter((part, idx) => parts.indexOf(part) === idx);
  const address = cleanParts.join(', ');

  return { address, road, locality, city, town, village, municipality, district, state, postcode, country };
}

export const issueService = {
  /**
   * Reverse geocode coordinates into a full structured Indian address.
   * ALWAYS returns the same lat/lng that was passed in — NEVER modifies them.
   *
   * Returns:
   * { address, road, locality, city, town, village, municipality, district, state, postcode, country, error }
   */
  async reverseGeocode(lat, lon) {
    if (lat === null || lat === undefined || lon === null || lon === undefined) {
      return { address: '', error: new Error('Invalid coordinates') };
    }

    // ── Primary: Nominatim ────────────────────────────────────────────────────
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'CivicPulseApp/1.0 (civic.pulse.app)' } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const structured = normalizeNominatimAddress(data.address);
          if (structured.address) {
            return { ...structured, error: null };
          }
        }
        if (data && data.display_name) {
          return { address: data.display_name, road: '', locality: '', city: '', town: '', village: '', municipality: '', district: '', state: '', postcode: '', country: 'India', error: null };
        }
      }
    } catch (err) {
      console.warn('[reverseGeocode] Nominatim error:', err);
    }

    // ── Fallback: BigDataCloud ────────────────────────────────────────────────
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      );
      if (response.ok) {
        const data = await response.json();
        const city = data.city || '';
        const locality = data.locality || data.localityInfo?.administrative?.[2]?.name || '';
        const state = data.principalSubdivision || data.region || '';
        const country = data.countryName || 'India';
        const parts = [locality || city, state, country].filter(Boolean);
        if (parts.length > 0) {
          return { address: parts.join(', '), road: '', locality, city, town: '', village: '', municipality: '', district: '', state, postcode: '', country, error: null };
        }
      }
    } catch (err) {
      console.warn('[reverseGeocode] BigDataCloud error:', err);
    }

    // ── Final fallback ────────────────────────────────────────────────────────
    return {
      address: `Selected map location (${Number(lat).toFixed(6)}, ${Number(lon).toFixed(6)})`,
      road: '', locality: '', city: '', town: '', village: '', municipality: '', district: '', state: '', postcode: '', country: 'India',
      error: null,
    };
  },

  /**
   * Geocode a text search query string into latitude, longitude, and formatted address
   */
  async geocodeAddress(searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return null;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=5&countrycodes=in&addressdetails=1`,
        { headers: { 'User-Agent': 'CivicPulseApp/1.0 (civic.pulse.app)' } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const item = data[0];
          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            address: item.display_name || searchQuery.trim(),
          };
        }
      }
    } catch (err) {
      console.warn('[geocodeAddress] Nominatim error:', err);
    }
    return null;
  },

  /**
   * India-wide geocoding search returning up to 6 enriched suggestions.
   *
   * Each result includes:
   *   latitude, longitude, address, name, context,
   *   road, locality, city, town, village, municipality, district, state, postcode, country,
   *   granularity, isApproximate
   *
   * Returns { notFound: true } when no results are found.
   */
  async searchLocationSuggestions(searchQuery) {
    if (!searchQuery || !searchQuery.trim()) return [];
    const nominatimHeaders = { headers: { 'User-Agent': 'CivicPulseApp/1.0 (civic.pulse.app)' } };
    try {
      // Priority: India-specific search
      let response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=6&countrycodes=in&addressdetails=1`,
        nominatimHeaders
      );

      let data = [];
      if (response.ok) data = await response.json();

      // Global fallback if no India results
      if (!data || data.length === 0) {
        response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery.trim())}&format=json&limit=6&addressdetails=1`,
          nominatimHeaders
        );
        if (response.ok) data = await response.json();
      }

      if (Array.isArray(data) && data.length > 0) {
        return data.map((item) => {
          const addr = item.address || {};

          const mainName =
            item.name ||
            addr.amenity ||
            addr.building ||
            addr.road ||
            addr.suburb ||
            addr.city ||
            addr.town ||
            addr.village ||
            item.display_name?.split(',')[0] ||
            searchQuery.trim();

          const structured = normalizeNominatimAddress(addr);

          const contextParts = [
            structured.locality,
            structured.city || structured.town || structured.village,
            structured.district,
            structured.state,
            structured.country,
          ].filter((p) => p && p.toLowerCase() !== mainName.toLowerCase());
          const cleanContext = contextParts.filter((p, idx) => contextParts.indexOf(p) === idx).join(', ');

          const granularity = computeGranularity(item);

          return {
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            address: item.display_name || searchQuery.trim(),
            name: mainName,
            context: cleanContext || item.display_name,
            granularity,
            isApproximate: isApproximateGranularity(granularity),
            // Nominatim metadata for debugging
            osm_type: item.type,
            osm_class: item.class,
            place_id: item.place_id,
            // Structured administrative fields
            road: structured.road,
            locality: structured.locality,
            city: structured.city,
            town: structured.town,
            village: structured.village,
            municipality: structured.municipality,
            district: structured.district,
            state: structured.state,
            postcode: structured.postcode,
            country: structured.country,
          };
        });
      }

      // Explicit sentinel so the UI can show a specific "not found" message
      return { notFound: true, results: [] };
    } catch (err) {
      console.warn('[searchLocationSuggestions] Nominatim error:', err);
    }
    return [];
  },

  /**
   * Fast IP-based Location Fetcher (Fallback for PCs without GPS hardware or blocked permissions)
   */
  async fetchIpLocation() {
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const parts = [data.city, data.region, data.country_name].filter(Boolean);
          return {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            address: parts.length > 0 ? parts.join(', ') : `${data.latitude}, ${data.longitude}`,
          };
        }
      }
    } catch (e) {
      console.warn('IP-API location fallback failed:', e);
    }

    try {
      const res = await fetch('https://ipwho.is/');
      if (res.ok) {
        const data = await res.json();
        if (data.latitude && data.longitude) {
          const parts = [data.city, data.region, data.country].filter(Boolean);
          return {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            address: parts.length > 0 ? parts.join(', ') : `${data.latitude}, ${data.longitude}`,
          };
        }
      }
    } catch (e) {
      console.warn('ipwho.is location fallback failed:', e);
    }

    return null;
  },

  /**
   * Upload complaint photo directly to Supabase Storage bucket "complaints"
   */
  async uploadComplaintImage(file, userId) {
    if (!file) return { publicUrl: null, error: null };

    let base64Url = null;
    try {
      base64Url = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    } catch (e) {
      console.warn('FileReader error:', e);
    }

    try {
      const folderId = isValidUuid(userId) ? userId : 'anonymous';
      const fileExt = file.name ? file.name.split('.').pop() : 'jpg';
      const fileName = `${folderId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { data, error } = await supabase.storage
        .from('complaints')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error || !data) {
        console.warn('Supabase storage upload returned error, using base64 fallback:', error);
        return { publicUrl: base64Url || (file ? URL.createObjectURL(file) : null), error: null };
      }

      const { data: publicUrlData } = supabase.storage
        .from('complaints')
        .getPublicUrl(data.path);

      return { publicUrl: publicUrlData?.publicUrl || base64Url, error: null };
    } catch (err) {
      console.warn('Supabase storage upload exception, using base64 fallback:', err);
      return { publicUrl: base64Url || (file ? URL.createObjectURL(file) : null), error: null };
    }
  },

  /**
   * Create a new complaint record directly in Supabase database complaints table
   */
  async createIssue({
    userId,
    userEmail = '',
    userName = '',
    title,
    description,
    category,
    severity = 'Medium',
    latitude = null,
    longitude = null,
    address = '',
    road = '',
    locality = '',
    city = '',
    town = '',
    village = '',
    municipality = '',
    district = '',
    state = '',
    postcode = '',
    country = '',
    location_source = '',
    gps_accuracy = null,
    priority = 'Medium',
    imageUrl = null,
  }) {
    // Verify session using supabase.auth.getSession()
    const { data: { session } } = await supabase.auth.getSession();
    const activeUser = session?.user;

    if (!activeUser || !activeUser.id) {
      return {
        data: null,
        error: new Error('Please log in with an authenticated account to submit a report.'),
      };
    }

    const activeUserId = activeUser.id;
    const activeUserEmail = activeUser.email || userEmail;
    const activeUserName =
      activeUser.user_metadata?.full_name ||
      activeUser.user_metadata?.name ||
      activeUser.email ||
      userName ||
      'Citizen User';

    try {
      // Step 1: Ensure user profile row exists in public.profiles table
      try {
        await supabase.from('profiles').upsert(
          [
            {
              id: activeUserId,
              email: activeUserEmail,
              full_name: activeUserName,
            },
          ],
          { onConflict: 'id' }
        );
      } catch (profileErr) {
        console.warn('Profile upsert warning (non-fatal):', profileErr);
      }

      // Step 1.5: PostGIS Duplicate Complaint Check & Merge
      if (latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined && category) {
        try {
          const { data: matchedId, error: rpcError } = await supabase.rpc(
            'check_and_merge_duplicate_complaint',
            {
              new_lat: parseFloat(latitude),
              new_lng: parseFloat(longitude),
              cat: category,
              radius_meters: 100.0,
            }
          );

          if (!rpcError && matchedId) {
            console.log(`PostGIS Duplicate Detected! Merged with existing complaint ID: ${matchedId}`);
            const { data: existingComplaint } = await this.fetchIssueById(matchedId);
            if (existingComplaint) {
              return {
                data: { ...existingComplaint, isDuplicate: true },
                isDuplicate: true,
                error: null,
              };
            }
          }
        } catch (duplicateCheckErr) {
          console.warn('PostGIS duplicate check RPC warning:', duplicateCheckErr);
        }
      }

      // Calculate initial Urban Impact Score (0-100)
      const initialImpact = calculateUrbanImpactScore({
        severity,
        upvotes: 1,
        latitude,
        longitude,
        created_at: new Date().toISOString(),
        status: 'Pending',
      });

      // Step 2: Insert complaint row directly into public.complaints
      const deptRecommendation = getRecommendedDepartment(category);

      const baseInsertPayload = {
        user_id: activeUserId,
        title,
        description,
        category,
        severity,
        latitude,
        longitude,
        address,
        status: 'Pending',
        priority,
      };

      console.log('[Location] coordinates sent to Supabase DB:', { latitude, longitude, address, road, locality, city, town, village, municipality, district, state, postcode, location_source, gps_accuracy });

      // Try full payload with all structured location + extended columns
      let { data: complaintData, error: complaintError } = await supabase
        .from('complaints')
        .insert([
          {
            ...baseInsertPayload,
            urban_impact_score: initialImpact.score,
            recommended_department: deptRecommendation,
            road,
            locality,
            city,
            municipality,
            district,
            state,
            postcode,
            country,
            location_source,
            gps_accuracy,
          },
        ])
        .select();

      // Graceful fallback if any extended column is missing in DB schema cache
      if (
        complaintError &&
        (complaintError.code === 'PGRST204' ||
          complaintError.code === '42703' ||
          complaintError.message?.includes('schema cache') ||
          complaintError.message?.includes('column'))
      ) {
        console.warn(
          'Extended column missing in DB schema cache, retrying insert with base core columns:',
          complaintError.message
        );
        const fallbackRes = await supabase
          .from('complaints')
          .insert([baseInsertPayload])
          .select();

        complaintData = fallbackRes.data;
        complaintError = fallbackRes.error;
      }

      if (complaintError) {
        console.error('Supabase DB complaint insert failed:', complaintError);
        return { data: null, error: complaintError };
      }

      const rawRecord = Array.isArray(complaintData) ? complaintData[0] : complaintData;
      const insertedRecord = rawRecord
        ? {
            ...rawRecord,
            urban_impact_score: rawRecord.urban_impact_score ?? initialImpact.score,
            recommended_department: rawRecord.recommended_department || deptRecommendation,
          }
        : null;
      const finalId = insertedRecord?.id;

      // Step 3: Insert image record into public.complaint_images if image provided
      if (imageUrl && finalId) {
        try {
          await supabase.from('complaint_images').insert([
            {
              complaint_id: finalId,
              image_url: imageUrl,
            },
          ]);
        } catch (imgErr) {
          console.warn('Image record insert warning:', imgErr);
        }
      }

      const finalComplaintObj = {
        ...insertedRecord,
        complaint_images: imageUrl ? [{ id: `img_${Date.now()}`, image_url: imageUrl }] : [],
        profiles: {
          email: activeUserEmail,
          full_name: activeUserName,
        },
      };

      return { data: finalComplaintObj, error: null };
    } catch (err) {
      console.error('Exception during createIssue DB insert:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Delete a complaint directly by ID in Supabase
   */
  async deleteComplaint(complaintId) {
    if (!complaintId) return { error: null };

    try {
      try {
        await supabase.from('complaint_images').delete().eq('complaint_id', complaintId);
      } catch (imgErr) {
        console.warn('Complaint images delete notice:', imgErr);
      }

      const { error } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaintId);

      if (error) {
        console.error('Supabase deleteComplaint error:', error);
      }

      return { error: error || null };
    } catch (err) {
      console.error('Supabase deleteComplaint exception:', err);
      return { error: err };
    }
  },

  /**
   * Fetch user complaints directly from Supabase complaints table
   */
  async fetchUserComplaints(userId) {
    if (!userId || !isValidUuid(userId)) {
      return { data: [], error: null };
    }

    try {
      const { data: remoteData, error } = await supabase
        .from('complaints')
        .select(`
          *,
          complaint_images (
            id,
            image_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Supabase fetchUserComplaints query error, retrying without relations:', error);
        const { data: flatData, error: flatError } = await supabase
          .from('complaints')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (!flatError && flatData) {
          return { data: flatData, error: null };
        }
        return { data: [], error };
      }

      return { data: remoteData || [], error: null };
    } catch (err) {
      console.error('Supabase fetchUserComplaints exception:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Fetch ALL complaints directly from Supabase complaints table for Admin Control Panel
   */
  async fetchAllComplaints() {
    try {
      let { data: remoteData, error } = await supabase
        .from('complaints')
        .select(`
          *,
          complaint_images (
            id,
            image_url
          ),
          status_history (
            id,
            old_status,
            new_status,
            updated_at,
            updated_by
          ),
          profiles (
            id,
            full_name,
            email,
            phone
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        const { data: rawComplaints, error: rawError } = await supabase
          .from('complaints')
          .select(`
            *,
            complaint_images (
              id,
              image_url
            ),
            status_history (
              id,
              old_status,
              new_status,
              updated_at,
              updated_by
            )
          `)
          .order('created_at', { ascending: false });

        if (!rawError && rawComplaints) {
          const processedRaw = rawComplaints.map((item) => ({
            ...item,
            recommended_department:
              item.recommended_department || getRecommendedDepartment(item.category),
          }));
          return { data: processedRaw, error: null };
        }
      }

      const processedRemote = (remoteData || []).map((item) => ({
        ...item,
        recommended_department:
          item.recommended_department || getRecommendedDepartment(item.category),
      }));

      return { data: processedRemote, error: error || null };
    } catch (err) {
      console.error('Supabase fetchAllComplaints exception:', err);
      return { data: [], error: err };
    }
  },

  /**
   * Update complaint recommended department in Supabase
   */
  async updateComplaintDepartment(complaintId, newDepartment) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .update({ recommended_department: newDepartment, updated_at: new Date().toISOString() })
        .eq('id', complaintId)
        .select();

      return { data, error: error || null };
    } catch (err) {
      console.error('Supabase updateComplaintDepartment exception:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Update complaint status directly in Supabase
   */
  async updateComplaintStatus(complaintId, newStatus, oldStatus = 'Pending', adminId = null) {
    try {
      const validAdminId = adminId && isValidUuid(adminId) ? adminId : null;
      const { data, error } = await supabase
        .from('complaints')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', complaintId)
        .select();

      if (!error) {
        try {
          await supabase.from('status_history').insert([
            {
              complaint_id: complaintId,
              old_status: oldStatus,
              new_status: newStatus,
              updated_by: validAdminId,
            },
          ]);
        } catch (historyErr) {
          console.warn('Status history insert warning:', historyErr);
        }
      }

      return { data, error: error || null };
    } catch (err) {
      console.error('Supabase updateComplaintStatus exception:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Fetch single complaint by ID directly from Supabase
   */
  async fetchIssueById(id) {
    try {
      const { data, error } = await supabase
        .from('complaints')
        .select(`
          *,
          complaint_images (
            id,
            image_url
          ),
          status_history (
            id,
            old_status,
            new_status,
            updated_at
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (err) {
      console.error('fetchIssueById error:', err);
      return { data: null, error: err };
    }
  },

  /**
   * Safe Upvote for a complaint ("I Face This Too") preventing duplicate votes per authenticated user
   */
  async upvoteComplaint(complaintId, userId) {
    if (!complaintId) {
      return { success: false, error: new Error('Complaint ID is required') };
    }

    if (!userId || !isValidUuid(userId)) {
      return {
        success: false,
        alreadyVoted: false,
        error: new Error('Please log in with an authenticated account to support this issue ("I Face This Too").'),
      };
    }

    try {
      // 1. Attempt PostgreSQL RPC upvote_complaint for atomic duplicate-prevented upvoting
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('upvote_complaint', {
        target_complaint_id: complaintId,
        voting_user_id: userId,
      });

      if (!rpcErr && rpcRes) {
        return {
          success: rpcRes.success,
          alreadyVoted: Boolean(rpcRes.already_voted),
          upvotes: rpcRes.upvotes,
          message: rpcRes.message || (rpcRes.already_voted ? 'You have already supported this issue.' : 'Thank you for supporting this issue!'),
          error: null,
        };
      }

      // 2. Client JS Table Fallback if RPC is not deployed on remote database yet
      const { data: existingVote } = await supabase
        .from('complaint_upvotes')
        .select('id')
        .eq('complaint_id', complaintId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existingVote) {
        const { data: currentComplaint } = await supabase
          .from('complaints')
          .select('upvotes')
          .eq('id', complaintId)
          .single();

        return {
          success: false,
          alreadyVoted: true,
          upvotes: currentComplaint?.upvotes || 1,
          message: 'You have already supported this issue ("I Face This Too").',
          error: null,
        };
      }

      // Record vote in complaint_upvotes tracking table
      const { error: insertErr } = await supabase
        .from('complaint_upvotes')
        .insert([{ complaint_id: complaintId, user_id: userId }]);

      if (insertErr && (insertErr.code === '23505' || insertErr.message?.includes('unique'))) {
        return {
          success: false,
          alreadyVoted: true,
          message: 'You have already supported this issue ("I Face This Too").',
          error: null,
        };
      }

      // Fetch current upvote count & increment
      const { data: complaintData } = await supabase
        .from('complaints')
        .select('upvotes')
        .eq('id', complaintId)
        .single();

      const newUpvotes = (complaintData?.upvotes || 0) + 1;

      await supabase
        .from('complaints')
        .update({ upvotes: newUpvotes, updated_at: new Date().toISOString() })
        .eq('id', complaintId);

      return {
        success: true,
        alreadyVoted: false,
        upvotes: newUpvotes,
        message: 'Thank you for supporting this issue!',
        error: null,
      };
    } catch (err) {
      console.error('Exception in upvoteComplaint:', err);
      return { success: false, error: err };
    }
  },

  /**
   * Fetch Set of complaint IDs upvoted by a specific user
   */
  async fetchUserUpvotedIds(userId) {
    if (!userId || !isValidUuid(userId)) return new Set();
    try {
      const { data, error } = await supabase
        .from('complaint_upvotes')
        .select('complaint_id')
        .eq('user_id', userId);

      if (error) {
        console.warn('fetchUserUpvotedIds error:', error);
        return new Set();
      }
      return new Set((data || []).map((r) => r.complaint_id));
    } catch (err) {
      console.error('fetchUserUpvotedIds exception:', err);
      return new Set();
    }
  },

  /**
   * Fetch Set of complaint IDs upvoted by a specific user (alias for fetchUserUpvotedIds)
   */
  async getUserUpvotedIssueIds(userId) {
    return this.fetchUserUpvotedIds(userId);
  },
};
