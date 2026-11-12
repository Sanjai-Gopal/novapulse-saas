import { supabase, authConfigured, dataService, cloudSchemaStatus } from './supabaseClient.js';
import schemaSql from './supabase/schema.sql?raw';

// ============================================================================
// Global State
// ============================================================================
let signedInUser = null;
let currentProfile = null;
let activeTab = 'services';
let authMode = 'signup';
let modalOpener = null;

// ============================================================================
// Toast Notification Engine
// ============================================================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40',
    warning: 'bg-amber-950/90 text-amber-200 border-amber-500/40',
    error: 'bg-rose-950/90 text-rose-200 border-rose-500/40',
    info: 'bg-slate-900/90 text-slate-200 border-slate-700'
  };
  const icons = {
    success: 'fa-solid fa-circle-check text-emerald-400',
    warning: 'fa-solid fa-triangle-exclamation text-amber-400',
    error: 'fa-solid fa-circle-xmark text-rose-400',
    info: 'fa-solid fa-circle-info text-indigo-400'
  };

  toast.className = `toast border backdrop-blur-md ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <i class="${icons[type] || icons.info}"></i>
    <span class="flex-1 font-medium">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

// ============================================================================
// Mobile Navigation
// ============================================================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const menuIcon = document.getElementById('menu-icon');

function closeMobileMenu() {
  if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
    mobileMenu.classList.add('hidden');
    if (menuIcon) menuIcon.classList.replace('fa-xmark', 'fa-bars');
    if (mobileMenuBtn) mobileMenuBtn.setAttribute('aria-expanded', 'false');
  }
}

if (mobileMenuBtn && mobileMenu && menuIcon) {
  document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  mobileMenuBtn.addEventListener('click', () => {
    const opening = mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden', !opening);
    menuIcon.classList.toggle('fa-xmark', opening);
    menuIcon.classList.toggle('fa-bars', !opening);
    mobileMenuBtn.setAttribute('aria-expanded', String(opening));
  });
}

// ============================================================================
// Pricing Frequency Toggle
// ============================================================================
const billingToggle = document.getElementById('billing-toggle');
const toggleThumb = document.getElementById('toggle-thumb');
const starterPrice = document.getElementById('starter-price');
const proPrice = document.getElementById('pro-price');
const monthlyLabel = document.getElementById('monthly-label');
const annualLabel = document.getElementById('annual-label');
let isAnnual = false;

function updatePricing() {
  if (!starterPrice || !proPrice) return;
  if (toggleThumb) toggleThumb.classList.toggle('translate-x-6', isAnnual);
  starterPrice.textContent = isAnnual ? '$23' : '$29';
  proPrice.textContent = isAnnual ? '$79' : '$99';
  if (monthlyLabel) {
    monthlyLabel.classList.toggle('text-white', !isAnnual);
    monthlyLabel.classList.toggle('text-slate-400', isAnnual);
  }
  if (annualLabel) {
    annualLabel.classList.toggle('text-white', isAnnual);
    annualLabel.classList.toggle('text-slate-400', !isAnnual);
  }
  if (billingToggle) billingToggle.setAttribute('aria-pressed', String(isAnnual));
}

if (billingToggle) billingToggle.addEventListener('click', () => { isAnnual = !isAnnual; updatePricing(); });
if (monthlyLabel) monthlyLabel.addEventListener('click', () => { isAnnual = false; updatePricing(); });
if (annualLabel) annualLabel.addEventListener('click', () => { isAnnual = true; updatePricing(); });

// ============================================================================
// Enterprise Demo Request Form
// ============================================================================
const contactForm = document.getElementById('contact-form');
const contactSuccess = document.getElementById('contact-success');
const fullNameInput = document.getElementById('full-name');
const workEmailInput = document.getElementById('work-email');
const teamSizeInput = document.getElementById('company-size');
const cloudProviderInput = document.getElementById('cloud-provider');
const useCaseInput = document.getElementById('use-case');
const nameError = document.getElementById('name-error');
const emailError = document.getElementById('email-error');
const submitBtn = document.getElementById('submit-btn');

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

if (contactForm) {
  contactForm.addEventListener('submit', async event => {
    event.preventDefault();
    const hasName = Boolean(fullNameInput.value.trim());
    const hasEmail = validateEmail(workEmailInput.value);

    if (nameError) nameError.classList.toggle('hidden', hasName);
    if (emailError) emailError.classList.toggle('hidden', hasEmail);
    fullNameInput.classList.toggle('border-rose-500', !hasName);
    workEmailInput.classList.toggle('border-rose-500', !hasEmail);

    if (!hasName || !hasEmail) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...`;
    }

    try {
      await dataService.submitDemoRequest({
        full_name: fullNameInput.value.trim(),
        work_email: workEmailInput.value.trim(),
        team_size: teamSizeInput?.value || '11-50',
        cloud_provider: cloudProviderInput?.value || 'aws',
        use_case: useCaseInput?.value?.trim() || ''
      });

      contactForm.classList.add('hidden');
      contactSuccess.classList.remove('hidden');
      contactForm.reset();
      showToast('Demo request received! Our engineering team will reach out shortly.', 'success');
    } catch (err) {
      console.error('Demo request error:', err);
      showToast('Encountered an issue submitting demo request.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Confirm Demo Request</span> <i class="fa-solid fa-paper-plane text-xs"></i>`;
      }
    }
  });
}

