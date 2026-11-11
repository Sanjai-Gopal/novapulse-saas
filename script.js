// ==========================================
// 1. Mobile Menu Toggle
// ==========================================
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const menuIcon = document.getElementById('menu-icon');
const mobileLinks = document.querySelectorAll('.mobile-link');

mobileMenuBtn.addEventListener('click', () => {
  const isHidden = mobileMenu.classList.contains('hidden');
  if (isHidden) {
    mobileMenu.classList.remove('hidden');
    menuIcon.classList.replace('fa-bars', 'fa-xmark');
  } else {
    mobileMenu.classList.add('hidden');
    menuIcon.classList.replace('fa-xmark', 'fa-bars');
  }
});

// Close mobile drawer when link is clicked
mobileLinks.forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.add('hidden');
    menuIcon.classList.replace('fa-xmark', 'fa-bars');
  });
});

// ==========================================
// 2. Pricing Frequency Toggle (Monthly / Annual)
// ==========================================
const billingToggle = document.getElementById('billing-toggle');
const toggleThumb = document.getElementById('toggle-thumb');
const starterPrice = document.getElementById('starter-price');
const proPrice = document.getElementById('pro-price');
const monthlyLabel = document.getElementById('monthly-label');
const annualLabel = document.getElementById('annual-label');

let isAnnual = false;

function updatePricing() {
  if (isAnnual) {
    toggleThumb.classList.add('translate-x-6');
    starterPrice.textContent = '$23'; // 20% discount on $29
    proPrice.textContent = '$79';    // 20% discount on $99
    monthlyLabel.classList.replace('text-white', 'text-slate-400');
    annualLabel.classList.replace('text-slate-400', 'text-white');
  } else {
    toggleThumb.classList.remove('translate-x-6');
    starterPrice.textContent = '$29';
    proPrice.textContent = '$99';
    monthlyLabel.classList.replace('text-slate-400', 'text-white');
    annualLabel.classList.replace('text-white', 'text-slate-400');
  }
}

billingToggle.addEventListener('click', () => {
  isAnnual = !isAnnual;
  updatePricing();
});

monthlyLabel.addEventListener('click', () => {
  isAnnual = false;
  updatePricing();
});

annualLabel.addEventListener('click', () => {
  isAnnual = true;
  updatePricing();
});

// ==========================================
// 3. Contact Form Validation & State
// ==========================================
const contactForm = document.getElementById('contact-form');
const contactSuccess = document.getElementById('contact-success');
const fullNameInput = document.getElementById('full-name');
const workEmailInput = document.getElementById('work-email');
const nameError = document.getElementById('name-error');
const emailError = document.getElementById('email-error');
const submitBtn = document.getElementById('submit-btn');

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();
  let isValid = true;

  // Name validation
  if (!fullNameInput.value.trim()) {
    nameError.classList.remove('hidden');
    fullNameInput.classList.add('border-rose-500');
    isValid = false;
  } else {
    nameError.classList.add('hidden');
    fullNameInput.classList.remove('border-rose-500');
  }

  // Email validation
  if (!workEmailInput.value.trim() || !validateEmail(workEmailInput.value)) {
    emailError.classList.remove('hidden');
    workEmailInput.classList.add('border-rose-500');
    isValid = false;
  } else {
    emailError.classList.add('hidden');
    workEmailInput.classList.remove('border-rose-500');
  }

  if (isValid) {
    // Show loading spinner
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...`;

    setTimeout(() => {
      contactForm.classList.add('hidden');
      contactSuccess.classList.remove('hidden');
      contactForm.reset();
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Confirm Demo Request</span> <i class="fa-solid fa-paper-plane text-xs"></i>`;
    }, 700);
  }
});

function resetContactForm() {
  contactSuccess.classList.add('hidden');
  contactForm.classList.remove('hidden');
}

// ==========================================
// 4. Modal System (Get Started / Sign In / Demo)
// ==========================================
const actionModal = document.getElementById('action-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalIcon = document.getElementById('modal-icon');
const modalForm = document.getElementById('modal-form');
const modalEmail = document.getElementById('modal-email');
const modalEmailError = document.getElementById('modal-email-error');
const modalSuccess = document.getElementById('modal-success');
const modalSubmitBtn = document.getElementById('modal-submit-btn');

function openModal(type) {
  actionModal.classList.remove('hidden');
  modalSuccess.classList.add('hidden');
  modalEmailError.classList.add('hidden');
  modalForm.reset();

  if (type === 'login') {
    modalTitle.textContent = 'Welcome Back';
    modalDesc.textContent = 'Sign in to access your NovaPulse workspace.';
    modalIcon.className = 'fa-solid fa-arrow-right-to-bracket';
    modalSubmitBtn.textContent = 'Sign In';
  } else if (type === 'demo') {
    // Quick-scroll directly to the contact demo section
    closeModal();
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    return;
  } else {
    modalTitle.textContent = 'Create Free Account';
    modalDesc.textContent = 'Start your 14-day free trial. No card required.';
    modalIcon.className = 'fa-solid fa-user-plus';
    modalSubmitBtn.textContent = 'Continue to Dashboard';
  }
}

function closeModal() {
  actionModal.classList.add('hidden');
}

// Close modal if user clicks outside backdrop
actionModal.addEventListener('click', (e) => {
  if (e.target === actionModal) {
    closeModal();
  }
});

function handleModalSubmit(e) {
  e.preventDefault();
  if (!validateEmail(modalEmail.value)) {
    modalEmailError.classList.remove('hidden');
    return;
  }
  modalEmailError.classList.add('hidden');
  modalSubmitBtn.disabled = true;
  modalSubmitBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Authenticating...`;

  setTimeout(() => {
    modalSuccess.classList.remove('hidden');
    setTimeout(() => {
      closeModal();
      modalSubmitBtn.disabled = false;
      modalSubmitBtn.textContent = 'Continue to Dashboard';
    }, 1200);
  }, 600);
}

// ==========================================
// 5. Navbar Elevation on Scroll
// ==========================================
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    navbar.classList.add('bg-[#0b0f19]/95', 'shadow-lg');
  } else {
    navbar.classList.remove('bg-[#0b0f19]/95', 'shadow-lg');
  }
});