import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if valid non-placeholder keys are present
export const authConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('example.com')
);

export const supabase = authConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// Tracks whether Supabase tables are initialized or need SQL schema migration
export let cloudSchemaStatus = {
  tested: false,
  tablesExist: true,
  errorMsg: ''
};

// ============================================================================
// Local Fallback Store (Used when offline, in demo mode, or tables pending)
// ============================================================================
const LOCAL_STORAGE_KEY = 'novapulse_demo_store_v2';

function getLocalStore() {
  const defaultData = {
    user: null,
    profile: {
      plan_tier: 'free',
      billing_cycle: 'monthly',
      subscription_status: 'active',
      full_name: 'Demo Engineer'
    },
    services: [
      {
        id: 'srv_1',
        name: 'API Gateway (Edge Router)',
        endpoint: 'https://gateway.novapulse.io/v1',
        environment: 'production',
        status: 'healthy',
        latency_ms: 18.4,
        uptime_pct: 99.99,
        created_at: new Date(Date.now() - 86400000 * 4).toISOString()
      },
      {
        id: 'srv_2',
        name: 'Auth & Session Token Service',
        endpoint: 'https://auth.novapulse.io/tokens',
        environment: 'production',
        status: 'healthy',
        latency_ms: 24.1,
        uptime_pct: 99.95,
        created_at: new Date(Date.now() - 86400000 * 3).toISOString()
      },
      {
        id: 'srv_3',
        name: 'Telemetry Ingest Pipeline',
        endpoint: 'https://telemetry.novapulse.io/otlp',
        environment: 'production',
        status: 'healthy',
        latency_ms: 12.8,
        uptime_pct: 99.99,
        created_at: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'srv_4',
        name: 'Payment Webhook Dispatcher',
        endpoint: 'https://pay.novapulse.io/razorpay/events',
        environment: 'staging',
        status: 'healthy',
        latency_ms: 38.5,
        uptime_pct: 99.90,
        created_at: new Date(Date.now() - 86400000 * 1).toISOString()
      }
    ],
    alerts: [
      {
        id: 'alt_1',
        title: 'Elevated P95 latency detected on /razorpay/events (>80ms)',
        severity: 'warning',
        status: 'active',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'alt_2',
        title: 'Telemetry worker node memory utilization restored to nominal',
        severity: 'info',
        status: 'resolved',
        resolved_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 8).toISOString()
      }
    ],
    traces: [
      {
        id: 'trc_1',
        trace_id: 'tr_8f92b7c41a0e',
        service_name: 'API Gateway',
        endpoint: '/v1/telemetry/spans',
        method: 'POST',
        status_code: 200,
        duration_ms: 18.4,
        created_at: new Date(Date.now() - 60000 * 4).toISOString()
      },
      {
        id: 'trc_2',
        trace_id: 'tr_1b44c8d92e10',
        service_name: 'Auth Service',
        endpoint: '/auth/v1/token',
        method: 'POST',
        status_code: 200,
        duration_ms: 24.1,
        created_at: new Date(Date.now() - 60000 * 12).toISOString()
      },
      {
        id: 'trc_3',
        trace_id: 'tr_3c99a01f55b2',
        service_name: 'Payment Webhook',
        endpoint: '/razorpay/verify',
        method: 'POST',
        status_code: 200,
        duration_ms: 38.5,
        created_at: new Date(Date.now() - 60000 * 25).toISOString()
      }
    ],
    api_keys: [
      {
        id: 'key_1',
        name: 'Default Production Ingestion Key',
        key_prefix: 'np_live_',
        key_preview: 'np_live_••••••••••••9a7b',
        last_used_at: new Date().toISOString(),
        created_at: new Date(Date.now() - 86400000 * 5).toISOString()
      }
    ],
    demo_requests: []
  };

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultData));
      return defaultData;
    }
    const parsed = JSON.parse(raw);
    return { ...defaultData, ...parsed };
  } catch {
    return defaultData;
  }
}

function saveLocalStore(data) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save local store:', err);
  }
}

// ============================================================================
// Data Operations (Unified interface for Supabase or Local Fallback)
// ============================================================================

