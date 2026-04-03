/**
 * Brainstorm AGI - Main JavaScript
 * GSAP animations, dark mode toggle, mobile nav, scroll effects
 */

document.addEventListener('DOMContentLoaded', function() {

  // ============================================================
  // DARK MODE TOGGLE
  // ============================================================
  (function initTheme() {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;

    // Default to light mode per requirement
    let currentTheme = 'light';

    // Check localStorage for saved preference
    try {
      const saved = localStorage.getItem('bagi-theme');
      if (saved === 'dark' || saved === 'light') {
        currentTheme = saved;
      }
    } catch(e) {
      // localStorage may not be available
    }

    root.setAttribute('data-theme', currentTheme);
    updateToggleIcon(currentTheme);

    if (toggle) {
      toggle.addEventListener('click', function() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', currentTheme);
        updateToggleIcon(currentTheme);
        toggle.setAttribute('aria-label', 'Switch to ' + (currentTheme === 'dark' ? 'light' : 'dark') + ' mode');

        try {
          localStorage.setItem('bagi-theme', currentTheme);
        } catch(e) {}
      });
    }

    function updateToggleIcon(theme) {
      if (!toggle) return;
      if (theme === 'dark') {
        // Show sun icon (to switch to light)
        toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
      } else {
        // Show moon icon (to switch to dark)
        toggle.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
      }
    }
  })();

  // ============================================================
  // MOBILE NAV
  // ============================================================
  (function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const links = document.getElementById('nav-links');

    if (toggle && links) {
      toggle.addEventListener('click', function() {
        const isOpen = links.classList.toggle('active');
        toggle.setAttribute('aria-expanded', isOpen);

        // Update hamburger icon
        if (isOpen) {
          toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        } else {
          toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        }
      });

      // Close on link click
      links.querySelectorAll('.nav__link').forEach(function(link) {
        link.addEventListener('click', function() {
          links.classList.remove('active');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        });
      });
    }
  })();

  // ============================================================
  // GSAP ANIMATIONS
  // ============================================================
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // --- Hero animations ---
    const heroTl = gsap.timeline({ delay: 0.5 });

    heroTl.fromTo('.hero__badge',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
    );

    heroTl.fromTo('.hero__title',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out' },
      '-=0.4'
    );

    heroTl.fromTo('.hero__subtitle',
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.5'
    );

    heroTl.fromTo('.hero__ctas',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.4'
    );

    // --- Scroll-triggered fade-up elements ---
    gsap.utils.toArray('.gsap-fade-up').forEach(function(el) {
      // Skip hero elements (already animated)
      if (el.closest('.hero')) return;

      gsap.fromTo(el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Scroll-triggered fade-in elements ---
    gsap.utils.toArray('.gsap-fade-in').forEach(function(el) {
      if (el.closest('.hero')) return;

      gsap.fromTo(el,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Scale-in for stats ---
    gsap.utils.toArray('.gsap-scale-in').forEach(function(el) {
      gsap.fromTo(el,
        { opacity: 0, scale: 0.8 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Product cards stagger ---
    ScrollTrigger.create({
      trigger: '.products__grid',
      start: 'top 80%',
      onEnter: function() {
        gsap.fromTo('.product-card',
          { opacity: 0, y: 40 },
          {
            opacity: 1,
            y: 0,
            duration: 0.7,
            stagger: 0.15,
            ease: 'power3.out'
          }
        );
      },
      once: true
    });

    // --- Industry cards stagger ---
    ScrollTrigger.create({
      trigger: '.industries__grid',
      start: 'top 80%',
      onEnter: function() {
        gsap.fromTo('.industry-card',
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out'
          }
        );
      },
      once: true
    });

    // --- Trust items stagger ---
    ScrollTrigger.create({
      trigger: '.trust__grid',
      start: 'top 80%',
      onEnter: function() {
        gsap.fromTo('.trust-item',
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power3.out'
          }
        );
      },
      once: true
    });

    // --- Counter Animation for Stats ---
    function animateCounters() {
      document.querySelectorAll('.stat-item__number[data-count]').forEach(function(el) {
        const target = parseFloat(el.getAttribute('data-count'));
        const suffix = el.getAttribute('data-suffix') || '';
        const isDecimal = el.getAttribute('data-decimal') === 'true';
        const noDash = el.getAttribute('data-nodash') === 'true';

        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          onUpdate: function() {
            if (isDecimal) {
              el.textContent = obj.val.toFixed(1) + suffix;
            } else {
              el.textContent = Math.floor(obj.val) + suffix;
            }
          }
        });
      });
    }

    ScrollTrigger.create({
      trigger: '#stats',
      start: 'top 75%',
      onEnter: animateCounters,
      once: true
    });

    // --- Parallax on sections ---
    gsap.utils.toArray('.section__header').forEach(function(header) {
      gsap.to(header, {
        y: -20,
        ease: 'none',
        scrollTrigger: {
          trigger: header.closest('.section') || header,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1
        }
      });
    });

  } // end GSAP check

  // ============================================================
  // NAV BACKGROUND ON SCROLL
  // ============================================================
  (function initNavScroll() {
    const nav = document.querySelector('.nav');
    let lastScroll = 0;

    window.addEventListener('scroll', function() {
      const scrollY = window.scrollY;

      if (scrollY > 100) {
        nav.style.boxShadow = 'var(--shadow-md)';
      } else {
        nav.style.boxShadow = 'none';
      }

      lastScroll = scrollY;
    }, { passive: true });
  })();

  // ============================================================
  // SMOOTH ANCHOR SCROLLING (fallback)
  // ============================================================
  document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});
