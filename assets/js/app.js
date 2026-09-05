/* ==========================================================================
   Rotaract Loop - Dynamic Form Engine (Community Onboarding)
   Custom searchable combobox dropdown, auto-expanding textareas,
   fixed sidebar header navigation, and REST API submission
   ========================================================================== */

(function() {
  'use strict';

  // Retrieve business categories from central CONFIG or fallback
  const CATEGORIES = (window.CONFIG && window.CONFIG.categories) ? window.CONFIG.categories : [
    'Agriculture & Farming',
    'Automobiles & Transportation',
    'Beauty, Wellness & Personal Care',
    'Construction & Real Estate',
    'Education & Training',
    'Engineering & Manufacturing',
    'Entertainment & Media',
    'Events & Wedding Services',
    'Finance, Insurance & Investments',
    'Food & Beverages',
    'Healthcare & Medical',
    'Hospitality & Tourism',
    'Information Technology & Software',
    'Legal & Professional Services',
    'Logistics & Courier Services',
    'Marketing, Advertising & Branding',
    'Retail & E-Commerce',
    'Textiles, Fashion & Apparel',
    'Trading & Distribution',
    'Travel & Tourism',
    'Import & Export',
    'Consulting & Business Services',
    'Home & Lifestyle',
    'Printing & Publishing',
    'Other'
  ];

  // The 9 Business Questions Set
  const QUESTIONS = [
    {
      id: 'intro',
      title: 'Welcome to Rotaract Loop',
      type: 'intro',
      category: 'Introduction',
      description: 'Where Rotaract Entrepreneurs Connect & Grow. Exchange ideas across districts, unlock synergies, and build lasting business relationships. Complete the 9 quick questions below to join our business networking circle.'
    },
    {
      id: 'rotaractor_name',
      title: 'Rotaractor Name',
      type: 'text',
      category: 'Rotaractor Details',
      required: true,
      placeholder: 'Enter your full name',
      hint: 'The name of the Rotaractor representing the business (as founder, partner, co-owner, or family business member).'
    },
    {
      id: 'rotaract_club',
      title: 'Rotaract Club',
      type: 'text',
      category: 'Rotaract Details',
      required: true,
      placeholder: 'e.g., Rotaract Club of Bangalore',
      hint: 'Your home Rotaract club name.'
    },
    {
      id: 'district_number',
      title: 'District Number',
      type: 'text',
      category: 'Rotaract Details',
      required: true,
      placeholder: 'e.g., 3191, 3232, 3011',
      hint: 'Your Rotary International District number.'
    },
    {
      id: 'business_name',
      title: 'Business Name',
      type: 'text',
      category: 'Business Profile',
      required: true,
      placeholder: 'Enter your brand or registered trade name',
      hint: 'The official name of your business enterprise.'
    },
    {
      id: 'business_category',
      title: 'Business Category',
      type: 'select',
      category: 'Business Profile',
      required: true,
      options: CATEGORIES,
      otherText: true,
      hint: 'Select the primary industry sector that best categorizes your business.'
    },
    {
      id: 'business_description',
      title: 'Business Description & Customers Served',
      type: 'textarea',
      category: 'Business Profile',
      required: true,
      placeholder: 'Briefly describe what your business does and the kind of customers you serve...',
      hint: 'Highlight your primary offerings, target audience, and unique value proposition. (Field expands dynamically as you type)'
    },
    {
      id: 'place_of_operation',
      title: 'Primary Place of Operation',
      type: 'text',
      category: 'Location & Reach',
      required: true,
      placeholder: 'e.g., Chennai, Tamil Nadu / Pan-India / Global Online',
      hint: 'City, region, or operating geography of your business.'
    },
    {
      id: 'whatsapp_number',
      title: 'Contact Number',
      type: 'text',
      inputType: 'tel',
      category: 'Contact & Communication',
      required: true,
      placeholder: 'e.g., +91 98765 43210',
      hint: 'Please include your country code for community onboarding and networking.'
    },
    {
      id: 'website_or_social',
      title: 'Business Website / Social Media Link',
      type: 'text',
      category: 'Contact & Communication',
      required: true,
      placeholder: 'e.g., https://mybusiness.com or instagram.com/brandname',
      hint: 'Your official website, LinkedIn page, or active social media handle.'
    },
    {
      id: 'review',
      title: 'Review & Confirm Your Details',
      type: 'review',
      category: 'Verification',
      description: 'Please review your details below before submitting your registration to join the business community.'
    }
  ];

  // Storage key
  const STORAGE_KEY = (window.CONFIG && window.CONFIG.storageKeys && window.CONFIG.storageKeys.formDraft)
    ? window.CONFIG.storageKeys.formDraft
    : 'rotaract_loop_answers';

  // DOM node creation utility
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') node.className = v || '';
      else if (k === 'for') node.htmlFor = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2), v);
      else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'multiple') { node[k] = !!v; }
      else if (v === false || v == null) { /* skip */ }
      else node.setAttribute(k, v);
    });
    for (const c of children) {
      if (c != null) node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  // State
  const state = {
    index: 0,
    answers: loadFromStorage(),
    isUserScrolling: false
  };

  // DOM Elements
  const navEl = document.getElementById('questionNav');
  const navElMobile = document.getElementById('questionNavMobile');
  const rootEl = document.getElementById('questionRoot');
  const progressFill = document.getElementById('progressFill');
  const progressPercent = document.getElementById('progressPercent');
  const toastContainer = document.getElementById('toastContainer');
  const btnBack = document.getElementById('btnBack');
  const btnNext = document.getElementById('btnNext');
  const btnSubmit = document.getElementById('btnSubmit');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const modal = document.getElementById('successModal');
  const startNewSurvey = document.getElementById('startNewSurvey');

  // Storage helpers
  function loadFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.answers));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  // Toast Notification System
  function showToast(type, title, message, duration = 4500) {
    if (!toastContainer) return;
    const toast = el('div', { class: `toast toast--${type}` },
      el('div', { class: `toast__icon toast__icon--${type}` }, getToastIcon(type)),
      el('div', { class: 'toast__content' },
        el('div', { class: 'toast__title' }, title),
        el('div', { class: 'toast__message' }, message)
      ),
      el('button', {
        class: 'toast__close',
        type: 'button',
        'aria-label': 'Close notification',
        onclick: () => hideToast(toast)
      },
        el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('path', { d: 'M18 6L6 18' }),
          el('path', { d: 'M6 6l12 12' })
        )
      ),
      el('div', { class: 'toast__progress' })
    );

    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--show'));

    if (duration > 0) {
      const progressBar = toast.querySelector('.toast__progress');
      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.transitionDuration = `${duration}ms`;
      }
      setTimeout(() => hideToast(toast), duration);
    }
    return toast;
  }

  function hideToast(toast) {
    toast.classList.remove('toast--show');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  function getToastIcon(type) {
    const icons = {
      error: el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('circle', { cx: '12', cy: '12', r: '10' }),
        el('line', { x1: '15', y1: '9', x2: '9', y2: '15' }),
        el('line', { x1: '9', y1: '9', x2: '15', y2: '15' })
      ),
      success: el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
        el('polyline', { points: '22,4 12,14.01 9,11.01' })
      ),
      warning: el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
        el('path', { d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }),
        el('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
        el('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' })
      )
    };
    return icons[type] || icons.warning;
  }

  // Dynamic Auto-Resize Textarea Helper
  function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.max(120, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  }

  // Progress Bar & Nav status
  function updateProgress() {
    const coreQuestions = QUESTIONS.filter(q => q.type !== 'intro' && q.type !== 'review');
    const completed = coreQuestions.filter(q => {
      const val = state.answers[q.id];
      if (val == null || String(val).trim() === '') return false;
      if (q.id === 'business_category' && val === 'Other') {
        return !!state.answers.business_category_other && state.answers.business_category_other.trim() !== '';
      }
      return true;
    }).length;

    const percent = Math.round((completed / coreQuestions.length) * 100);
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;

    const isReview = QUESTIONS[state.index].type === 'review';
    btnSubmit.classList.toggle('hidden', !isReview);
    btnNext.classList.toggle('hidden', isReview);
    btnBack.disabled = state.index === 0;
  }

  // Build navigation items
  function buildNavInto(container) {
    container.innerHTML = '';
    QUESTIONS.forEach((q, i) => {
      const isIntro = q.type === 'intro';
      const isReview = q.type === 'review';
      let isDone = false;

      if (isIntro) {
        isDone = state.index > 0;
      } else if (isReview) {
        isDone = false;
      } else {
        const val = state.answers[q.id];
        isDone = val != null && String(val).trim() !== '';
        if (q.id === 'business_category' && val === 'Other') {
          isDone = isDone && !!state.answers.business_category_other && state.answers.business_category_other.trim() !== '';
        }
      }

      const item = el('a', {
        href: '#',
        class: 'question-nav__item ' + 
          (i === state.index ? 'question-nav__item--current ' : '') + 
          (isDone ? 'question-nav__item--completed' : ''),
        'data-index': i,
        onclick: (e) => {
          e.preventDefault();
          goTo(i);
        }
      },
        el('span', { class: 'question-nav__number' }, isDone ? '✓' : (i === 0 ? '★' : i)),
        el('div', { class: 'question-nav__text' }, q.title),
        el('span', { class: 'question-nav__status' }, isDone ? 'Done' : (i === state.index ? 'Current' : ''))
      );
      container.appendChild(item);
    });
  }

  function renderNav() {
    if (navEl) buildNavInto(navEl);
    if (navElMobile) buildNavInto(navElMobile);
  }

  // Scroll to current question with leftmost docking on mobile
  function scrollToCurrentQuestion(immediate = false) {
    // 1. Desktop: Keep sidebar scrollable content focused
    if (window.innerWidth > 860) {
      const sidebarContent = document.querySelector('.sidebar__content');
      const currentItem = navEl ? navEl.querySelector('.question-nav__item--current') : null;
      if (currentItem && sidebarContent) {
        currentItem.scrollIntoView({
          behavior: immediate ? 'auto' : 'smooth',
          block: 'nearest'
        });
      }
    } else {
      // 2. Mobile: Keep focused item smoothly docked at the leftmost position
      if (navElMobile) {
        const currentItem = navElMobile.querySelector('.question-nav__item--current');
        if (!currentItem) return;

        // Intro (index 0) always docks at the absolute beginning
        if (state.index === 0) {
          navElMobile.scrollTo({
            left: 0,
            behavior: immediate ? 'auto' : 'smooth'
          });
          return;
        }

        const containerPaddingLeft = parseFloat(window.getComputedStyle(navElMobile).paddingLeft) || 14;
        const itemRect = currentItem.getBoundingClientRect();
        const containerRect = navElMobile.getBoundingClientRect();

        // Exact relative offset to align currentItem's left edge with container's left padding edge
        const delta = itemRect.left - containerRect.left - containerPaddingLeft;
        const targetScrollLeft = navElMobile.scrollLeft + delta;

        navElMobile.scrollTo({
          left: Math.max(0, Math.round(targetScrollLeft)),
          behavior: immediate ? 'auto' : 'smooth'
        });
      }
    }
  }

  // Render question card
  function renderQuestion() {
    const q = QUESTIONS[state.index];
    rootEl.innerHTML = '';

    // Category Pill / Header
    const categoryBadge = el('div', { class: 'question__category-pill' }, q.category || 'Business Profile');
    const titleEl = el('h2', { class: 'question__title' },
      q.title,
      q.required ? el('span', { class: 'question__required' }, '*') : ''
    );
    const subtitleEl = el('p', { class: 'question__subtitle' }, q.description || '');
    const hintEl = el('p', { class: 'question__hint' }, q.hint || '');

    const header = el('div', { class: 'question__header' },
      categoryBadge,
      titleEl,
      subtitleEl,
      hintEl
    );

    const optionsWrap = el('div', { class: 'question__options' });
    const current = state.answers[q.id];

    // 1. Intro Step
    if (q.type === 'intro') {
      const introBox = el('div', { class: 'intro-container' },
        el('div', { class: 'intro-highlights' },
          el('div', { class: 'intro-highlight-card' },
            el('div', { class: 'intro-highlight-card__icon' }, '🤝'),
            el('div', { class: 'intro-highlight-card__title' }, 'Peer Networking'),
            el('div', { class: 'intro-highlight-card__desc' }, 'Connect with fellow Rotaract entrepreneurs, partners, and business professionals across districts.')
          ),
          el('div', { class: 'intro-highlight-card' },
            el('div', { class: 'intro-highlight-card__icon' }, '💡'),
            el('div', { class: 'intro-highlight-card__title' }, 'Knowledge & Growth'),
            el('div', { class: 'intro-highlight-card__desc' }, 'Share industry insights, exchange ideas, and explore trusted collaborations.')
          ),
          el('div', { class: 'intro-highlight-card' },
            el('div', { class: 'intro-highlight-card__icon' }, '🌐'),
            el('div', { class: 'intro-highlight-card__title' }, 'Active Community'),
            el('div', { class: 'intro-highlight-card__desc' }, 'Engage with like-minded business leaders and expand your professional circle.')
          )
        ),
        el('button', {
          class: 'btn btn--primary',
          type: 'button',
          style: 'padding: 16px 36px; font-size: 16px;',
          onclick: (e) => { e.preventDefault(); goTo(1); }
        },
          'Join Rotaract Loop',
          el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', class: 'btn__icon' },
            el('path', { d: 'M5 12h14M12 5l7 7-7 7' })
          )
        )
      );
      optionsWrap.append(introBox);
    }
    // 2. Text Input
    else if (q.type === 'text') {
      const input = el('input', {
        class: 'text-input',
        type: q.inputType || 'text',
        id: q.id,
        name: q.id,
        placeholder: q.placeholder || '',
        value: current || '',
        oninput: () => {
          state.answers[q.id] = input.value;
          saveToStorage();
          updateProgress();
          renderNav();
        },
        onkeydown: (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            next();
          }
        }
      });
      optionsWrap.append(input);
      setTimeout(() => input.focus(), 80);
    }
    // 3. Dynamic Auto-Expanding Textarea Input
    else if (q.type === 'textarea') {
      const textarea = el('textarea', {
        class: 'text-input textarea-input',
        id: q.id,
        name: q.id,
        placeholder: q.placeholder || '',
        rows: 4,
        oninput: () => {
          state.answers[q.id] = textarea.value;
          autoResizeTextarea(textarea);
          saveToStorage();
          updateProgress();
          renderNav();
        }
      });
      if (current) textarea.value = current;
      optionsWrap.append(textarea);
      // Auto-size immediately after appending
      requestAnimationFrame(() => autoResizeTextarea(textarea));
      setTimeout(() => textarea.focus(), 80);
    }
    // 4. Searchable Combobox Dropdown (Categories)
    else if (q.type === 'select') {
      const customSelect = el('div', { class: 'custom-select', id: `custom_select_${q.id}` });

      const triggerVal = el('span', {
        class: `custom-select__value ${!current ? 'is-placeholder' : ''}`
      }, current ? (current === 'Other' && state.answers[`${q.id}_other`] ? `Other (${state.answers[`${q.id}_other`]})` : current) : 'Select a business category');

      const triggerChevron = el('svg', {
        class: 'custom-select__chevron',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2'
      }, el('path', { d: 'M6 9l6 6 6-6' }));

      const trigger = el('button', {
        type: 'button',
        class: 'custom-select__trigger',
        'aria-haspopup': 'listbox',
        'aria-expanded': 'false',
        onclick: (e) => {
          e.stopPropagation();
          toggleDropdown();
        }
      }, triggerVal, triggerChevron);

      const dropdown = el('div', { class: 'custom-select__dropdown', role: 'listbox' });

      // Search input inside dropdown
      const searchInput = el('input', {
        type: 'text',
        class: 'custom-select__search-input',
        placeholder: 'Search categories (e.g. Retail, Food, IT)...',
        onclick: (e) => e.stopPropagation(),
        oninput: (e) => {
          filterOptions(e.target.value);
        }
      });

      const clearSearchBtn = el('button', {
        type: 'button',
        class: 'custom-select__search-clear hidden',
        onclick: (e) => {
          e.stopPropagation();
          searchInput.value = '';
          filterOptions('');
          clearSearchBtn.classList.add('hidden');
          searchInput.focus();
        }
      }, '✕');

      const searchBox = el('div', { class: 'custom-select__search-box' },
        el('svg', { class: 'custom-select__search-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('circle', { cx: '11', cy: '11', r: '8' }),
          el('path', { d: 'm21 21-4.35-4.35' })
        ),
        searchInput,
        clearSearchBtn
      );

      const optionsList = el('ul', { class: 'custom-select__options' });
      const noResults = el('li', { class: 'custom-select__no-results hidden' }, 'No matching categories found');

      function renderOptionItems() {
        optionsList.innerHTML = '';
        q.options.forEach(opt => {
          const isSelected = state.answers[q.id] === opt;
          const optEl = el('li', {
            class: `custom-select__option ${isSelected ? 'is-selected' : ''}`,
            'data-value': opt,
            role: 'option',
            'aria-selected': isSelected ? 'true' : 'false',
            onclick: (e) => {
              e.stopPropagation();
              selectOption(opt);
            }
          },
            el('span', {}, opt),
            isSelected ? el('span', { class: 'custom-select__check' }, '✓') : null
          );
          optionsList.append(optEl);
        });
        optionsList.append(noResults);
      }

      function filterOptions(term) {
        const clean = term.toLowerCase().trim();
        clearSearchBtn.classList.toggle('hidden', clean === '');
        const items = optionsList.querySelectorAll('.custom-select__option');
        let matchCount = 0;

        items.forEach(item => {
          const val = item.getAttribute('data-value') || '';
          if (!clean || val.toLowerCase().includes(clean)) {
            item.style.display = 'flex';
            matchCount++;
          } else {
            item.style.display = 'none';
          }
        });

        noResults.classList.toggle('hidden', matchCount > 0);
      }

      function positionDropdown() {
        const rect = trigger.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 340;
        if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
          dropdown.classList.add('is-dropup');
        } else {
          dropdown.classList.remove('is-dropup');
        }
      }

      function toggleDropdown(open) {
        const shouldOpen = open !== undefined ? open : !customSelect.classList.contains('is-open');
        if (shouldOpen) {
          document.querySelectorAll('.custom-select.is-open').forEach(item => item.classList.remove('is-open'));
          positionDropdown();
          customSelect.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
          renderOptionItems();
          searchInput.value = '';
          filterOptions('');
          setTimeout(() => searchInput.focus(), 60);
        } else {
          customSelect.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      }

      function selectOption(opt) {
        state.answers[q.id] = opt;
        triggerVal.textContent = opt;
        triggerVal.classList.remove('is-placeholder');
        toggleDropdown(false);

        // Show/hide "Other" specification input
        if (q.otherText) {
          const otherWrap = document.getElementById(`${q.id}_other_wrap`);
          if (otherWrap) {
            const isOther = opt === 'Other';
            otherWrap.style.display = isOther ? 'block' : 'none';
            if (isOther) {
              const otherInput = document.getElementById(`${q.id}_other_input`);
              if (otherInput) otherInput.focus();
            } else {
              state.answers[`${q.id}_other`] = '';
            }
          }
        }

        saveToStorage();
        updateProgress();
        renderNav();
      }

      // Close on outside click
      const outsideClickListener = (e) => {
        if (!customSelect.contains(e.target)) {
          toggleDropdown(false);
        }
      };
      document.addEventListener('click', outsideClickListener);

      renderOptionItems();
      dropdown.append(searchBox, optionsList);
      customSelect.append(trigger, dropdown);
      optionsWrap.append(customSelect);

      // Other specification text input
      if (q.otherText) {
        const otherVal = state.answers[`${q.id}_other`] || '';
        const isOther = current === 'Other';
        const otherInput = el('input', {
          class: 'text-input',
          type: 'text',
          id: `${q.id}_other_input`,
          placeholder: 'Please specify your business category...',
          value: otherVal,
          style: 'margin-top: 12px;',
          oninput: () => {
            state.answers[`${q.id}_other`] = otherInput.value;
            saveToStorage();
            updateProgress();
            renderNav();
          }
        });

        const otherWrap = el('div', {
          id: `${q.id}_other_wrap`,
          style: `width: 100%; display: ${isOther ? 'block' : 'none'};`
        }, otherInput);

        optionsWrap.append(otherWrap);
      }
    }
    // 5. Review Screen
    else if (q.type === 'review') {
      optionsWrap.classList.add('review-container');

      const reviewNote = el('div', { class: 'review-header-note' },
        '🔍 Please verify that your contact numbers and business links are accurate before submitting your interest.'
      );
      optionsWrap.append(reviewNote);

      const reviewFields = [
        { label: 'Rotaractor Name', val: state.answers.rotaractor_name, step: 1 },
        { label: 'Rotaract Club', val: state.answers.rotaract_club, step: 2 },
        { label: 'District Number', val: state.answers.district_number, step: 3 },
        { label: 'Business Name', val: state.answers.business_name, step: 4 },
        { 
          label: 'Business Category', 
          val: state.answers.business_category === 'Other' && state.answers.business_category_other
            ? `Other (${state.answers.business_category_other})`
            : (state.answers.business_category || '-'),
          step: 5 
        },
        { label: 'Primary Place of Operation', val: state.answers.place_of_operation, step: 7 },
        { label: 'WhatsApp Business Number', val: state.answers.whatsapp_number, step: 8 },
        { label: 'Website / Social Media', val: state.answers.website_or_social, step: 9 },
        { label: 'Business Description', val: state.answers.business_description, isTextarea: true, isFull: true, step: 6 }
      ];

      const reviewList = el('div', { class: 'review-list' });
      reviewFields.forEach(f => {
        const item = el('div', { class: `review-item ${f.isFull ? 'review-item--full' : ''}` },
          el('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
            el('span', { class: 'review-key' }, f.label),
            el('button', {
              type: 'button',
              style: 'background: none; border: none; color: var(--color-primary); font-size: 11px; font-weight: 700; cursor: pointer; text-decoration: underline;',
              onclick: () => goTo(f.step)
            }, 'Edit')
          ),
          f.isTextarea
            ? el('div', { class: 'review-value review-value--textarea' }, f.val || 'Not provided')
            : el('div', { class: 'review-value' }, f.val || 'Not provided')
        );
        reviewList.append(item);
      });

      optionsWrap.append(reviewList);
    }

    rootEl.append(header, optionsWrap);
  }

  // Navigation Logic
  function goTo(idx) {
    if (idx < 0 || idx >= QUESTIONS.length) return;
    state.index = idx;
    renderNav();
    renderQuestion();
    updateProgress();

    // Smoothly scroll nav into view after DOM has updated
    requestAnimationFrame(() => {
      scrollToCurrentQuestion();
      setTimeout(() => scrollToCurrentQuestion(), 100);
    });

    // Scroll main view to top on mobile so the question title is immediately visible
    if (window.innerWidth <= 860) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const mainEl = document.getElementById('main');
      if (mainEl) mainEl.scrollTop = 0;
    }
  }

  function validateCurrent() {
    const q = QUESTIONS[state.index];
    if (q.type === 'intro' || q.type === 'review') return true;

    const val = state.answers[q.id];

    if (q.required && (!val || String(val).trim() === '')) {
      showToast('error', 'Required Field', `Please complete "${q.title}" to continue.`);
      const input = document.getElementById(q.id);
      if (input) input.focus();
      return false;
    }

    // Category "Other" validation
    if (q.id === 'business_category' && val === 'Other') {
      const otherVal = state.answers.business_category_other;
      if (!otherVal || otherVal.trim() === '') {
        showToast('error', 'Specify Category', 'You selected "Other". Please specify your business category.');
        const otherInput = document.getElementById('business_category_other_input');
        if (otherInput) otherInput.focus();
        return false;
      }
    }

    return true;
  }

  function next() {
    if (!validateCurrent()) return;
    if (state.index < QUESTIONS.length - 1) {
      goTo(state.index + 1);
    }
  }

  function prev() {
    if (state.index > 0) {
      goTo(state.index - 1);
    }
  }

  // Form Submission
  async function submitForm() {
    // Re-validate all required questions
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (q.type === 'intro' || q.type === 'review') continue;

      const val = state.answers[q.id];
      if (q.required && (!val || String(val).trim() === '')) {
        goTo(i);
        showToast('error', 'Incomplete Form', `Please complete "${q.title}" before submitting your registration.`);
        return;
      }

      if (q.id === 'business_category' && val === 'Other') {
        if (!state.answers.business_category_other || state.answers.business_category_other.trim() === '') {
          goTo(i);
          showToast('error', 'Specify Category', 'Please specify your business category.');
          return;
        }
      }
    }

    // UI Loading state
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Submitting Registration...';
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');

    try {
      const payload = {
        rotaractor_name: state.answers.rotaractor_name || '',
        rotaract_club: state.answers.rotaract_club || '',
        district_number: state.answers.district_number || '',
        business_name: state.answers.business_name || '',
        business_category: state.answers.business_category || '',
        business_category_other: state.answers.business_category_other || '',
        business_description: state.answers.business_description || '',
        place_of_operation: state.answers.place_of_operation || '',
        whatsapp_number: state.answers.whatsapp_number || '',
        website_or_social: state.answers.website_or_social || ''
      };

      // Call Unified API Client
      let result;
      if (window.RotaractLoopAPI) {
        result = await window.RotaractLoopAPI.submitApplication(payload);
      } else if (window.RotaractBizAPI) {
        result = await window.RotaractBizAPI.submitApplication(payload);
      } else {
        throw new Error('API Client not loaded.');
      }

      if (!result.success) {
        throw new Error(result.error || 'Submission failed');
      }

      // Success
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Join Rotaract Loop';

      showSuccessModal(result.id);

    } catch (err) {
      console.error('Submission error:', err);
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Join Rotaract Loop';
      showToast('error', 'Submission Failed', err.message || 'Could not record your registration. Please check your connection and try again.');
    }
  }

  function showSuccessModal(submissionId) {
    const idBadge = document.getElementById('successIdBadge');
    if (idBadge) {
      if (submissionId) {
        idBadge.textContent = 'Reference ID: ' + submissionId;
        idBadge.classList.remove('hidden');
      } else {
        idBadge.classList.add('hidden');
      }
    }
    if (modal) modal.classList.remove('hidden');
    showToast('success', 'Registration Submitted!', 'Welcome to Rotaract Loop! Your details have been received.', 4000);
    // Clear draft storage only after server acknowledged success
    localStorage.removeItem(STORAGE_KEY);
  }

  // Event Listeners
  if (btnNext) btnNext.addEventListener('click', next);
  if (btnBack) btnBack.addEventListener('click', prev);
  if (btnSubmit) btnSubmit.addEventListener('click', submitForm);

  if (startNewSurvey) {
    startNewSurvey.addEventListener('click', () => {
      if (modal) modal.classList.add('hidden');
      state.index = 0;
      state.answers = {};
      localStorage.removeItem(STORAGE_KEY);
      renderNav();
      renderQuestion();
      updateProgress();
      scrollToCurrentQuestion(true);
    });
  }

  // Handle window resize for scroller alignment
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      scrollToCurrentQuestion(true);
    });
  });

  // Initial Boot
  renderNav();
  renderQuestion();
  updateProgress();
  requestAnimationFrame(() => {
    scrollToCurrentQuestion(true);
  });

})();