function resetContactForm() {
  if (contactSuccess) contactSuccess.classList.add('hidden');
  if (contactForm) {
    contactForm.classList.remove('hidden');
    contactForm.reset();
    if (nameError) nameError.classList.add('hidden');
    if (emailError) emailError.classList.add('hidden');
    if (fullNameInput) fullNameInput.classList.remove('border-rose-500');
    if (workEmailInput) workEmailInput.classList.remove('border-rose-500');
  }
}

// ============================================================================
// Authentication UI Backed by Supabase Auth (or Local Demo Fallback)
// ============================================================================
const actionModal = document.getElementById('action-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalIcon = document.getElementById('modal-icon');
const modalForm = document.getElementById('modal-form');
const modalEmail = document.getElementById('modal-email');
const modalPassword = document.getElementById('modal-password');
const modalError = document.getElementById('modal-error');
const modalErrorBox = document.getElementById('modal-error-box');
const modalNotice = document.getElementById('modal-notice');
const modalNoticeBox = document.getElementById('modal-notice-box');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const unconfirmedActions = document.getElementById('unconfirmed-actions');
const googleAuthBtn = document.getElementById('google-auth-btn');

function renderAuthMode() {
  const signingIn = authMode === 'login';
  if (modalTitle) modalTitle.textContent = signingIn ? 'Welcome back' : 'Create your account';
  if (modalDesc) {
    modalDesc.textContent = signingIn
      ? 'Sign in with Google, email & password, or 1-Click Demo.'
      : 'Create an account to open your private workspace.';
  }
  if (modalIcon) {
    modalIcon.className = signingIn ? 'fa-solid fa-arrow-right-to-bracket' : 'fa-solid fa-user-plus';
  }
  if (modalPassword) {
    modalPassword.autocomplete = signingIn ? 'current-password' : 'new-password';
    modalPassword.minLength = signingIn ? 6 : 6;
  }
  if (modalSubmitBtn) {
    modalSubmitBtn.textContent = signingIn ? 'Sign in' : 'Create account';
  }
  const switchCopy = document.getElementById('modal-switch-copy');
  const switchBtn = document.getElementById('modal-switch');
  if (switchCopy) switchCopy.textContent = signingIn ? 'New to NovaPulse?' : 'Already have an account?';
  if (switchBtn) switchBtn.textContent = signingIn ? 'Create account' : 'Sign in';
}

function openModal(type) {
  closeMobileMenu();
  if (type === 'demo') {
    const contactElem = document.getElementById('contact');
    if (contactElem) contactElem.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  modalOpener = document.activeElement;
  authMode = type === 'login' ? 'login' : 'signup';
  hideAuthMessages();
  if (modalForm) modalForm.reset();
  renderAuthMode();
  if (actionModal) actionModal.classList.remove('hidden');
  if (modalEmail) modalEmail.focus();
}

function switchAuthMode() {
  authMode = authMode === 'login' ? 'signup' : 'login';
  hideAuthMessages();
  renderAuthMode();
}

function closeModal() {
  if (actionModal) actionModal.classList.add('hidden');
  if (modalOpener) modalOpener.focus();
}

function hideAuthMessages() {
  if (modalErrorBox) modalErrorBox.classList.add('hidden');
  if (modalNoticeBox) modalNoticeBox.classList.add('hidden');
  if (unconfirmedActions) unconfirmedActions.classList.add('hidden');
}

function showAuthError(message, isUnconfirmed = false) {
  if (modalNoticeBox) modalNoticeBox.classList.add('hidden');
  if (modalErrorBox && modalError) {
    modalError.textContent = message;
    modalErrorBox.classList.remove('hidden');
    if (unconfirmedActions) {
      unconfirmedActions.classList.toggle('hidden', !isUnconfirmed);
    }
  }
}

function showAuthNotice(message) {
  if (modalErrorBox) modalErrorBox.classList.add('hidden');
  if (modalNoticeBox && modalNotice) {
    modalNotice.textContent = message;
    modalNoticeBox.classList.remove('hidden');
  }
}

async function signInWithGoogle() {
  if (googleAuthBtn) {
    googleAuthBtn.disabled = true;
    googleAuthBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin text-sm text-indigo-500"></i> Redirecting to Google...`;
  }

  if (!authConfigured || !supabase) {
    loginAsDemoUser('google.engineer@novapulse.io');
    if (googleAuthBtn) {
      googleAuthBtn.disabled = false;
      googleAuthBtn.innerHTML = `<i class="fa-brands fa-google text-red-500 text-sm"></i><span>Continue with Google</span>`;
    }
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
    if (data?.url) {
      window.location.assign(data.url);
    }
  } catch (err) {
    console.error('Google OAuth error:', err);
    showAuthError(`Google Auth Notice: ${err.message || 'Could not redirect'}. Try 1-Click Demo Access.`);
    if (googleAuthBtn) {
      googleAuthBtn.disabled = false;
      googleAuthBtn.innerHTML = `<i class="fa-brands fa-google text-red-500 text-sm"></i><span>Continue with Google</span>`;
    }
  }
}

function loginAsDemoUser(customEmail) {
  const email = customEmail || modalEmail?.value?.trim() || 'demo.engineer@novapulse.io';
  const dummyUser = {
    id: 'local_demo_user',
    email: email,
    user_metadata: { full_name: email.split('@')[0] || 'Demo Engineer' }
  };
  renderUser(dummyUser);
  closeModal();
  loadWorkspace();
  showToast(`Signed in as ${dummyUser.email}`, 'success');
  const ws = document.getElementById('workspace');
  if (ws) ws.scrollIntoView({ behavior: 'smooth' });
}

async function resendConfirmation() {
  const email = modalEmail?.value?.trim();
  if (!email || !validateEmail(email)) {
    showAuthError('Please enter your email above before requesting a new confirmation link.');
    return;
  }
  if (!authConfigured || !supabase) {
    showToast('In Demo Mode. Confirmation links are not required.', 'info');
    return;
  }
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: { emailRedirectTo: window.location.origin }
    });
    if (error) throw error;
    showAuthNotice(`Confirmation email resent to ${email}. Check your inbox or spam folder.`);
  } catch (err) {
    showAuthError(`Could not resend email: ${err.message}. Try 1-Click Demo Mode.`);
  }
}

