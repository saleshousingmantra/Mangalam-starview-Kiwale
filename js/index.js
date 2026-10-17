/* =====================================================
   PAGE-LOAD PROGRESS BAR
   Purely visual, non-blocking. Runs before DOMContentLoaded
   so it appears as early as possible; removes itself once
   the page has finished loading. No HTML changes needed —
   the bar element is created here and never holds content,
   so it cannot affect SEO or accessibility of the page.
===================================================== */
(function () {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var bar = document.createElement('div');
  bar.className = 'page-loader-bar';
  bar.setAttribute('aria-hidden', 'true');
  function mount() {
    if (document.body) document.body.appendChild(bar);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var pct = 0;
  var ticker = window.setInterval(function () {
    pct += (90 - pct) * 0.12;
    bar.style.width = Math.min(pct, 90) + '%';
  }, 180);

  function finish() {
    window.clearInterval(ticker);
    bar.style.width = '100%';
    window.setTimeout(function () {
      bar.classList.add('is-done');
      window.setTimeout(function () { bar.remove(); }, 500);
    }, 150);
  }
  if (document.readyState === 'complete') {
    finish();
  } else {
    window.addEventListener('load', finish);
  }
})();

/* Lead-source capture (first-touch attribution + form-field fill) now
   lives in config.js, since it's reusable boilerplate for the next
   project rather than something specific to this site's UI. It runs
   before this file (config.js loads first) and fills any [name="source"]
   / [name="source_link"] field on the page — see config.js for details. */

document.addEventListener('DOMContentLoaded', function () {

  /* Fill "Project", "Developer" and "Relationship Manager" fields
     from config.js so there is one place to change any of them,
     instead of editing each form in index.html. Falls back to
     whatever is already in the HTML if config.js hasn't loaded.
     Project and Relationship Manager are shown to the visitor as
     readonly fields, as well as sent with the enquiry. defaultValue
     is set too so form.reset() after a submit keeps these values. */
  var cfg = window.SITE_CONFIG || {};
  if (cfg.PROJECT_NAME) {
    document.querySelectorAll('[name="project"]').forEach(function (el) {
      el.defaultValue = el.value = cfg.PROJECT_NAME;
    });
  }
  if (cfg.DEFAULT_DEVELOPER_NAME) {
    document.querySelectorAll('[name="developer"]').forEach(function (el) {
      el.defaultValue = el.value = cfg.DEFAULT_DEVELOPER_NAME;
    });
  }
  if (cfg.DEFAULT_MANAGER_NAME) {
    document.querySelectorAll('[name="manager_name"]').forEach(function (el) {
      el.defaultValue = el.value = cfg.DEFAULT_MANAGER_NAME;
    });
  }
  if (cfg.DEFAULT_MANAGER_EMAIL) {
    document.querySelectorAll('[name="manager_email"]').forEach(function (el) {
      el.defaultValue = el.value = cfg.DEFAULT_MANAGER_EMAIL;
    });
  }

  /* Mobile nav toggle */
  var navToggle = document.getElementById('navToggle');
  var mainNav = document.getElementById('mainNav');

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', function () {
      var isOpen = mainNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    /* Close mobile nav after tapping a link */
    mainNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mainNav.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Smooth scroll for in-page anchor links (nav links only) */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('href');
      if (targetId.length > 1) {
        var target = document.querySelector(targetId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  /* Back-to-top button */
  var backToTop = document.getElementById('backToTop');
  if (backToTop) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 600) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    });
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* =====================================================
     ENQUIRY POPUP MODAL
     Note: form validation, the Supabase insert, and the
     success message are all handled by form.js. This file
     opens/closes the popup, pre-fills the "Interested In"
     field, and — the important part — decides what happens
     AFTER a successful submit based on which button opened
     the popup ("intent"): a plain enquiry, or a WhatsApp chat.
     WhatsApp never fires on its own — it only runs once
     form.js confirms the enquiry was saved to Supabase, so
     every WhatsApp click still becomes a captured lead.

     Call is the one exception: data-intent="call" buttons skip
     this popup entirely and dial the number directly (see the
     click handler below) — a call button should behave like a
     phone number, not an enquiry form.
  ===================================================== */
  var CONTACT_NUMBER = '917415322403';        // +91 7415322403, no symbols, for wa.me / tel:
  var pendingWaWindow = null;

  var modalOverlay = document.getElementById('modalOverlay');
  var modalClose = document.getElementById('modalClose');
  var modalForm = document.getElementById('modalForm');
  var modalInterest = document.getElementById('modal-interest');
  var modalTitle = document.getElementById('modalTitle');
  var modalSub = document.getElementById('modalSub');
  var modalSubmit = document.getElementById('modalSubmit');

  var INTENT_COPY = {
    enquire: {
      title: 'Get Best Price &amp; Floor Plans',
      sub: 'Share your details — our team will call you with pricing, floor plans and the brochure.',
      submit: 'Enquire Now'
    },
    whatsapp: {
      title: 'Chat with us on WhatsApp',
      sub: 'Share your details and WhatsApp will open with your message ready to send to our team.',
      submit: 'Continue to WhatsApp'
    }
    /* No "call" entry: data-intent="call" buttons dial directly and
       never open this popup at all — see the click handler below. */
  };

  function openModal(plan, intent) {
    if (!modalOverlay) return;

    var activeIntent = intent || 'enquire';
    modalOverlay.dataset.intent = activeIntent;

    var copy = INTENT_COPY[activeIntent] || INTENT_COPY.enquire;
    if (modalTitle) modalTitle.innerHTML = copy.title;
    if (modalSub) modalSub.textContent = copy.sub;
    if (modalSubmit) modalSubmit.textContent = copy.submit;

    if (plan && modalInterest) {
      modalInterest.value = plan;
    }

    modalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    var firstField = document.getElementById('modal-name');
    if (firstField) {
      window.setTimeout(function () { firstField.focus(); }, 100);
    }
  }

  function closeModal() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', function (e) {
      if (e.target === modalOverlay) closeModal();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalOverlay && modalOverlay.classList.contains('open')) {
      closeModal();
    }
  });

  /* Any element marked data-open-modal opens the popup — EXCEPT
     data-intent="call", which dials the number directly with no
     form in the way. Optional data-plan pre-selects a unit type
     (used by the pricing card CTAs). Optional data-intent
     otherwise decides what runs after a successful submit —
     defaults to a plain enquiry. */
  document.querySelectorAll('[data-open-modal]').forEach(function (el) {
    el.addEventListener('click', function () {
      if (el.getAttribute('data-intent') === 'call') {
        window.location.href = 'tel:+' + CONTACT_NUMBER;
        return;
      }
      openModal(el.getAttribute('data-plan'), el.getAttribute('data-intent'));
    });
  });

  /* form.js's own "submit" listener on this same form runs first
     (it was attached first, since form.js loads before this file)
     and does the async Supabase insert. This second listener runs
     synchronously right after it, in the same click — so we grab
     a blank tab HERE, while the browser still trusts this as a
     real user gesture, rather than after the async insert resolves
     (by which point some browsers block window.open as a popup). */
  if (modalForm) {
    modalForm.addEventListener('submit', function () {
      var intent = modalOverlay ? modalOverlay.dataset.intent : 'enquire';
      if (intent === 'whatsapp') {
        pendingWaWindow = window.open('', '_blank');
      }
    });
  }

  /* form.js dispatches "enquirySubmitted" on the form right after
     a successful Supabase insert. We listen for it here, and only
     act on it for the popup form — the footer form has no
     WhatsApp intent tied to it. The message is built from what
     they just typed, so it's already filled in — nothing left
     for the visitor to type once WhatsApp opens. */
  if (modalForm) {
    modalForm.addEventListener('enquirySubmitted', function (e) {
      var intent = modalOverlay ? modalOverlay.dataset.intent : 'enquire';
      var detail = e.detail || {};

      if (intent === 'whatsapp') {
        var message =
          'Hi, I\'m ' + (detail.name || '') + '. ' +
          'I\'m interested in ' + (detail.interest || 'a home') +
          ' at ' + (detail.project || 'Mangalam Starview, Kiwale, Pune') + '. ' +
          'My phone number is ' + (detail.phone || '') + '. ' +
          'Please share more details.';
        var waUrl = 'https://wa.me/' + CONTACT_NUMBER + '?text=' + encodeURIComponent(message);

        if (pendingWaWindow && !pendingWaWindow.closed) {
          pendingWaWindow.location.href = waUrl;
        } else {
          window.open(waUrl, '_blank');
        }
        pendingWaWindow = null;
      }
      /* No "call" branch here: call buttons dial directly on click
         (see the [data-open-modal] handler above) and never reach
         this popup or its submit flow at all. */
    });
  }

  /* Auto-open the popup ONCE, 15 seconds after the page loads (or is
     refreshed). It never re-opens by itself: if the visitor already
     opened or closed it, or is typing in a form, it stays away. */
  var AUTO_OPEN_DELAY_MS = 15000;
  window.setTimeout(function () {
    var a = document.activeElement;
    var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
    if (modalOverlay && !modalOverlay.classList.contains('open') && !typing) {
      openModal();
    }
  }, AUTO_OPEN_DELAY_MS);

  /* =====================================================
     IMAGE LOAD SHIMMER
     Every <img> keeps its real src/alt in the DOM at all
     times (nothing here touches that), so this is a pure
     visual affordance: a shimmer placeholder while an image
     is loading, then a soft fade-in once it's ready.
  ===================================================== */
  document.querySelectorAll('img').forEach(function (img) {
    if (img.complete && img.naturalWidth > 0) {
      img.classList.add('img-loaded');
      return;
    }
    img.classList.add('img-loading');
    function done() {
      img.classList.remove('img-loading');
      img.classList.add('img-loaded');
    }
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  /* =====================================================
     SCROLL-REVEAL ANIMATIONS
     Adds a reveal-* class (starting hidden/offset) only to
     elements the observer is about to watch, then flips
     .is-visible once each one scrolls into view. Elements
     never get a reveal class if IntersectionObserver isn't
     supported or reduced-motion is on, so content simply
     stays fully visible by default — nothing is ever hidden
     from users or search engines by this script.
  ===================================================== */
  var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    var revealTargets = [
      { selector: '.card', cls: 'reveal-up' },
      { selector: '.feature', cls: 'reveal-up' },
      { selector: '.post-card', cls: 'reveal-up' },
      { selector: '.cat-card', cls: 'reveal-up' },
      { selector: '.faq', cls: 'reveal-up' },
      { selector: '.chip', cls: 'reveal-in' },
      { selector: '.gallery picture', cls: 'reveal-scale' },
      { selector: '.figure picture', cls: 'reveal-scale' },
      { selector: '.hero-facts li', cls: 'reveal-up' },
      { selector: '.hub-links', cls: 'reveal-up' },
      { selector: '.cta-box', cls: 'reveal-up' },
      { selector: '#overview .section-label, #overview h2', cls: 'reveal-up' },
      { selector: '#homes .section-label, #homes h2', cls: 'reveal-up' },
      { selector: '#highlights .section-label, #highlights h2', cls: 'reveal-up' },
      { selector: '#gallery .section-label, #gallery h2', cls: 'reveal-up' },
      { selector: '#location .section-label, #location h2', cls: 'reveal-left' },
      { selector: '#faq .section-label, #faq h2', cls: 'reveal-up' }
    ];

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });

    var seen = new Set();
    var delayGroups = {};
    revealTargets.forEach(function (group) {
      document.querySelectorAll(group.selector).forEach(function (el) {
        if (seen.has(el)) return;
        seen.add(el);
        el.classList.add(group.cls);
        var parentKey = group.selector;
        delayGroups[parentKey] = (delayGroups[parentKey] || 0);
        var idx = delayGroups[parentKey]++;
        el.style.transitionDelay = Math.min(idx * 60, 360) + 'ms';
        io.observe(el);
      });
    });

    /* Safety net: if anything is somehow never reported by the
       observer, force it visible after a few seconds rather than
       risk content staying hidden. */
    window.setTimeout(function () {
      seen.forEach(function (el) { el.classList.add('is-visible'); });
    }, 4000);
  }

  /* =====================================================
     HERO IMAGE CAROUSEL
     Autoplay crossfade with Ken Burns zoom, manual dots +
     arrows, pause on hover/focus/hidden tab. Only runs when
     the hero carousel markup is present (index.html).
  ===================================================== */
  var heroSection = document.getElementById('heroCarousel');
  if (heroSection) {
    var slides = Array.prototype.slice.call(heroSection.querySelectorAll('.hero-slide'));
    var dots = Array.prototype.slice.call(heroSection.querySelectorAll('.hero-dot'));
    var prevBtn = document.getElementById('heroPrev');
    var nextBtn = document.getElementById('heroNext');
    var current = 0;
    var total = slides.length;
    var HERO_INTERVAL_MS = 5500;
    var timer = null;
    var heroReducedMotion = prefersReducedMotion;

    function showSlide(index) {
      current = (index + total) % total;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === current);
      });
      dots.forEach(function (dot, i) {
        var active = i === current;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }

    function next() { showSlide(current + 1); }
    function prev() { showSlide(current - 1); }

    function startAutoplay() {
      if (heroReducedMotion || total < 2) return;
      stopAutoplay();
      timer = window.setInterval(next, HERO_INTERVAL_MS);
    }
    function stopAutoplay() {
      if (timer) { window.clearInterval(timer); timer = null; }
    }

    if (nextBtn) nextBtn.addEventListener('click', function () { next(); startAutoplay(); });
    if (prevBtn) prevBtn.addEventListener('click', function () { prev(); startAutoplay(); });
    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () { showSlide(i); startAutoplay(); });
    });

    heroSection.addEventListener('mouseenter', stopAutoplay);
    heroSection.addEventListener('mouseleave', startAutoplay);
    heroSection.addEventListener('focusin', stopAutoplay);
    heroSection.addEventListener('focusout', startAutoplay);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopAutoplay(); else startAutoplay();
    });

    showSlide(0);
    startAutoplay();
  }

});