export const dataService = {
  // Check whether cloud database schema exists
  async checkCloudSchema() {
    if (!authConfigured || !supabase) {
      cloudSchemaStatus = { tested: true, tablesExist: false, errorMsg: 'Local Demo Mode (No Supabase URL configured)' };
      return cloudSchemaStatus;
    }
    try {
      const { error } = await supabase.from('services').select('id').limit(1);
      if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
        cloudSchemaStatus = {
          tested: true,
          tablesExist: false,
          errorMsg: 'Cloud tables not yet created in Supabase. Run supabase/schema.sql in Supabase SQL Editor.'
        };
      } else {
        cloudSchemaStatus = { tested: true, tablesExist: true, errorMsg: '' };
      }
    } catch {
      cloudSchemaStatus = { tested: true, tablesExist: false, errorMsg: 'Network connectivity or CORS error connecting to Supabase.' };
    }
    return cloudSchemaStatus;
  },

  // --- Profile & Subscription ---
  async getProfile(userId) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Profile fetch notice:', err);
      }
    }
    const store = getLocalStore();
    return store.profile;
  },

  async updateProfilePlan(userId, planTier) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .update({ plan_tier: planTier, updated_at: new Date().toISOString() })
          .eq('id', userId)
          .select()
          .maybeSingle();
        if (!error && data) {
          const store = getLocalStore();
          store.profile.plan_tier = planTier;
          saveLocalStore(store);
          return data;
        }
      } catch (err) {
        console.warn('Cloud plan update error:', err);
      }
    }
    const store = getLocalStore();
    store.profile.plan_tier = planTier;
    saveLocalStore(store);
    return store.profile;
  },

  // --- Monitored Services ---
  async getServices(userId) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) {
          cloudSchemaStatus.tablesExist = true;
          return data;
        }
        if (error && (error.code === 'PGRST205' || error.message?.includes('schema cache'))) {
          cloudSchemaStatus.tablesExist = false;
        }
      } catch (err) {
        console.warn('Cloud services fetch error:', err);
      }
    }
    const store = getLocalStore();
    return store.services;
  },

  async createService(userId, serviceData) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('services')
          .insert([{
            owner_id: userId,
            name: serviceData.name,
            endpoint: serviceData.endpoint || '',
            environment: serviceData.environment || 'production',
            status: 'healthy',
            latency_ms: serviceData.latency_ms || +(Math.random() * 25 + 10).toFixed(1),
            uptime_pct: 99.98
          }])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Cloud createService fallback to local:', err);
      }
    }
    const store = getLocalStore();
    const newService = {
      id: 'srv_' + Math.random().toString(36).substr(2, 9),
      name: serviceData.name,
      endpoint: serviceData.endpoint || '',
      environment: serviceData.environment || 'production',
      status: 'healthy',
      latency_ms: serviceData.latency_ms || +(Math.random() * 25 + 10).toFixed(1),
      uptime_pct: 99.98,
      created_at: new Date().toISOString()
    };
    store.services.unshift(newService);
    saveLocalStore(store);
    return newService;
  },

  async updateServiceLatency(userId, serviceId, newLatency, newStatus = 'healthy') {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        await supabase
          .from('services')
          .update({ latency_ms: newLatency, status: newStatus })
          .eq('id', serviceId);
      } catch (err) {
        console.warn('Cloud updateServiceLatency notice:', err);
      }
    }
    const store = getLocalStore();
    const srv = store.services.find(s => s.id === serviceId);
    if (srv) {
      srv.latency_ms = newLatency;
      srv.status = newStatus;
      saveLocalStore(store);
    }
    return true;
  },

  async deleteService(userId, serviceId) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        await supabase.from('services').delete().eq('id', serviceId);
      } catch (err) {
        console.warn('Cloud deleteService notice:', err);
      }
    }
    const store = getLocalStore();
    store.services = store.services.filter(s => s.id !== serviceId);
    saveLocalStore(store);
    return true;
  },

  // --- Alerts & Incidents ---
  async getAlerts(userId) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        console.warn('Cloud alerts fetch notice:', err);
      }
    }
    const store = getLocalStore();
    return store.alerts;
  },

  async createAlert(userId, alertData) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .insert([{
            owner_id: userId,
            title: alertData.title,
            severity: alertData.severity || 'info',
            status: 'active'
          }])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Cloud createAlert notice:', err);
      }
    }
    const store = getLocalStore();
    const newAlert = {
      id: 'alt_' + Math.random().toString(36).substr(2, 9),
      title: alertData.title,
      severity: alertData.severity || 'info',
      status: 'active',
      created_at: new Date().toISOString()
    };
    store.alerts.unshift(newAlert);
    saveLocalStore(store);
    return newAlert;
  },

  async resolveAlert(userId, alertId) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        await supabase
          .from('alerts')
          .update({ status: 'resolved', resolved_at: new Date().toISOString() })
          .eq('id', alertId);
      } catch (err) {
        console.warn('Cloud resolveAlert notice:', err);
      }
    }
    const store = getLocalStore();
    const alert = store.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.status = 'resolved';
      alert.resolved_at = new Date().toISOString();
      saveLocalStore(store);
    }
    return true;
  },

  // --- Telemetry Traces ---
  async getTraces(userId) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('telemetry_traces')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25);
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        console.warn('Cloud traces fetch notice:', err);
      }
    }
    const store = getLocalStore();
    return store.traces;
  },

  async recordTrace(userId, traceData) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('telemetry_traces')
          .insert([{
            owner_id: userId,
            trace_id: 'tr_' + Math.random().toString(36).substr(2, 12),
            service_name: traceData.service_name || 'API Gateway',
            endpoint: traceData.endpoint || '/v1/graphql',
            method: traceData.method || 'POST',
            status_code: traceData.status_code || 200,
            duration_ms: traceData.duration_ms || +(Math.random() * 40 + 5).toFixed(1),
            payload_preview: traceData.payload_preview || { sample: true }
          }])
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Cloud recordTrace notice:', err);
      }
    }
    const store = getLocalStore();
    const newTrace = {
      id: 'trc_' + Math.random().toString(36).substr(2, 9),
      trace_id: 'tr_' + Math.random().toString(36).substr(2, 12),
      service_name: traceData.service_name || 'API Gateway',
      endpoint: traceData.endpoint || '/v1/graphql',
      method: traceData.method || 'POST',
      status_code: traceData.status_code || 200,
      duration_ms: traceData.duration_ms || +(Math.random() * 40 + 5).toFixed(1),
      created_at: new Date().toISOString()
    };
    store.traces.unshift(newTrace);
    if (store.traces.length > 30) store.traces.pop();
    saveLocalStore(store);
    return newTrace;
  },

  // --- API Keys ---
  async getApiKeys(userId) {
    if (authConfigured && supabase && userId) {
      try {
        const { data, error } = await supabase
          .from('api_keys')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        console.warn('Cloud api keys fetch notice:', err);
      }
    }
    const store = getLocalStore();
    return store.api_keys;
  },

  async createApiKey(userId, name) {
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const keyPrefix = 'np_live_';
    const keyPreview = `${keyPrefix}••••••••••••${randomSuffix.slice(-4)}`;
    const fullKey = `${keyPrefix}${Math.random().toString(36).substring(2, 14)}_${randomSuffix}`;

    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        const { data, error } = await supabase
          .from('api_keys')
          .insert([{
            owner_id: userId,
            name: name || 'Production Telemetry Key',
            key_prefix: keyPrefix,
            key_preview: keyPreview
          }])
          .select()
          .single();
        if (!error && data) return { ...data, fullKey };
      } catch (err) {
        console.warn('Cloud createApiKey notice:', err);
      }
    }

    const store = getLocalStore();
    const newKey = {
      id: 'key_' + Math.random().toString(36).substr(2, 9),
      name: name || 'Production Telemetry Key',
      key_prefix: keyPrefix,
      key_preview: keyPreview,
      last_used_at: null,
      created_at: new Date().toISOString()
    };
    store.api_keys.unshift(newKey);
    saveLocalStore(store);
    return { ...newKey, fullKey };
  },

  async deleteApiKey(userId, keyId) {
    if (authConfigured && supabase && userId && cloudSchemaStatus.tablesExist) {
      try {
        await supabase.from('api_keys').delete().eq('id', keyId);
      } catch (err) {
        console.warn('Cloud deleteApiKey notice:', err);
      }
    }
    const store = getLocalStore();
    store.api_keys = store.api_keys.filter(k => k.id !== keyId);
    saveLocalStore(store);
    return true;
  },

  // --- Demo Inquiries ---
  async submitDemoRequest(requestData) {
    if (authConfigured && supabase && cloudSchemaStatus.tablesExist) {
      try {
        await supabase.from('demo_requests').insert([requestData]);
      } catch (err) {
        console.warn('Supabase demo request insert notice:', err);
      }
    }
    const store = getLocalStore();
    store.demo_requests = store.demo_requests || [];
    store.demo_requests.unshift({ ...requestData, id: 'demo_' + Date.now(), created_at: new Date().toISOString() });
    saveLocalStore(store);
    return true;
  }
};