if (modalForm) {
  modalForm.addEventListener('submit', async event => {
    event.preventDefault();
    hideAuthMessages();

    const email = modalEmail.value.trim();
    const password = modalPassword.value;

    if (!authConfigured || !supabase) {
      loginAsDemoUser(email);
      return;
    }

    modalSubmitBtn.disabled = true;
    modalSubmitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${authMode === 'login' ? 'Signing in…' : 'Creating account…'}`;

    try {
      const result = authMode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });

      if (result.error) throw result.error;

      if (result.data.session) {
        renderUser(result.data.user);
        closeModal();
        await loadWorkspace();
        showToast('Welcome to your NovaPulse workspace!', 'success');
        const ws = document.getElementById('workspace');
        if (ws) ws.scrollIntoView({ behavior: 'smooth' });
      } else {
        showAuthNotice(`Confirmation email sent to ${email}! If your inbox has not received it yet, click below to enter Demo Mode as ${email} instantly.`);
      }
    } catch (error) {
      const msg = error.message || 'Authentication failed.';
      const isUnconfirmed = msg.toLowerCase().includes('confirm') || error.code === 'email_not_confirmed';
      if (isUnconfirmed) {
        showAuthError(`Email verification pending. Click "Resend Email Link" or enter Demo Mode immediately.`, true);
      } else {
        showAuthError(msg);
      }
    } finally {
      modalSubmitBtn.disabled = false;
      renderAuthMode();
    }
  });
}

async function logout() {
  if (authConfigured && supabase) {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out notice:', err);
    }
  }
  try {
    localStorage.removeItem('novapulse_demo_store_v2');
  } catch {}
  renderUser(null);
  showToast('Logged out of workspace.', 'info');
  const hero = document.getElementById('hero');
  if (hero) hero.scrollIntoView({ behavior: 'smooth' });
}

function renderUser(user) {
  signedInUser = user || null;
  const signedIn = Boolean(user);

  const guestActions = document.getElementById('guest-actions');
  const userActions = document.getElementById('user-actions');
  const mobileGuest = document.getElementById('mobile-guest-actions');
  const mobileUser = document.getElementById('mobile-user-actions');
  const workspaceSec = document.getElementById('workspace');

  // Explicit inline style enforcement to prevent CSS media query collisions
  if (guestActions) {
    guestActions.style.setProperty('display', signedIn ? 'none' : 'flex', 'important');
  }
  if (userActions) {
    userActions.style.setProperty('display', signedIn ? 'flex' : 'none', 'important');
  }
  if (mobileGuest) {
    mobileGuest.style.setProperty('display', signedIn ? 'none' : 'flex', 'important');
  }
  if (mobileUser) {
    mobileUser.style.setProperty('display', signedIn ? 'flex' : 'none', 'important');
  }

  const email = user?.email || '';
  const navEmail = document.getElementById('nav-user-email');
  const wsEmail = document.getElementById('workspace-email');
  if (navEmail) navEmail.textContent = email;
  if (wsEmail) wsEmail.textContent = email;

  if (workspaceSec) {
    workspaceSec.classList.toggle('hidden', !signedIn);
  }

  // Update Hero action buttons dynamically when logged in
  const heroCta = document.getElementById('hero-cta-btn');
  const heroSec = document.getElementById('hero-secondary-btn');
  if (heroCta) {
    if (signedIn) {
      heroCta.innerHTML = `<i class="fa-solid fa-gauge mr-2"></i> Open My Workspace`;
      heroCta.onclick = () => {
        const ws = document.getElementById('workspace');
        if (ws) ws.scrollIntoView({ behavior: 'smooth' });
      };
    } else {
      heroCta.innerHTML = `Start Free Monitoring <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>`;
      heroCta.onclick = () => openModal('signup');
    }
  }

  if (heroSec) {
    if (signedIn) {
      heroSec.innerHTML = `<i class="fa-solid fa-layer-group text-indigo-400 mr-2"></i> Explore Services & Traces`;
      heroSec.onclick = () => {
        switchTab('services');
        const ws = document.getElementById('workspace');
        if (ws) ws.scrollIntoView({ behavior: 'smooth' });
      };
    } else {
      heroSec.innerHTML = `<i class="fa-solid fa-bolt text-indigo-400"></i> Open Live Demo Workspace`;
      heroSec.onclick = () => loginAsDemoUser();
    }
  }
}

// ============================================================================
// Workspace Management & Tab Engine
// ============================================================================

function switchTab(tabName) {
  activeTab = tabName;
  const tabNames = ['services', 'traces', 'alerts', 'apikeys', 'billing'];

  tabNames.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const pane = document.getElementById(`tab-content-${t}`);
    const isActive = t === tabName;

    if (btn) {
      if (isActive) {
        btn.classList.add('active-tab', 'text-indigo-400', 'border-indigo-500');
        btn.classList.remove('text-slate-400', 'border-transparent');
      } else {
        btn.classList.remove('active-tab', 'text-indigo-400', 'border-indigo-500');
        btn.classList.add('text-slate-400', 'border-transparent');
      }
    }
    if (pane) {
      pane.classList.toggle('hidden', !isActive);
    }
  });
}

async function loadWorkspace() {
  if (!signedInUser) return;

  const userId = signedInUser.id;

  // Check cloud schema status
  const schemaStatus = await dataService.checkCloudSchema();
  const schemaBanner = document.getElementById('schema-notice-banner');
  if (schemaBanner) {
    schemaBanner.classList.toggle('hidden', schemaStatus.tablesExist);
  }

  currentProfile = await dataService.getProfile(userId);

  // Update mode badge
  const modeBadge = document.getElementById('workspace-mode-badge');
  if (modeBadge) {
    if (authConfigured && schemaStatus.tablesExist) {
      modeBadge.className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      modeBadge.innerHTML = `<i class="fa-solid fa-cloud text-xs"></i> Supabase Cloud Active (RLS)`;
    } else if (authConfigured && !schemaStatus.tablesExist) {
      modeBadge.className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30';
      modeBadge.innerHTML = `<i class="fa-solid fa-database text-xs"></i> Cloud Connected (Schema Pending)`;
    } else {
      modeBadge.className = 'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700';
      modeBadge.innerHTML = `<i class="fa-solid fa-laptop-code text-indigo-400 text-xs"></i> Local Demo Mode`;
    }
  }

  // Update plan badges
  const planTier = currentProfile?.plan_tier || 'free';
  const navPlanPill = document.getElementById('nav-plan-pill');
  const userPlanBadge = document.getElementById('user-plan-badge');
  const billingTierBadge = document.getElementById('billing-tier-badge');

  const planTitles = {
    free: 'Free Tier',
    growth: 'Growth Tier ($29/mo)',
    enterprise: 'Enterprise Scale'
  };

  if (navPlanPill) navPlanPill.textContent = planTier.toUpperCase();
  if (userPlanBadge) {
    userPlanBadge.textContent = planTitles[planTier] || 'Free Tier';
    userPlanBadge.className = planTier === 'growth'
      ? 'text-xs px-2.5 py-1 uppercase tracking-wider rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold'
      : 'text-xs px-2.5 py-1 uppercase tracking-wider rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold';
  }
  if (billingTierBadge) {
    billingTierBadge.textContent = planTitles[planTier] || 'Free Tier';
  }

  // Render all workspace tabs
  await Promise.all([
    renderServices(),
    renderTraces(),
    renderAlerts(),
    renderApiKeys()
  ]);
}

// --- Render Services ---
async function renderServices() {
  if (!signedInUser) return;
  const container = document.getElementById('services-list-container');
  if (!container) return;

  const services = await dataService.getServices(signedInUser.id);

  // Update top counter & avg latency & health pct
  const countEl = document.getElementById('stat-services-count');
  const avgLatEl = document.getElementById('stat-avg-latency');
  const healthEl = document.getElementById('stat-health-pct');

  if (countEl) countEl.textContent = services.length;
  if (avgLatEl) {
    if (services.length > 0) {
      const avg = services.reduce((acc, s) => acc + (Number(s.latency_ms) || 20), 0) / services.length;
      avgLatEl.textContent = avg.toFixed(1);
    } else {
      avgLatEl.textContent = '0.0';
    }
  }

  if (healthEl) {
    if (services.length === 0) {
      healthEl.textContent = '100%';
    } else {
      const healthyCount = services.filter(s => s.status === 'healthy').length;
      const pct = ((healthyCount / services.length) * 100).toFixed(1);
      healthEl.textContent = `${pct}%`;
      healthEl.className = pct >= 99 ? 'text-2xl font-bold text-emerald-400' : 'text-2xl font-bold text-amber-400';
    }
  }

  if (services.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-10 bg-slate-900/30 border border-slate-800 rounded-xl text-slate-400 text-xs">
        No services monitored yet. Click "Register Endpoint" above to add your first service.
      </div>
    `;
    return;
  }

  container.innerHTML = services.map(s => {
    const lat = Number(s.latency_ms) || 20;
    const latColor = lat < 30 ? 'text-emerald-400' : lat < 70 ? 'text-amber-400' : 'text-rose-400';
    const statusBg = s.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

    return `
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="font-display font-bold text-white text-base">${escapeHtml(s.name)}</span>
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${statusBg} flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full ${s.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
              ${escapeHtml(s.status)}
            </span>
          </div>
          <div class="font-mono text-xs text-slate-400 truncate mb-4">
            <i class="fa-solid fa-link text-slate-500 mr-1"></i> ${escapeHtml(s.endpoint || 'Internal VPC')}
          </div>
          <div class="grid grid-cols-3 gap-2 py-3 border-y border-slate-800/80 text-xs">
            <div>
              <span class="text-slate-400 text-[10px] block">Latency</span>
              <span class="font-bold ${latColor}">${lat.toFixed(1)}ms</span>
            </div>
            <div>
              <span class="text-slate-400 text-[10px] block">Uptime</span>
              <span class="font-bold text-slate-200">${s.uptime_pct || 99.98}%</span>
            </div>
            <div>
              <span class="text-slate-400 text-[10px] block">Env</span>
              <span class="font-semibold text-indigo-300 capitalize">${escapeHtml(s.environment)}</span>
            </div>
          </div>
        </div>
        <div class="mt-4 pt-3 flex items-center justify-between">
          <button onclick="handlePingService('${s.id}')" class="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5">
            <i class="fa-solid fa-bolt"></i> Run Health Ping
          </button>
          <button onclick="handleDeleteService('${s.id}')" class="text-xs text-slate-400 hover:text-rose-400 transition-colors p-1" title="Delete Service">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render Traces ---
async function renderTraces() {
  if (!signedInUser) return;
  const tbody = document.getElementById('traces-table-body');
  if (!tbody) return;

  const traces = await dataService.getTraces(signedInUser.id);

  if (traces.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-4 py-8 text-center text-slate-400">
          No traces recorded yet. Click "Emit Trace Span" to send a sample request.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = traces.map(tr => {
    const isSuccess = tr.status_code >= 200 && tr.status_code < 400;
    const statusClass = isSuccess ? 'text-emerald-400' : 'text-rose-400';
    const methodColor = tr.method === 'POST' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400';
    const timeFormatted = new Date(tr.created_at).toLocaleTimeString();

    return `
      <tr class="hover:bg-slate-800/40 transition-colors">
        <td class="px-4 py-3 text-indigo-300 font-bold">${escapeHtml(tr.trace_id)}</td>
        <td class="px-4 py-3 text-slate-200">${escapeHtml(tr.service_name)}</td>
        <td class="px-4 py-3 text-slate-300">${escapeHtml(tr.endpoint)}</td>
        <td class="px-4 py-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${methodColor}">${escapeHtml(tr.method)}</span>
        </td>
        <td class="px-4 py-3 ${statusClass} font-bold">${tr.status_code}</td>
        <td class="px-4 py-3 text-slate-300">${Number(tr.duration_ms).toFixed(1)}ms</td>
        <td class="px-4 py-3 text-right text-slate-400">${timeFormatted}</td>
      </tr>
    `;
  }).join('');
}

// --- Render Alerts ---
async function renderAlerts() {
  if (!signedInUser) return;
  const container = document.getElementById('alerts-list-container');
  if (!container) return;

  const alerts = await dataService.getAlerts(signedInUser.id);
  const activeAlerts = alerts.filter(a => a.status === 'active');

  const statAlerts = document.getElementById('stat-active-alerts');
  if (statAlerts) statAlerts.textContent = activeAlerts.length;

  if (alerts.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 bg-slate-900/30 border border-slate-800 rounded-xl text-slate-400 text-xs">
        All systems clear! No active or historic alerts logged.
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map(a => {
    const isResolved = a.status === 'resolved';
    const severityBadges = {
      critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      info: 'bg-sky-500/10 text-sky-400 border-sky-500/20'
    };
    const badgeClass = severityBadges[a.severity] || severityBadges.info;

    return `
      <div class="p-4 rounded-xl border ${isResolved ? 'bg-slate-900/30 border-slate-800/60 opacity-60' : 'bg-slate-900/70 border-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start gap-3">
          <div class="mt-1">
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeClass}">
              ${escapeHtml(a.severity)}
            </span>
          </div>
          <div>
            <div class="text-sm font-semibold text-white ${isResolved ? 'line-through text-slate-400' : ''}">
              ${escapeHtml(a.title)}
            </div>
            <div class="text-[11px] text-slate-400 mt-1">
              Triggered: ${new Date(a.created_at).toLocaleString()}
              ${a.resolved_at ? ` • Resolved: ${new Date(a.resolved_at).toLocaleTimeString()}` : ''}
            </div>
          </div>
        </div>
        <div>
          ${!isResolved ? `
            <button onclick="handleResolveAlert('${a.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5">
              <i class="fa-solid fa-check"></i> Mark Resolved
            </button>
          ` : `
            <span class="text-xs text-emerald-400 font-semibold flex items-center gap-1">
              <i class="fa-solid fa-circle-check"></i> Resolved
            </span>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// --- Render API Keys ---
async function renderApiKeys() {
  if (!signedInUser) return;
  const container = document.getElementById('apikeys-list-container');
  if (!container) return;

  const keys = await dataService.getApiKeys(signedInUser.id);

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 bg-slate-900/30 border border-slate-800 rounded-xl text-slate-400 text-xs">
        No API keys generated yet. Click "Generate Key" to create an ingestion token.
      </div>
    `;
    return;
  }

  container.innerHTML = keys.map(k => {
    return `
      <div class="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="text-sm font-semibold text-white">${escapeHtml(k.name)}</div>
          <div class="font-mono text-xs text-indigo-300 mt-1 flex items-center gap-2">
            <span>${escapeHtml(k.key_preview)}</span>
            <button onclick="copySnippet('${escapeHtml(k.key_preview)}')" class="text-slate-400 hover:text-white" title="Copy Key Preview">
              <i class="fa-regular fa-copy"></i>
            </button>
          </div>
          <div class="text-[10px] text-slate-400 mt-1">Created: ${new Date(k.created_at).toLocaleDateString()}</div>
        </div>
        <button onclick="handleDeleteApiKey('${k.id}')" class="text-xs text-rose-400 hover:text-rose-300 font-semibold self-start sm:self-auto">
          Revoke Key
        </button>
      </div>
    `;
  }).join('');
}

// ============================================================================
// Interactive Workspace Actions
// ============================================================================

async function handleSimulateTrace() {
  if (!signedInUser) return;
  const endpoints = [
    { service_name: 'API Gateway', endpoint: '/v1/orders/checkout', method: 'POST', status_code: 200 },
    { service_name: 'Auth Service', endpoint: '/oauth/token', method: 'POST', status_code: 200 },
    { service_name: 'Payment Webhook', endpoint: '/razorpay/verify', method: 'POST', status_code: 200 },
    { service_name: 'Inventory Sync', endpoint: '/v2/catalog/items', method: 'GET', status_code: 200 },
    { service_name: 'Search Indexer', endpoint: '/v1/search/spans', method: 'GET', status_code: 200 }
  ];
  const chosen = endpoints[Math.floor(Math.random() * endpoints.length)];

  await dataService.recordTrace(signedInUser.id, chosen);
  await renderTraces();
  showToast(`Recorded new trace span: ${chosen.method} ${chosen.endpoint}`, 'success');
}

async function handlePingService(serviceId) {
  if (!signedInUser) return;
  const services = await dataService.getServices(signedInUser.id);
  const srv = services.find(s => s.id === serviceId);
  if (!srv) return;

  const newLatency = +(Math.random() * 25 + 10).toFixed(1);
  await dataService.updateServiceLatency(signedInUser.id, serviceId, newLatency, 'healthy');
  await renderServices();
  showToast(`Health ping for ${srv.name}: ${newLatency}ms (OK)`, 'success');
}

async function handleDeleteService(serviceId) {
  if (!signedInUser) return;
  if (!confirm('Are you sure you want to remove this service from monitoring?')) return;

  await dataService.deleteService(signedInUser.id, serviceId);
  await renderServices();
  showToast('Service removed from monitoring.', 'info');
}

async function handleResolveAlert(alertId) {
  if (!signedInUser) return;
  await dataService.resolveAlert(signedInUser.id, alertId);
  await renderAlerts();
  showToast('Incident marked as resolved.', 'success');
}

async function handleDeleteApiKey(keyId) {
  if (!signedInUser) return;
  if (!confirm('Are you sure you want to revoke this API ingestion key?')) return;

  await dataService.deleteApiKey(signedInUser.id, keyId);
  await renderApiKeys();
  showToast('API Key revoked.', 'info');
}

function copySnippet(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy text.', 'error');
  });
}

