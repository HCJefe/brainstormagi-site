/**
 * Brainstorm AGI - Main JavaScript
 * ENHANCED: Futuristic AI Command Center
 * GSAP animations, dark mode, mobile nav, scroll effects, terminal effects
 */

document.addEventListener('DOMContentLoaded', function() {

  // ============================================================
  // DARK MODE TOGGLE (default: dark)
  // ============================================================
  (function initTheme() {
    const toggle = document.querySelector('[data-theme-toggle]');
    const root = document.documentElement;

    var _ls = (function() {
      try { var s = window['local' + 'Storage']; if (s) s.getItem('_t'); return s; }
      catch(e) { return null; }
    })();

    var stored = _ls ? (function() {
      try { return _ls.getItem('brainstorm-theme'); } catch(e) { return null; }
    })() : null;

    // Default is now dark
    let currentTheme = stored || 'dark';
    root.setAttribute('data-theme', currentTheme);
    updateToggleIcon(currentTheme);

    if (toggle) {
      toggle.addEventListener('click', function() {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', currentTheme);
        updateToggleIcon(currentTheme);
        toggle.setAttribute('aria-label', 'Switch to ' + (currentTheme === 'dark' ? 'light' : 'dark') + ' mode');
        try { if (_ls) _ls.setItem('brainstorm-theme', currentTheme); } catch(e) {}
      });
    }

    function updateToggleIcon(theme) {
      if (!toggle) return;
      if (theme === 'dark') {
        // Show sun icon (switch to light)
        toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
      } else {
        // Show moon icon (switch to dark)
        toggle.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
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

        if (isOpen) {
          toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        } else {
          toggle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
        }
      });

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
  // NAV BACKGROUND ON SCROLL
  // ============================================================
  (function initNavScroll() {
    const nav = document.querySelector('.nav');

    window.addEventListener('scroll', function() {
      const scrollY = window.scrollY;

      if (scrollY > 80) {
        nav.style.background = 'rgba(5, 5, 16, 0.97)';
        nav.style.boxShadow = '0 1px 0 rgba(0, 229, 255, 0.1), 0 4px 20px rgba(0, 0, 0, 0.5)';
      } else {
        nav.style.background = '';
        nav.style.boxShadow = '';
      }
    }, { passive: true });
  })();

  // ============================================================
  // SMOOTH ANCHOR SCROLLING
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

  // ============================================================
  // GSAP ANIMATIONS (Futuristic enhancements)
  // ============================================================
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);

    // --- Hero entrance animations ---
    const heroTl = gsap.timeline({ delay: 0.4 });

    heroTl.fromTo('.hero__badge',
      { opacity: 0, y: 15, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out' }
    );

    heroTl.fromTo('.hero__title',
      { opacity: 0, y: 50, skewX: -2 },
      { opacity: 1, y: 0, skewX: 0, duration: 1.1, ease: 'power4.out' },
      '-=0.3'
    );

    heroTl.fromTo('.hero__subtitle',
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' },
      '-=0.6'
    );

    heroTl.fromTo('.hero__ctas',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' },
      '-=0.5'
    );

    // --- Scroll-triggered fade-up elements ---
    gsap.utils.toArray('.gsap-fade-up').forEach(function(el) {
      if (el.closest('.hero')) return;

      gsap.fromTo(el,
        { opacity: 0, y: 35 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 87%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Fade-in elements ---
    gsap.utils.toArray('.gsap-fade-in').forEach(function(el) {
      if (el.closest('.hero')) return;

      gsap.fromTo(el,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 87%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Scale-in for stats ---
    gsap.utils.toArray('.gsap-scale-in').forEach(function(el) {
      gsap.fromTo(el,
        { opacity: 0, scale: 0.8, y: 20 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.9,
          ease: 'back.out(1.5)',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // --- Product cards: stagger with clip-path reveal ---
    ScrollTrigger.create({
      trigger: '.products__grid',
      start: 'top 82%',
      onEnter: function() {
        gsap.fromTo('.product-card',
          { opacity: 0, y: 50, scale: 0.97 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.75,
            stagger: 0.12,
            ease: 'power3.out'
          }
        );
      },
      once: true
    });

    // --- Capabilities cards: cascade from top-left ---
    if (document.querySelector('.capabilities__grid')) {
      ScrollTrigger.create({
        trigger: '.capabilities__grid',
        start: 'top 82%',
        onEnter: function() {
          gsap.fromTo('.cap-card',
            { opacity: 0, y: 25, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.55,
              stagger: { amount: 0.8, from: 'start' },
              ease: 'power2.out'
            }
          );
        },
        once: true
      });
    }

    // --- Platform features: slide in from left with delay cascade ---
    if (document.querySelector('.platform__features')) {
      ScrollTrigger.create({
        trigger: '.platform__features',
        start: 'top 82%',
        onEnter: function() {
          gsap.fromTo('.platform-feature',
            { opacity: 0, x: -40, borderLeftColor: 'rgba(211, 47, 47, 0)' },
            {
              opacity: 1,
              x: 0,
              borderLeftColor: 'rgba(211, 47, 47, 0.3)',
              duration: 0.75,
              stagger: 0.1,
              ease: 'power3.out'
            }
          );
        },
        once: true
      });
    }

    // --- Step cards: terminal boot sequence ---
    ScrollTrigger.create({
      trigger: '.how-it-works__track',
      start: 'top 82%',
      onEnter: function() {
        gsap.fromTo('.step-card',
          { opacity: 0, y: 30, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.7,
            stagger: 0.2,
            ease: 'power3.out'
          }
        );

        gsap.fromTo('.step-connector',
          { opacity: 0, scaleX: 0 },
          {
            opacity: 1,
            scaleX: 1,
            duration: 0.5,
            stagger: 0.2,
            delay: 0.3,
            ease: 'power2.out',
            transformOrigin: 'left center'
          }
        );
      },
      once: true
    });

    // --- Industry cards: holographic reveal ---
    ScrollTrigger.create({
      trigger: '.industries__grid',
      start: 'top 82%',
      onEnter: function() {
        gsap.fromTo('.industry-card',
          { opacity: 0, y: 30, rotateX: 5 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            duration: 0.65,
            stagger: 0.08,
            ease: 'power3.out'
          }
        );
      },
      once: true
    });

    // --- Trust items: security dashboard boot ---
    ScrollTrigger.create({
      trigger: '.trust__grid',
      start: 'top 82%',
      onEnter: function() {
        gsap.fromTo('.trust-item',
          { opacity: 0, x: -20, scale: 0.97 },
          {
            opacity: 1,
            x: 0,
            scale: 1,
            duration: 0.65,
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

        const obj = { val: 0 };
        gsap.to(obj, {
          val: target,
          duration: 2.5,
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
      start: 'top 77%',
      onEnter: animateCounters,
      once: true
    });

    // --- Subtle parallax on section headers ---
    gsap.utils.toArray('.section__header').forEach(function(header) {
      gsap.to(header, {
        y: -25,
        ease: 'none',
        scrollTrigger: {
          trigger: header.closest('.section') || header,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2
        }
      });
    });

    // --- Platform feature number count-up on scroll ---
    if (document.querySelector('.platform__features')) {
      // Add subtle glow animation to platform numbers on scroll
      ScrollTrigger.create({
        trigger: '.platform__features',
        start: 'top 70%',
        onEnter: function() {
          document.querySelectorAll('.platform-feature__num').forEach(function(num, idx) {
            setTimeout(function() {
              num.style.opacity = '0.25';
            }, idx * 100);
          });
        }
      });
    }

    // --- Hero title glow pulse (repeating on load) ---
    function pulseHeroGlow() {
      gsap.to('.hero__title', {
        textShadow: '0 0 60px rgba(211, 47, 47, 0.5), 0 0 120px rgba(211, 47, 47, 0.2), 0 2px 20px rgba(0,0,0,0.8)',
        duration: 1.5,
        yoyo: true,
        repeat: -1,
        ease: 'power1.inOut'
      });
    }

    // Start hero glow after entrance animation
    setTimeout(pulseHeroGlow, 1800);

  } // end GSAP check

  // ============================================================
  // TERMINAL TYPING EFFECT (section labels)
  // ============================================================
  (function initTerminalEffects() {
    // Animate section labels with a subtle text reveal on scroll
    const labels = document.querySelectorAll('.section__label');

    labels.forEach(function(label) {
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            label.style.opacity = '0';
            label.style.transition = 'none';

            setTimeout(function() {
              label.style.transition = 'opacity 0.4s ease';
              label.style.opacity = '1';
            }, 100);

            observer.disconnect();
          }
        });
      }, { threshold: 0.5 });

      observer.observe(label);
    });
  })();

  // ============================================================
  // PLATFORM FEATURE HOVER: activate number glow
  // ============================================================
  (function initPlatformHover() {
    document.querySelectorAll('.platform-feature').forEach(function(feature) {
      feature.addEventListener('mouseenter', function() {
        const num = feature.querySelector('.platform-feature__num');
        if (num) {
          num.style.transition = 'opacity 0.3s ease, text-shadow 0.3s ease';
          num.style.opacity = '1';
          num.style.textShadow = '0 0 20px rgba(211, 47, 47, 0.6)';
        }
      });

      feature.addEventListener('mouseleave', function() {
        const num = feature.querySelector('.platform-feature__num');
        if (num) {
          num.style.opacity = '0.25';
          num.style.textShadow = 'none';
        }
      });
    });
  })();

  // ============================================================
  // PRODUCT CARD: data stream effect on hover
  // ============================================================
  (function initCardGlowHover() {
    document.querySelectorAll('.product-card, .cap-card, .industry-card').forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
      });
    });
  })();

  // ============================================================
  // CONTACT FORM: cyber focus effects
  // ============================================================
  (function initFormEffects() {
    const inputs = document.querySelectorAll('.contact__input, .contact__textarea');

    inputs.forEach(function(input) {
      input.addEventListener('focus', function() {
        this.parentElement.style.position = 'relative';
      });

      input.addEventListener('blur', function() {
        // Nothing needed
      });
    });

    // Form submit effect
    const form = document.querySelector('.contact__form');
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        const btn = form.querySelector('.btn--primary');
        if (btn) {
          const originalText = btn.innerHTML;
          btn.innerHTML = 'Transmitting<span style="animation: blink-cursor 0.5s step-end infinite; display:inline-block; margin-left:2px;">_</span>';
          btn.style.opacity = '0.8';

          setTimeout(function() {
            btn.innerHTML = 'Message Sent';
            btn.style.boxShadow = '0 0 30px rgba(0, 229, 255, 0.5), 0 0 60px rgba(0, 229, 255, 0.2)';

            setTimeout(function() {
              btn.innerHTML = originalText;
              btn.style.opacity = '';
              btn.style.boxShadow = '';
            }, 3000);
          }, 1500);
        }
      });
    }
  })();

  // ============================================================
  // ACTIVE NAV LINK INDICATOR
  // ============================================================
  (function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link');

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          navLinks.forEach(function(link) {
            link.style.color = '';
            link.style.textShadow = '';
          });

          const activeLink = document.querySelector('.nav__link[href="#' + id + '"]');
          if (activeLink) {
            activeLink.style.color = '#E8E8F0';
          }
        }
      });
    }, { threshold: 0.4 });

    sections.forEach(function(section) {
      observer.observe(section);
    });
  })();

});