function copyGeneratedKey() {
  const val = document.getElementById('generated-key-value')?.value;
  if (val) copySnippet(val);
}

function copySchemaFileContent() {
  if (schemaSql) {
    copySnippet(schemaSql);
    showToast('Full schema.sql copied to clipboard! Paste into Supabase SQL Editor.', 'success');
  } else {
    showToast('Schema file ready in supabase/schema.sql', 'info');
  }
}

// ============================================================================
// Modal Control: Add Service
// ============================================================================
const serviceModal = document.getElementById('service-modal');
const serviceForm = document.getElementById('service-form');

function openServiceModal() {
  if (serviceForm) serviceForm.reset();
  if (serviceModal) serviceModal.classList.remove('hidden');
}
function closeServiceModal() {
  if (serviceModal) serviceModal.classList.add('hidden');
}

if (serviceForm) {
  serviceForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!signedInUser) return;

    const name = document.getElementById('srv-name')?.value.trim();
    const endpoint = document.getElementById('srv-endpoint')?.value.trim();
    const environment = document.getElementById('srv-env')?.value || 'production';

    if (!name) return;

    await dataService.createService(signedInUser.id, { name, endpoint, environment });
    closeServiceModal();
    await renderServices();
    showToast(`Service "${name}" added to monitoring!`, 'success');
  });
}

// ============================================================================
// Modal Control: Create Alert
// ============================================================================
const alertModal = document.getElementById('alert-modal');
const alertForm = document.getElementById('alert-form');

function openAlertModal() {
  if (alertForm) alertForm.reset();
  if (alertModal) alertModal.classList.remove('hidden');
}
function closeAlertModal() {
  if (alertModal) alertModal.classList.add('hidden');
}

if (alertForm) {
  alertForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!signedInUser) return;

    const title = document.getElementById('alt-title')?.value.trim();
    const severity = document.getElementById('alt-severity')?.value || 'warning';

    if (!title) return;

    await dataService.createAlert(signedInUser.id, { title, severity });
    closeAlertModal();
    await renderAlerts();
    showToast('Custom alert trigger created.', 'success');
  });
}

// ============================================================================
// Modal Control: API Key
// ============================================================================
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeyForm = document.getElementById('api-key-form');

function openApiKeyModal() {
  if (apiKeyForm) apiKeyForm.reset();
  const resBox = document.getElementById('new-key-result');
  if (resBox) resBox.classList.add('hidden');
  if (apiKeyModal) apiKeyModal.classList.remove('hidden');
}
function closeApiKeyModal() {
  if (apiKeyModal) apiKeyModal.classList.add('hidden');
}

if (apiKeyForm) {
  apiKeyForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!signedInUser) return;

    const name = document.getElementById('key-name')?.value.trim();
    if (!name) return;

    const created = await dataService.createApiKey(signedInUser.id, name);
    const resBox = document.getElementById('new-key-result');
    const valInput = document.getElementById('generated-key-value');

    if (resBox && valInput) {
      valInput.value = created.fullKey || created.key_preview;
      resBox.classList.remove('hidden');
    }

    await renderApiKeys();
    showToast('New API Ingestion Key generated!', 'success');
  });
}

// ============================================================================
// Modal Control: Plan & Billing (Razorpay Payment & Verification)
// ============================================================================
const paymentModal = document.getElementById('payment-modal');
const verifyPaymentForm = document.getElementById('verify-payment-form');

function openPaymentModal() {
  const notice = document.getElementById('payment-notice');
  if (notice) notice.classList.add('hidden');
  if (paymentModal) paymentModal.classList.remove('hidden');
}
function closePaymentModal() {
  if (paymentModal) paymentModal.classList.add('hidden');
}

if (verifyPaymentForm) {
  verifyPaymentForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!signedInUser) return;

    const payInput = document.getElementById('razorpay-payment-id-input');
    const paymentId = payInput?.value.trim() || `pay_${Math.random().toString(36).substring(2, 10)}`;

    const notice = document.getElementById('payment-notice');
    const btn = document.getElementById('btn-confirm-upgrade');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying...`;
    }

    try {
      await dataService.updateProfilePlan(signedInUser.id, 'growth');
      await loadWorkspace();

      if (notice) {
        notice.textContent = `✓ Payment ${paymentId} verified! Account successfully upgraded to Growth Plan.`;
        notice.classList.remove('hidden');
      }

      showToast('🎉 Workspace successfully upgraded to Growth Plan ($29/mo)!', 'success');
      setTimeout(() => closePaymentModal(), 1800);
    } catch (err) {
      console.error('Upgrade error:', err);
      showToast('Could not complete upgrade verification.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Upgrade Workspace to Growth Tier`;
      }
    }
  });
}

// ============================================================================
// Universal Modal Backdrop & Escape Key Handlers
// ============================================================================
const allModals = [
  { el: actionModal, close: closeModal },
  { el: serviceModal, close: closeServiceModal },
  { el: alertModal, close: closeAlertModal },
  { el: apiKeyModal, close: closeApiKeyModal },
  { el: paymentModal, close: closePaymentModal }
];

allModals.forEach(({ el, close }) => {
  if (el) {
    el.addEventListener('click', event => {
      if (event.target === el) close();
    });
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    allModals.forEach(({ el, close }) => {
      if (el && !el.classList.contains('hidden')) close();
    });
  }
});

// ============================================================================
// Expose Functions to Window for Inline HTML Handlers
// ============================================================================
Object.assign(window, {
  openModal,
  closeModal,
  switchAuthMode,
  signInWithGoogle,
  loginAsDemoUser,
  resendConfirmation,
  logout,
  resetContactForm,
  switchTab,
  handleSimulateTrace,
  handlePingService,
  handleDeleteService,
  handleResolveAlert,
  handleDeleteApiKey,
  copySnippet,
  copyGeneratedKey,
  copySchemaFileContent,
  openServiceModal,
  closeServiceModal,
  openAlertModal,
  closeAlertModal,
  openApiKeyModal,
  closeApiKeyModal,
  openPaymentModal,
  closePaymentModal
});

// ============================================================================
// Session Check, OAuth Return Listener, and Navbar Scroll
// ============================================================================
if (authConfigured && supabase) {
  // Listen to live auth changes (e.g. after Google redirect, signup, signin, logout)
  supabase.auth.onAuthStateChange(async (event, session) => {
    const user = session?.user || null;
    renderUser(user);

    if (user) {
      await loadWorkspace();

      // If returning from an OAuth callback redirect or just signed in:
      const hadOAuthParams = window.location.hash.includes('access_token') || window.location.search.includes('code=');
      if (event === 'SIGNED_IN' || hadOAuthParams) {
        showToast(`Signed in as ${user.email}`, 'success');
        const ws = document.getElementById('workspace');
        if (ws) ws.scrollIntoView({ behavior: 'smooth' });

        // Clean up hash/code from address bar for a sleek browser URL
        if (window.location.hash || window.location.search) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    }
  });

  supabase.auth.getSession().then(async ({ data, error }) => {
    if (error) {
      console.warn('Session check notice:', error.message);
    }
    const user = data.session?.user || null;
    renderUser(user);
    if (user) await loadWorkspace();
  });
} else {
  renderUser(null);
}

const navbar = document.getElementById('navbar');
function updateNavbar() {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
}
window.addEventListener('scroll', updateNavbar, { passive: true });
updateNavbar();

// Pointer-follow subtle spotlight on cards
if (window.matchMedia('(hover: hover)').matches) {
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });
  });
}
