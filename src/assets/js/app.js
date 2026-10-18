/*
    Falak Theme 2026 — site-wide behavior.

    Commerce actions (add to cart, quantity, wishlist, checkout) are NOT
    handled here — they're delegated entirely to the `<falak-*>` SDK web
    components (see falak-add-product-button.js and friends), so a page keeps
    working even if this file fails to load. What's left here is markup-only
    behavior the SDK doesn't own: the mega menu panel, language-switch link
    rewriting, and small per-page glue (e.g. the listing sort + filters drawer below).
*/
(function () {
    'use strict';

    /* ---------------------------------------------------- scroll reveal */
    // Elements marked data-reveal="fade|slide-left|slide-up" (Jalawi's entrance
    // animations) start hidden: master.twig's head sets `has-reveal`, and drops
    // it again if this script hasn't claimed it (`reveal-ready`) within 3s, so
    // a failed load never leaves content hidden. Each one
    // animates in the first time it scrolls into view, after its
    // --reveal-delay. New ones (customizer re-renders, built cards) are
    // picked up too.

    if (document.documentElement.classList.contains('has-reveal')) {
        document.documentElement.classList.add('reveal-ready');

        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                revealObserver.unobserve(entry.target);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });

        function watchReveals() {
            document.querySelectorAll('[data-reveal]:not(.is-revealed):not([data-reveal-watched])').forEach(function (el) {
                el.setAttribute('data-reveal-watched', '');
                revealObserver.observe(el);
            });
        }

        var revealPending = false;
        new MutationObserver(function () {
            if (revealPending) return;
            revealPending = true;
            requestAnimationFrame(function () { revealPending = false; watchReveals(); });
        }).observe(document.body, { childList: true, subtree: true });
        watchReveals();
    }

    /* ------------------------------------------------------- mega menu */
    // The panel slides in from the start edge; CSS owns the motion, this only
    // flips .is-open, inert and focus. The accordions inside are <falak-menu>'s.

    var megaMenu = document.querySelector('[data-mega-menu]');
    var megaTrigger = document.querySelector('[data-mega-open]');

    if (megaMenu && megaTrigger) {
        var megaReturnFocus = null;

        function openMega() {
            megaReturnFocus = document.activeElement;
            megaMenu.removeAttribute('inert');
            megaMenu.setAttribute('aria-hidden', 'false');
            document.body.classList.add('mega-is-open');
            megaTrigger.setAttribute('aria-expanded', 'true');
            var close = megaMenu.querySelector('.mega-menu__close');
            if (close) close.focus({ preventScroll: true });
        }

        function closeMega() {
            if (!document.body.classList.contains('mega-is-open')) return;
            document.body.classList.remove('mega-is-open');
            megaMenu.setAttribute('aria-hidden', 'true');
            megaMenu.setAttribute('inert', '');
            megaTrigger.setAttribute('aria-expanded', 'false');
            if (megaReturnFocus && megaReturnFocus.focus) megaReturnFocus.focus({ preventScroll: true });
        }

        megaTrigger.addEventListener('click', openMega);
        document.querySelectorAll('[data-mega-close]').forEach(function (el) {
            el.addEventListener('click', closeMega);
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeMega();
        });

        // Following a link closes the panel. A parent's link is the accordion
        // toggle <falak-menu> already handled (it prevents the navigation).
        megaMenu.addEventListener('click', function (event) {
            if (event.defaultPrevented) return;
            if (event.target.closest('a[href]')) closeMega();
        });
    }

    /* ----------------------------------------------- language switching */
    // The storefront reads ?lang= per request, so the choice must ride on
    // every internal link until the platform persists locale in the session.

    var currentLang = new URLSearchParams(window.location.search).get('lang');

    document.addEventListener('click', function (event) {
        var swap = event.target.closest('[data-set-lang]');
        if (!swap) return;

        event.preventDefault();
        var params = new URLSearchParams(window.location.search);
        params.set('lang', swap.getAttribute('data-set-lang'));
        window.location.search = params.toString();
    });

    var currentDraft = new URLSearchParams(window.location.search).get('draft');

    if (currentLang || currentDraft) {
        document.querySelectorAll('a[href]').forEach(function (link) {
            var href = link.getAttribute('href');

            if (!href || href.charAt(0) !== '/' || link.hasAttribute('data-set-lang')) return;

            var url = new URL(href, window.location.origin);
            if (currentLang && !url.searchParams.has('lang')) url.searchParams.set('lang', currentLang);
            if (currentDraft && !url.searchParams.has('draft')) url.searchParams.set('draft', currentDraft);
            link.setAttribute('href', url.pathname + url.search + url.hash);
        });

        if (currentDraft) {
            document.addEventListener('click', function (event) {
                var a = event.target.closest('a[href]');
                if (!a) return;
                var href = a.getAttribute('href');
                if (!href || href.charAt(0) !== '/' || href.startsWith('//')) return;
                var url = new URL(href, window.location.origin);
                if (!url.searchParams.has('draft')) {
                    url.searchParams.set('draft', currentDraft);
                    a.setAttribute('href', url.pathname + url.search + url.hash);
                }
            }, true);
        }
    }

    /* --------------------------------------------- back to top + progress */

    var toTop = document.querySelector('[data-back-to-top]');
    var progress = document.querySelector('[data-scroll-progress]');

    if (toTop) {
        var ticking = false;

        function updateProgress() {
            var max = document.documentElement.scrollHeight - window.innerHeight;
            var ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
            if (progress) progress.style.strokeDashoffset = String(100 - ratio * 100);
            toTop.classList.toggle('is-visible', window.scrollY > 200);
            ticking = false;
        }

        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(updateProgress);
        }, { passive: true });
        window.addEventListener('resize', updateProgress);
        updateProgress();

        toTop.addEventListener('click', function () {
            var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
        });
    }

    /* ---------------------------------------------- floating video card */
    // Shown below the hero slider (or 700px down on pages without one),
    // hidden again above it. Closing it keeps it away for this visit.

    var sideVideo = document.querySelector('[data-side-video]');

    if (sideVideo) {
        var SIDE_KEY = 'jalawi:side-video-closed';
        var closedForVisit = false;
        try { closedForVisit = window.sessionStorage.getItem(SIDE_KEY) === '1'; } catch (e) { /* storage blocked */ }

        if (closedForVisit) {
            sideVideo.remove();
        } else {
            var sideMedia = sideVideo.querySelector('video');
            var hero = document.querySelector('.block--hero-slider');
            var sideShown = false;
            var sideTicking = false;
            sideVideo.hidden = false;

            function sideThreshold() {
                if (!hero) return 700;
                var rect = hero.getBoundingClientRect();
                return Math.max(0, rect.bottom + window.scrollY - window.innerHeight * 0.4);
            }

            function setSideShown(show) {
                if (show === sideShown) return;
                sideShown = show;
                sideVideo.classList.toggle('is-shown', show);
                if (!sideMedia) return;
                if (show) sideMedia.play().catch(function () { /* autoplay refused — poster stays */ });
                else sideMedia.pause();
            }

            var siteHeader = document.querySelector('.site-header');

            // Park the card just under the header — a sticky header would
            // otherwise sit on top of it and cut its top off.
            function placeSide() {
                var headerBottom = siteHeader ? siteHeader.getBoundingClientRect().bottom : 0;
                sideVideo.style.setProperty('--side-video-top', Math.max(12, headerBottom + 12) + 'px');
            }

            function checkSide() {
                sideTicking = false;
                placeSide();
                setSideShown(window.scrollY > sideThreshold());
            }

            window.addEventListener('scroll', function () {
                if (sideTicking) return;
                sideTicking = true;
                requestAnimationFrame(checkSide);
            }, { passive: true });
            window.addEventListener('resize', checkSide);
            checkSide();

            sideVideo.querySelector('[data-side-video-close]').addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                try { window.sessionStorage.setItem(SIDE_KEY, '1'); } catch (e) { /* not remembered */ }
                setSideShown(false);
                window.setTimeout(function () { sideVideo.remove(); }, 500);
            });
        }
    }

    /* ------------------------------------------------- sticky glass header */

    // Jalawi behaviour: the strips above the main bar (maintenance, top bar)
    // scroll away and only the main bar stays pinned — done with a negative
    // sticky `top` equal to their height. Past 200px the bar turns to frosted
    // glass (`is-scrolled`).
    var stickyHeader = document.querySelector('.site-header--sticky');
    if (stickyHeader) {
        var mainBar = stickyHeader.querySelector('.site-header__topbar');
        var headerTicking = false;

        function setStickOffset() {
            var offset = mainBar ? mainBar.offsetTop : 0;
            stickyHeader.style.setProperty('--header-stick-top', -offset + 'px');
        }

        function checkHeader() {
            headerTicking = false;
            stickyHeader.classList.toggle('is-scrolled', window.scrollY > 200);
        }

        setStickOffset();
        checkHeader();
        window.addEventListener('load', setStickOffset);
        window.addEventListener('resize', setStickOffset);
        // Announcement / maintenance components render after this runs.
        if ('ResizeObserver' in window) new ResizeObserver(setStickOffset).observe(stickyHeader);
        window.addEventListener('scroll', function () {
            if (headerTicking) return;
            headerTicking = true;
            requestAnimationFrame(checkHeader);
        }, { passive: true });
    }

    /* ------------------------------------------------- copy discount code */

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        return new Promise(function (resolve, reject) {
            var area = document.createElement('textarea');
            area.value = text;
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
            area.remove();
            ok ? resolve() : reject();
        });
    }

    document.addEventListener('click', function (event) {
        var btn = event.target.closest('[data-copy-code]');
        if (!btn) return;
        var label = btn.querySelector('[data-copy-label]');
        copyText(btn.getAttribute('data-copy-code')).then(function () {
            if (!label) return;
            if (!label.dataset.original) label.dataset.original = label.textContent;
            label.textContent = label.getAttribute('data-copied') || label.dataset.original;
            btn.classList.add('is-copied');
            window.clearTimeout(btn._copyTimer);
            btn._copyTimer = window.setTimeout(function () {
                label.textContent = label.dataset.original;
                btn.classList.remove('is-copied');
            }, 2000);
        }).catch(function () { /* clipboard blocked — nothing to show */ });
    });

    /* ------------------------------------------ draggable floating button */
    // Drag anywhere, snap to the nearest side on release, remember the spot.
    // A drag must not also follow the link, so the click after one is eaten.

    var floatBtn = document.querySelector('[data-draggable-float]');

    if (floatBtn) {
        var STORE_KEY = 'jalawi:float-pos';
        var EDGE = 12;
        var drag = null;
        var suppressClick = false;

        function clampTop(top) {
            return Math.min(Math.max(top, EDGE), window.innerHeight - floatBtn.offsetHeight - EDGE);
        }

        function place(side, top) {
            var left = side === 'left' ? EDGE : window.innerWidth - floatBtn.offsetWidth - EDGE;
            floatBtn.classList.add('is-placed');
            floatBtn.style.left = left + 'px';
            floatBtn.style.top = clampTop(top) + 'px';
            floatBtn.dataset.side = side;
        }

        try {
            var saved = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null');
            if (saved && (saved.side === 'left' || saved.side === 'right') && typeof saved.top === 'number') {
                place(saved.side, saved.top);
            }
        } catch (e) { /* storage unavailable — keep the default spot */ }

        floatBtn.addEventListener('pointerdown', function (event) {
            if (event.button !== 0) return;
            var rect = floatBtn.getBoundingClientRect();
            drag = { x: event.clientX, y: event.clientY, dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false };
            floatBtn.setPointerCapture(event.pointerId);
        });

        floatBtn.addEventListener('pointermove', function (event) {
            if (!drag) return;
            if (!drag.moved && Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) < 6) return;

            drag.moved = true;
            floatBtn.classList.add('is-placed', 'is-dragging');
            floatBtn.style.left = (event.clientX - drag.dx) + 'px';
            floatBtn.style.top = (event.clientY - drag.dy) + 'px';
        });

        function endDrag(event) {
            if (!drag) return;
            var moved = drag.moved;
            drag = null;
            if (floatBtn.hasPointerCapture(event.pointerId)) floatBtn.releasePointerCapture(event.pointerId);
            if (!moved) return;

            suppressClick = true;
            floatBtn.classList.remove('is-dragging');
            var rect = floatBtn.getBoundingClientRect();
            var side = rect.left + rect.width / 2 < window.innerWidth / 2 ? 'left' : 'right';
            place(side, rect.top);

            try {
                window.localStorage.setItem(STORE_KEY, JSON.stringify({ side: side, top: parseFloat(floatBtn.style.top) }));
            } catch (e) { /* not persisted — fine */ }
        }

        floatBtn.addEventListener('pointerup', endDrag);
        floatBtn.addEventListener('pointercancel', endDrag);

        floatBtn.addEventListener('click', function (event) {
            if (!suppressClick) return;
            suppressClick = false;
            event.preventDefault();
        });

        floatBtn.addEventListener('dragstart', function (event) { event.preventDefault(); });

        window.addEventListener('resize', function () {
            if (floatBtn.classList.contains('is-placed')) place(floatBtn.dataset.side || 'right', parseFloat(floatBtn.style.top) || 0);
        });
    }

    /* ------------------------------------------------ product comparison */

    var compareTab = document.querySelector('[data-compare-open]');

    if (compareTab) {
        var COMPARE_KEY = 'jalawi:compare';
        var COMPARE_MAX = 4;
        var comparePanel = document.querySelector('[data-compare-panel]');
        var compareBody = document.querySelector('[data-compare-body]');
        var compareCache = new Map();
        var compareReturnFocus = null;
        var isArabic = (document.documentElement.lang || '').indexOf('ar') === 0;
        var compareIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 4v10m0 0-3-3m3 3 3-3M17 20V10m0 0-3 3m3-3 3 3M4 20h6M14 4h6"/></svg>';

        function t(key, vars) {
            var text = (window.falak && window.falak.lang && window.falak.lang.get(key)) || key;
            Object.keys(vars || {}).forEach(function (name) { text = text.replace('{' + name + '}', vars[name]); });
            return text;
        }

        function esc(value) {
            var div = document.createElement('div');
            div.textContent = value === null || value === undefined ? '' : String(value);
            return div.innerHTML;
        }

        function readCompare() {
            try {
                var list = JSON.parse(window.localStorage.getItem(COMPARE_KEY) || '[]');
                return Array.isArray(list) ? list.map(String).slice(0, COMPARE_MAX) : [];
            } catch (e) { return []; }
        }

        var compareIds = readCompare();

        function saveCompare() {
            try { window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds)); } catch (e) { /* not persisted */ }
        }

        function syncCompareUi() {
            var count = document.querySelector('[data-compare-count]');
            if (count) count.textContent = String(compareIds.length);
            document.querySelectorAll('[data-compare-toggle]').forEach(function (btn) {
                var on = compareIds.indexOf(btn.getAttribute('data-compare-toggle')) !== -1;
                btn.classList.toggle('is-active', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
                btn.setAttribute('aria-label', on ? t('compare.remove') : t('compare.add'));
            });
        }

        function toggleCompare(id) {
            var at = compareIds.indexOf(id);
            if (at !== -1) {
                compareIds.splice(at, 1);
                showToast(t('compare.removed'));
            } else if (compareIds.length >= COMPARE_MAX) {
                showToast(t('compare.full', { max: COMPARE_MAX }), 'error');
                return;
            } else {
                compareIds.push(id);
                showToast(t('compare.added'), 'success');
            }
            saveCompare();
            syncCompareUi();
            if (comparePanel && !comparePanel.hidden) renderCompare();
        }

        // Product cards are drawn by the SDK and redrawn at will, so the
        // action buttons (quick view, wishlist, compare, share) and category
        // are decorated whenever card actions appear.
        function decorateCards() {
            document.querySelectorAll('.f-card__actions').forEach(function (actions) {
                if (actions.closest('.hero-thumb')) return; // hero glass cards stay Jalawi's two buttons

                var card = actions.closest('.f-card__inner') || actions.closest('.f-card');
                if (!card) return;

                var source = actions.querySelector('[product-id]');
                var productId = source ? source.getAttribute('product-id') : null;
                var productUrl = null;
                var linkEl = card.querySelector('a.f-card__link') || card.querySelector('a.f-card__media');
                if (linkEl) productUrl = linkEl.getAttribute('href');

                // Quick actions column at top-end corner of card
                var quickActions = actions.querySelector('.f-card__quick-actions');
                if (!quickActions) {
                    quickActions = document.createElement('div');
                    quickActions.className = 'f-card__quick-actions';
                    actions.appendChild(quickActions);
                }

                // 1. Quick view (Eye icon)
                if (!quickActions.querySelector('.f-card__quickview') && productUrl) {
                    var qvBtn = document.createElement('a');
                    qvBtn.className = 'f-card__quickview f-card__icon-btn';
                    qvBtn.href = productUrl;
                    qvBtn.setAttribute('aria-label', isArabic ? 'عرض سريع' : 'Quick view');
                    qvBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
                    quickActions.appendChild(qvBtn);
                }

                // 2. Wishlist button (move inside quickActions)
                var wishlistHost = actions.querySelector('falak-wishlist-button') || actions.querySelector('.f-card__wishlist');
                if (wishlistHost && wishlistHost.parentElement !== quickActions) {
                    quickActions.appendChild(wishlistHost);
                }

                // 3. Compare button (Arrows icon)
                var compBtn = actions.querySelector('[data-compare-toggle]');
                if (!compBtn && productId) {
                    compBtn = document.createElement('button');
                    compBtn.type = 'button';
                    compBtn.className = 'f-card__compare f-card__icon-btn';
                    compBtn.setAttribute('data-compare-toggle', productId);
                    compBtn.setAttribute('aria-label', isArabic ? 'مقارنة' : 'Compare');
                    compBtn.innerHTML = compareIcon;
                    quickActions.appendChild(compBtn);
                } else if (compBtn && compBtn.parentElement !== quickActions) {
                    quickActions.appendChild(compBtn);
                }

                // 4. Share / Copy Link button
                if (!quickActions.querySelector('.f-card__share') && (productId || productUrl)) {
                    var shareBtn = document.createElement('button');
                    shareBtn.type = 'button';
                    shareBtn.className = 'f-card__share f-card__icon-btn';
                    if (productUrl) shareBtn.setAttribute('data-share-url', productUrl);
                    shareBtn.setAttribute('aria-label', isArabic ? 'نسخ الرابط' : 'Copy link');
                    shareBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
                    quickActions.appendChild(shareBtn);
                }

                // Category line above title
                var cardHost = card.closest('falak-product-card');
                if (cardHost && cardHost.product && !card.querySelector('.f-card__category')) {
                    var p = cardHost.product;
                    var catName = (isArabic && (p.category_name_ar || (p.category && p.category.name_ar))) ||
                        p.category_name || (p.category && p.category.name) || p.subtitle_ar || p.subtitle;
                    if (catName) {
                        var body = card.querySelector('.f-card__body');
                        if (body) {
                            var catEl = document.createElement('span');
                            catEl.className = 'f-card__category';
                            catEl.textContent = catName;
                            body.insertBefore(catEl, body.firstChild);
                        }
                    }
                }
            });
            syncCompareUi();
        }

        var decoratePending = false;
        new MutationObserver(function () {
            if (decoratePending) return;
            decoratePending = true;
            requestAnimationFrame(function () { decoratePending = false; decorateCards(); });
        }).observe(document.body, { childList: true, subtree: true });
        decorateCards();

        document.addEventListener('click', function (event) {
            var toggleBtn = event.target.closest('[data-compare-toggle]');
            if (!toggleBtn) return;
            event.preventDefault();
            event.stopPropagation();
            toggleCompare(toggleBtn.getAttribute('data-compare-toggle'));
        }, true);

        // Copy / share product link handler
        document.addEventListener('click', function (event) {
            var shareBtn = event.target.closest('.f-card__share, [data-share-url]');
            if (!shareBtn) return;
            event.preventDefault();
            event.stopPropagation();
            var url = shareBtn.getAttribute('data-share-url') || window.location.href;
            if (url.indexOf('http') !== 0) url = window.location.origin + url;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function () {
                    showToast(isArabic ? 'تم نسخ رابط المنتج بنجاح' : 'Product link copied to clipboard', 'success');
                }).catch(function () {
                    showToast(isArabic ? 'تم نسخ رابط المنتج' : 'Product link copied', 'info');
                });
            } else {
                showToast(isArabic ? 'تم نسخ رابط المنتج' : 'Product link copied', 'info');
            }
        });

        // Card hover & Button hover helper for desktop (guarantees hover state across all devices)
        document.addEventListener('mouseover', function (event) {
            var card = event.target.closest('falak-product-card, .f-slider__slide, .f-card, .f-card__inner, .product-card');
            if (card && !card.classList.contains('is-card-hovered')) {
                card.classList.add('is-card-hovered');
            }
            var btn = event.target.closest('.f-card__quick-actions a, .f-card__quick-actions button, .f-card__quick-actions .f-card__icon-btn, .f-card__add, .f-add-product__button, falak-add-product-button button, .btn--card, .btn--card-icon');
            if (btn && !btn.classList.contains('is-btn-hovered')) {
                btn.classList.add('is-btn-hovered');
            }
        });

        document.addEventListener('mouseout', function (event) {
            var card = event.target.closest('falak-product-card, .f-slider__slide, .f-card, .f-card__inner, .product-card');
            if (card) {
                var related = event.relatedTarget ? event.relatedTarget.closest('falak-product-card, .f-slider__slide, .f-card, .f-card__inner, .product-card') : null;
                if (related !== card) {
                    card.classList.remove('is-card-hovered');
                }
            }
            var btn = event.target.closest('.f-card__quick-actions a, .f-card__quick-actions button, .f-card__quick-actions .f-card__icon-btn, .f-card__add, .f-add-product__button, falak-add-product-button button, .btn--card, .btn--card-icon');
            if (btn) {
                btn.classList.remove('is-btn-hovered');
            }
        });

        // Instant click color scheme reversal feedback for all card buttons
        var cardBtnSelector = '.f-card__add, .f-card__wishlist, .f-wishlist__button, falak-wishlist-button button, .f-card__compare, .f-card__quickview, .f-card__share, .f-add-product__button, falak-add-product-button button, .btn--card, .btn--card-icon, .f-card__quick-actions a, .f-card__quick-actions button';
        document.addEventListener('pointerdown', function (event) {
            var btn = event.target.closest(cardBtnSelector);
            if (!btn) return;
            btn.classList.add('is-clicked');
        });
        document.addEventListener('pointerup', function (event) {
            var btn = event.target.closest(cardBtnSelector);
            if (btn) {
                setTimeout(function () { btn.classList.remove('is-clicked'); }, 400);
            }
        });
        document.addEventListener('pointercancel', function (event) {
            var btn = event.target.closest(cardBtnSelector);
            if (btn) btn.classList.remove('is-clicked');
        });

        function loadProduct(id) {
            if (compareCache.has(id)) return Promise.resolve(compareCache.get(id));
            if (!window.falak || !window.falak.product) return Promise.resolve(null);
            return window.falak.product.show(id).then(function (res) {
                var p = res && res.data ? res.data : res;
                compareCache.set(id, p);
                return p;
            }).catch(function () { return null; });
        }

        function money(amount, currency) {
            return window.falak && window.falak.money ? window.falak.money(amount, currency) : String(amount);
        }

        function productCell(p, id) {
            var name = (isArabic && p.name_ar) || p.name || '';
            var image = p.images && p.images[0] ? p.images[0].url : '';
            return '<div class="compare-panel__product">' +
                '<button class="compare-panel__remove" type="button" data-compare-toggle="' + esc(id) + '" aria-label="' + esc(t('compare.remove')) + '">&times;</button>' +
                '<a href="/product/' + encodeURIComponent(id) + '" class="compare-panel__media">' +
                (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<span class="compare-panel__placeholder"></span>') +
                '</a>' +
                '<a href="/product/' + encodeURIComponent(id) + '" class="compare-panel__name">' + esc(name) + '</a>' +
                '</div>';
        }

        function priceCell(p) {
            var price = Number(p.price_cents);
            var sale = Number(p.discount_price_cents);
            if (p.discount_price_cents !== null && Number.isFinite(sale) && sale < price) {
                return '<strong>' + esc(money(sale, p.currency)) + '</strong> <del>' + esc(money(price, p.currency)) + '</del>';
            }
            return '<strong>' + esc(money(price, p.currency)) + '</strong>';
        }

        function renderCompare() {
            if (!compareIds.length) {
                compareBody.innerHTML = '<p class="compare-panel__empty">' + esc(t('compare.empty')) + '</p>';
                return;
            }

            compareBody.setAttribute('aria-busy', 'true');
            var ids = compareIds.slice();

            Promise.all(ids.map(loadProduct)).then(function (products) {
                var rows = [];
                var items = ids.map(function (id, i) { return { id: id, p: products[i] }; }).filter(function (x) { return x.p; });

                function row(label, cell) {
                    rows.push('<tr><th scope="row">' + esc(label) + '</th>' + items.map(function (x) { return '<td>' + cell(x.p) + '</td>'; }).join('') + '</tr>');
                }

                row(t('compare.price'), priceCell);
                row(t('compare.availability'), function (p) {
                    var inStock = Number(p.quantity) > 0 || p.allow_backorders;
                    return '<span class="compare-panel__stock' + (inStock ? '' : ' is-out') + '">' + esc(t(inStock ? 'product.in_stock' : 'product.out_of_stock')) + '</span>';
                });
                row(t('product.rating'), function (p) {
                    return p.reviews_avg_rating ? esc(Number(p.reviews_avg_rating).toFixed(1)) + ' ★ <small>(' + esc(p.reviews_count || 0) + ')</small>' : '—';
                });
                row(t('compare.category'), function (p) {
                    var c = p.categories && p.categories[0];
                    return c ? esc((isArabic && c.name_ar) || c.name) : '—';
                });
                row(t('compare.weight'), function (p) { return p.weight ? esc(p.weight) : '—'; });

                compareBody.innerHTML =
                    '<div class="compare-panel__scroll"><table class="compare-panel__table">' +
                    '<thead><tr><td></td>' + items.map(function (x) { return '<th scope="col">' + productCell(x.p, x.id) + '</th>'; }).join('') + '</tr></thead>' +
                    '<tbody>' + rows.join('') + '</tbody>' +
                    '<tfoot><tr><td></td>' + items.map(function (x) {
                        return '<td><a class="btn btn--primary compare-panel__view" href="/product/' + encodeURIComponent(x.id) + '">' + esc(t('compare.view')) + '</a></td>';
                    }).join('') + '</tr></tfoot>' +
                    '</table></div>';
                compareBody.removeAttribute('aria-busy');
            });
        }

        function openCompare() {
            compareReturnFocus = document.activeElement;
            comparePanel.hidden = false;
            document.body.classList.add('compare-is-open');
            renderCompare();
            var close = comparePanel.querySelector('.compare-panel__close');
            if (close) close.focus();
        }

        function closeCompare() {
            if (comparePanel.hidden) return;
            comparePanel.hidden = true;
            document.body.classList.remove('compare-is-open');
            if (compareReturnFocus && compareReturnFocus.focus) compareReturnFocus.focus();
        }

        compareTab.addEventListener('click', openCompare);
        comparePanel.querySelectorAll('[data-compare-close]').forEach(function (el) { el.addEventListener('click', closeCompare); });
        comparePanel.querySelector('[data-compare-clear]').addEventListener('click', function () {
            compareIds = [];
            saveCompare();
            syncCompareUi();
            renderCompare();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeCompare();
        });

        window.addEventListener('storage', function (event) {
            if (event.key !== COMPARE_KEY) return;
            compareIds = readCompare();
            syncCompareUi();
        });

        syncCompareUi();
    }

    /* --------------------------------------------------- announcement bar */
    // Now <falak-announcement> (platform component): dashboard declarations,
    // the customizer text, the welcome fallback, marquee and per-text
    // dismissal all live there. Nothing for the theme to do.

    /* -------------------------------------------- video embed normalizer */
    // Merchants paste whatever YouTube/Vimeo link they have, but only the
    // /embed/ and player.vimeo.com forms may load inside an iframe (watch
    // pages send X-Frame-Options and show a grey refused-to-connect box).
    // Rewrite the common share forms to the embeddable ones.

    function embedUrlFor(raw) {
        var url;

        try { url = new URL(raw, window.location.origin); } catch (e) { return null; }

        var host = url.hostname.replace(/^(www|m)\./, '');

        if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
            if (url.pathname.indexOf('/embed/') === 0) return null; // already fine

            var id = url.searchParams.get('v');
            if (!id && /^\/(shorts|live)\//.test(url.pathname)) id = url.pathname.split('/')[2];

            return id ? 'https://www.youtube.com/embed/' + id : null;
        }

        if (host === 'youtu.be') {
            var short = url.pathname.slice(1).split('/')[0];
            return short ? 'https://www.youtube.com/embed/' + short : null;
        }

        if (host === 'vimeo.com') {
            var vid = url.pathname.slice(1).split('/')[0];
            return /^\d+$/.test(vid) ? 'https://player.vimeo.com/video/' + vid : null;
        }

        return null;
    }

    document.querySelectorAll('.video-embed iframe').forEach(function (frame) {
        var fixed = embedUrlFor(frame.getAttribute('src') || '');
        if (fixed) frame.src = fixed;
    });

    /* ------------------------------------------------------- add to cart */
    /*
        Adding is <falak-add-product-button>'s job now: it reads the quantity
        stepper, performs the add for a guest or a customer, and reports back.
        What is left for the theme is the visible side — a toast for the SDK's
        notify() (silent until a theme claims it) and the header badge.
    */

    function showToast(message, type) {
        var host = document.querySelector('[data-toasts]');
        if (!host) {
            host = document.createElement('div');
            host.className = 'toasts';
            host.setAttribute('data-toasts', '');
            host.setAttribute('aria-live', 'polite');
            document.body.appendChild(host);
        }
        var el = document.createElement('div');
        el.className = 'toast toast--' + (type || 'info');
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');
        el.textContent = message;
        host.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('is-in'); });
        window.setTimeout(function () {
            el.classList.remove('is-in');
            window.setTimeout(function () { el.remove(); }, 300);
        }, type === 'error' ? 4500 : 2800);
    }

    // A <falak-notifications> on the page renders its own toast stack off
    // the same falak.notify calls (it listens on the bus, not this handler
    // slot) — leaving this registered too would show every message twice.
    if (window.falak && !document.querySelector('falak-notifications')) {
        window.falak.notify.setNotifier(function (message, type) { showToast(message, type); });
    }

    /* --------------------------------------------------------- cart page */
    /*
        The page is server-rendered; each control asks the SDK for the change
        and reloads so the server draws the new state — one source of truth,
        no client-side templating. The header's <falak-cart-summary> follows
        the SDK on its own.
    */

    var cartPage = document.querySelector('[data-cart-page]');

    if (cartPage && window.falak) {
        var cartBusy = false;

        function lineOf(el) {
            var line = el.closest('[data-cart-line]');
            if (!line) return null;
            return {
                productId: line.getAttribute('data-product-id'),
                variationId: line.getAttribute('data-variation-id') || null,
                quantity: parseInt(line.querySelector('[data-cart-qty-value]').textContent, 10) || 1
            };
        }

        function runCart(action) {
            if (cartBusy) return;
            cartBusy = true;
            cartPage.classList.add('is-busy');
            action().then(function () {
                window.location.reload();
            }).catch(function (error) {
                cartBusy = false;
                cartPage.classList.remove('is-busy');
                showToast((error && error.message) || window.falak.lang.get('common.load_failed'), 'error');
            });
        }

        cartPage.addEventListener('click', function (event) {
            var step = event.target.closest('[data-cart-qty]');
            if (step) {
                var line = lineOf(step);
                if (!line) return;
                var next = line.quantity + (step.getAttribute('data-cart-qty') === 'up' ? 1 : -1);
                runCart(function () {
                    return next < 1
                        ? window.falak.cart.remove(line.productId, { variationId: line.variationId })
                        : window.falak.cart.update(line.productId, next, { variationId: line.variationId });
                });
                return;
            }

            var remove = event.target.closest('[data-cart-remove]');
            if (remove) {
                var target = lineOf(remove);
                if (!target) return;
                runCart(function () { return window.falak.cart.remove(target.productId, { variationId: target.variationId }); });
                return;
            }
        });

        // The coupon control is <falak-cart-coupons>; it applies and removes on
        // its own and shows its own error. The page only needs new totals.
        window.falak.event.on('cart::coupon.applied', function () { window.location.reload(); });
        window.falak.event.on('cart::coupon.removed', function () { window.location.reload(); });
    }

    /*
        Components announce on the bus as well as the DOM. Subscribing here is
        how the theme reacts to a component without either side holding a
        reference to the other — the same decoupling the platform relies on.
    */
    if (window.falak) {
        window.falak.event.on('product::quantity.changed', function (payload) {
            window.falak.log('quantity changed', payload);
        });
    }

    /* --------------------------------------------- variant price display */
    // <falak-product-options> announces the chosen variant; the page shows
    // its price where the product's price was.

    if (window.falak) {
        window.falak.event.on('product::options.changed', function (payload) {
            var el = document.querySelector('[data-product-price]');
            if (!el || !payload) return;
            if (!el.dataset.basePrice) el.dataset.basePrice = el.innerHTML;

            if (payload.price === null || payload.price === undefined) {
                el.innerHTML = el.dataset.basePrice;
                return;
            }

            var html = window.falak.money(payload.price);
            if (payload.comparePrice) html += ' <del>' + window.falak.money(payload.comparePrice) + '</del>';
            el.innerHTML = html;
        });
    }

    /* variant color swatches */
    function resolveDashboardColor(val, colorDefs) {
        if (!val) return null;
        var clean = String(val).trim();
        if (clean.charAt(0) === '#' || clean.startsWith('rgb')) return clean;

        // Read exact color chosen in merchant store dashboard
        if (colorDefs && Array.isArray(colorDefs)) {
            for (var i = 0; i < colorDefs.length; i++) {
                var def = colorDefs[i];
                if (def && Array.isArray(def.values)) {
                    for (var j = 0; j < def.values.length; j++) {
                        var item = def.values[j];
                        if (item && (item.value === clean || item.label === clean)) {
                            var disp = item.display_value || item.display;
                            if (disp) return disp;
                        }
                    }
                }
            }
        }

        // Standard CSS color name support
        var s = new Option().style;
        s.color = clean;
        if (s.color !== '') return clean;

        return null;
    }

    function enhanceProductOptions() {
        var optionsEl = document.querySelector('falak-product-options');
        if (!optionsEl) return;

        var optionsData = null;
        try {
            var raw = optionsEl.getAttribute('options');
            if (raw) optionsData = JSON.parse(raw);
        } catch (e) { }

        if (!optionsData && optionsEl.options && Array.isArray(optionsEl.options)) {
            optionsData = optionsEl.options;
        }

        var groups = optionsEl.querySelectorAll('.f-options__group');
        groups.forEach(function (group) {
            var nameEl = group.querySelector('.f-options__name');
            var groupName = nameEl ? nameEl.textContent.trim().toLowerCase() : '';
            var isColor = /color|colour|لون|ألوان|الوان/.test(groupName);

            var pills = group.querySelectorAll('.f-options__pill');
            pills.forEach(function (pill) {
                if (pill.querySelector('.f-options__color-swatch')) return;

                var val = pill.getAttribute('data-value') || pill.textContent.trim();
                var color = isColor ? resolveDashboardColor(val, optionsData) : null;
                if (!color && isColor) {
                    color = resolveDashboardColor(pill.textContent.trim(), optionsData);
                }

                if (color) {
                    var swatch = document.createElement('span');
                    swatch.className = 'f-options__color-swatch';
                    swatch.style.backgroundColor = color;
                    swatch.setAttribute('aria-hidden', 'true');
                    pill.prepend(swatch);
                }
            });
        });
    }

    function enhanceCartColors() {
        document.querySelectorAll('.cart-item__color-dot').forEach(function (dot) {
            var raw = dot.getAttribute('data-color') || dot.getAttribute('title') || '';
            var color = resolveDashboardColor(raw);
            if (color) {
                dot.style.backgroundColor = color;
                dot.removeAttribute('hidden');
            } else {
                var computed = window.getComputedStyle(dot).backgroundColor;
                if (!computed || computed === 'transparent' || computed === 'rgba(0, 0, 0, 0)') {
                    dot.setAttribute('hidden', '');
                }
            }
        });
    }

    enhanceProductOptions();
    enhanceCartColors();

    var optionsEl = document.querySelector('falak-product-options');
    if (optionsEl) {
        var optObserver = new MutationObserver(function () {
            enhanceProductOptions();
        });
        optObserver.observe(optionsEl, { childList: true, subtree: true });
    }

    /*  description read more */
    // The description is clamped by CSS; a toggle is added only when the text
    // actually overflows, so short descriptions show no dead button.

    document.querySelectorAll('[data-readmore]').forEach(function (box) {
        function setup() {
            if (box.nextElementSibling && box.nextElementSibling.classList.contains('product-single__readmore')) return;
            if (box.scrollHeight <= box.clientHeight + 1) return;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'product-single__readmore';
            btn.textContent = box.getAttribute('data-more') || 'Read more';
            btn.addEventListener('click', function () {
                var descTab = document.querySelector('[data-tab-target="tab-description"]');
                if (descTab) {
                    descTab.click();
                    var tabsWrap = document.querySelector('[data-tabs]') || descTab.closest('section');
                    if (tabsWrap) {
                        tabsWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
            box.insertAdjacentElement('afterend', btn);
        }

        setup();
        window.addEventListener('load', setup);
    });

    /*  gallery zoom lens */
    // A round magnifier follows the cursor over the main photo. The lens holds
    // its own copy of the image at ZOOM x the box size, shifted so the point
    // under the cursor sits at the lens centre — same object-fit as the
    // original, so contain/cover both line up. Hover-capable devices only.

    var zoomBox = document.querySelector('.gallery__main');
    var zoomMain = zoomBox && zoomBox.querySelector('[data-gallery-main]');

    if (zoomMain && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        var ZOOM = 2.5;
        var lens = document.createElement('div');
        lens.className = 'gallery__lens';
        lens.setAttribute('aria-hidden', 'true');
        var lensImg = document.createElement('img');
        lensImg.alt = '';
        lensImg.className = zoomMain.className;
        lens.appendChild(lensImg);
        zoomBox.appendChild(lens);

        zoomBox.addEventListener('mousemove', function (event) {
            var rect = zoomBox.getBoundingClientRect();
            var x = event.clientX - rect.left;
            var y = event.clientY - rect.top;
            var r = lens.offsetWidth / 2;

            if (lensImg.getAttribute('src') !== zoomMain.getAttribute('src')) lensImg.src = zoomMain.getAttribute('src');
            lensImg.style.width = rect.width * ZOOM + 'px';
            lensImg.style.height = rect.height * ZOOM + 'px';
            lensImg.style.left = (r - x * ZOOM) + 'px';
            lensImg.style.top = (r - y * ZOOM) + 'px';

            lens.style.left = (x - r) + 'px';
            lens.style.top = (y - r) + 'px';
            lens.classList.add('is-on');
        });
        zoomBox.addEventListener('mouseleave', function () { lens.classList.remove('is-on'); });
    }

    /* -------------------------------------------------- product gallery */

    document.addEventListener('click', function (event) {
        var thumb = event.target.closest('[data-gallery-thumb]');
        if (!thumb) return;

        var main = document.querySelector('[data-gallery-main]');
        if (!main) return;

        main.src = thumb.getAttribute('data-gallery-thumb');

        var thumbImg = thumb.querySelector('img');
        if (thumbImg && thumbImg.alt) main.alt = thumbImg.alt;

        document.querySelectorAll('[data-gallery-thumb]').forEach(function (el) {
            el.classList.toggle('is-active', el === thumb);
        });
    });

    /* ------------------------------------------------------ price filter */
    // <falak-price-range> only picks a range and emits it; reloading the
    // listing with it applied is the theme's job. Query-string only, so it
    // composes with every other filter, the category included — a category
    // page is this same URL with category_id[] on it.

    /* ------------------------------------------------ listing: sort + filters drawer */

    // <falak-filters> reloads with the selection itself; the sort select and
    // the phone-width drawer are the only listing glue left to the theme.
    var sort = document.querySelector('[data-sort]');

    if (sort) {
        sort.addEventListener('change', function () {
            var url = new URL(window.location.href);

            if (sort.value === 'newest') url.searchParams.delete('sort');
            else url.searchParams.set('sort', sort.value);

            url.searchParams.delete('page');
            window.location.href = url.toString();
        });
    }

    var panel = document.querySelector('[data-filters-panel]');
    var filtersBackdrop = document.querySelector('[data-filters-backdrop]');

    function setFilters(open) {
        if (!panel) return;
        panel.classList.toggle('is-open', open);
        document.body.classList.toggle('filters-are-open', open);
        if (filtersBackdrop) filtersBackdrop.hidden = !open;
    }

    document.querySelectorAll('[data-filters-open]').forEach(function (button) {
        button.addEventListener('click', function () { setFilters(true); });
    });
    document.querySelectorAll('[data-filters-close]').forEach(function (button) {
        button.addEventListener('click', function () { setFilters(false); });
    });
    if (filtersBackdrop) filtersBackdrop.addEventListener('click', function () { setFilters(false); });
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') setFilters(false);
    });

    function getStoreCurrency() {
        var fromPlatform = (window.falak && window.falak.store && window.falak.store.currency)
            || (window.falak && window.falak.currency && window.falak.currency.code)
            || (window.falak && window.falak.currency && window.falak.currency.display)
            || (window.Falak && window.Falak.boot && window.Falak.boot.currency);
        if (fromPlatform && typeof fromPlatform === 'string') return fromPlatform;
        if (fromPlatform && fromPlatform.code) return fromPlatform.code;
        var el = document.querySelector('[data-store-currency]');
        if (el && el.getAttribute('data-store-currency')) {
            return el.getAttribute('data-store-currency');
        }
        return 'SAR';
    }

    /* listing: filter toggle button */
    var filterToggleBtn = document.querySelector('[data-filter-toggle]');
    var listingContainer = document.querySelector('.product-listing');

    if (filterToggleBtn && listingContainer) {
        filterToggleBtn.addEventListener('click', function () {
            // On mobile devices (< 900px), toggle drawer
            if (window.innerWidth < 900) {
                setFilters(!panel.classList.contains('is-open'));
                return;
            }

            var isHidden = listingContainer.classList.toggle('is-filters-hidden');
            var labelSpan = filterToggleBtn.querySelector('.btn-filter-toggle__label');
            var hideText = filterToggleBtn.getAttribute('data-text-hide') || 'Hide Filters';
            var showText = filterToggleBtn.getAttribute('data-text-show') || 'Show Filters';

            if (labelSpan) {
                labelSpan.textContent = isHidden ? showText : hideText;
            }
            filterToggleBtn.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
            filterToggleBtn.setAttribute('aria-label', isHidden ? showText : hideText);
        });
    }

    /* listing: price filter submit & arrow */
    function initPriceFilter() {
        var priceRange = document.querySelector('.f-price-range');
        if (!priceRange) return;

        // Hide track if present
        var track = priceRange.querySelector('.f-price-range__track');
        if (track) track.style.display = 'none';

        var numbersWrap = priceRange.querySelector('.f-price-range__numbers');
        if (!numbersWrap) return;

        var inputs = numbersWrap.querySelectorAll('.f-price-range__number');
        if (inputs.length < 2) return;

        var minInput = inputs[0];
        var maxInput = inputs[1];

        // Lift restrictive max attributes ONLY if not already set (prevents infinite attribute loops)
        if (minInput.getAttribute('max') !== '9999') {
            minInput.removeAttribute('max');
            minInput.setAttribute('max', '9999');
            minInput.setAttribute('min', '0');
            minInput.setAttribute('step', 'any');
            minInput.min = '0';
            minInput.max = '9999';
        }

        if (maxInput.getAttribute('max') !== '9999') {
            maxInput.removeAttribute('max');
            maxInput.setAttribute('max', '9999');
            maxInput.setAttribute('min', '0');
            maxInput.setAttribute('step', 'any');
            maxInput.min = '0';
            maxInput.max = '9999';
        }

        // Intercept input & change in capture phase to stop SDK from clamping to 200
        if (!minInput.__unclamped) {
            minInput.__unclamped = true;
            minInput.addEventListener('input', function (e) {
                e.stopImmediatePropagation();
            }, true);
            minInput.addEventListener('change', function (e) {
                e.stopImmediatePropagation();
            }, true);
        }

        if (!maxInput.__unclamped) {
            maxInput.__unclamped = true;
            maxInput.addEventListener('input', function (e) {
                e.stopImmediatePropagation();
            }, true);
            maxInput.addEventListener('change', function (e) {
                e.stopImmediatePropagation();
            }, true);
        }

        // Set user-friendly placeholders
        minInput.placeholder = '0';
        maxInput.placeholder = '500';

        // Populate from URL if present; otherwise clear default catalog 200 cap ONCE
        if (!priceRange.__valuesChecked) {
            priceRange.__valuesChecked = true;
            var currentParams = new URLSearchParams(window.location.search);
            var urlMin = currentParams.get('min_price');
            var urlMax = currentParams.get('max_price');

            if (urlMin) {
                minInput.value = urlMin;
            } else if (minInput.value === '0') {
                minInput.value = '';
            }

            if (urlMax) {
                maxInput.value = urlMax;
            } else if (maxInput.value === '200' || maxInput.value === '200.00' || maxInput.value === '200.0') {
                maxInput.value = '';
            }
        }

        // Add currency label directly above each input like a cutout legend
        var currencyCode = getStoreCurrency();
        var currencyLabelText = '-' + currencyCode + '-';

        if (!numbersWrap.querySelector('.f-price-range__currency')) {
            if (minInput.parentElement === numbersWrap && maxInput.parentElement === numbersWrap) {
                var fieldMin = document.createElement('div');
                fieldMin.className = 'f-price-range__field';
                var curLabel1 = document.createElement('span');
                curLabel1.className = 'f-price-range__currency';
                curLabel1.textContent = currencyLabelText;
                numbersWrap.insertBefore(fieldMin, minInput);
                fieldMin.appendChild(curLabel1);
                fieldMin.appendChild(minInput);

                var fieldMax = document.createElement('div');
                fieldMax.className = 'f-price-range__field';
                var curLabel2 = document.createElement('span');
                curLabel2.className = 'f-price-range__currency';
                curLabel2.textContent = currencyLabelText;
                numbersWrap.insertBefore(fieldMax, maxInput);
                fieldMax.appendChild(curLabel2);
                fieldMax.appendChild(maxInput);
            }
        } else {
            var curLabels = numbersWrap.querySelectorAll('.f-price-range__currency');
            curLabels.forEach(function (lbl) {
                if (lbl.textContent !== currencyLabelText) lbl.textContent = currencyLabelText;
            });
        }

        // Add arrow submit button if not already added
        if (!numbersWrap.querySelector('.f-price-range__submit')) {
            var isRtl = document.documentElement.getAttribute('dir') === 'rtl';
            var submitBtn = document.createElement('button');
            submitBtn.type = 'button';
            submitBtn.className = 'f-price-range__submit';
            submitBtn.setAttribute('aria-label', isRtl ? 'تطبيق السعر' : 'Apply Price');
            submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
            numbersWrap.appendChild(submitBtn);

            function applyPrice() {
                var minVal = minInput.value.trim();
                var maxVal = maxInput.value.trim();
                var url = new URL(window.location.href);

                if (minVal !== '' && !isNaN(Number(minVal))) {
                    url.searchParams.set('min_price', minVal);
                } else {
                    url.searchParams.delete('min_price');
                }

                if (maxVal !== '' && !isNaN(Number(maxVal))) {
                    url.searchParams.set('max_price', maxVal);
                } else {
                    url.searchParams.delete('max_price');
                }

                url.searchParams.delete('page');
                window.location.href = url.toString();
            }

            submitBtn.addEventListener('click', applyPrice);

            minInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPrice();
                }
            });

            maxInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPrice();
                }
            });
        }
    }

    /* listing: selected filters strip */
    function initSelectedFilters() {
        var strip = document.querySelector('[data-selected-filters-strip]');
        var pillsContainer = document.querySelector('[data-selected-pills]');
        var clearAllBtn = document.querySelector('[data-clear-all-filters]');
        if (!strip || !pillsContainer) return;

        var url = new URL(window.location.href);
        var params = url.searchParams;
        var activePills = [];
        var isRtl = document.documentElement.getAttribute('dir') === 'rtl';

        // Category IDs: category_id[]
        var catIds = params.getAll('category_id[]');
        if (!catIds.length && params.has('category_id')) {
            catIds = [params.get('category_id')];
        }

        catIds.forEach(function (catId) {
            var label = '';
            var cb = document.querySelector('input[type="checkbox"][id*="' + catId + '"]');
            if (cb) {
                var parentOpt = cb.closest('.f-filters__option');
                if (parentOpt) {
                    var span = parentOpt.querySelector('span');
                    if (span) label = span.textContent.trim();
                }
            }
            if (!label) {
                var subEl = document.querySelector('.category-subcard[href*="' + catId + '"] .category-subcard__name');
                if (subEl) label = subEl.textContent.trim();
            }
            if (!label) label = catId;

            activePills.push({
                type: 'category',
                val: catId,
                title: (isRtl ? 'التصنيف: ' : 'Categories: ') + label
            });
        });

        // Price range
        var minP = params.get('min_price');
        var maxP = params.get('max_price');
        if (minP || maxP) {
            var priceText = '';
            var cur = getStoreCurrency();
            if (minP && maxP) priceText = minP + ' - ' + maxP + ' ' + cur;
            else if (minP) priceText = '≥ ' + minP + ' ' + cur;
            else if (maxP) priceText = '≤ ' + maxP + ' ' + cur;

            activePills.push({
                type: 'price',
                title: (isRtl ? 'السعر: ' : 'Price: ') + priceText
            });
        }

        // In stock
        if (params.get('in_stock') === '1' || params.get('in_stock') === 'true') {
            activePills.push({
                type: 'in_stock',
                title: (isRtl ? 'المتوفر فقط' : 'In stock only')
            });
        }

        if (activePills.length > 0) {
            strip.hidden = false;
            var newHtml = activePills.map(function (pill, idx) {
                return '<span class="product-listing__selected-pill">' +
                    '<span>' + pill.title + '</span>' +
                    '<button type="button" class="product-listing__selected-pill-remove" data-remove-pill="' + idx + '" aria-label="Remove filter">×</button>' +
                    '</span>';
            }).join('');

            // Only update DOM if the rendered HTML actually changed
            if (pillsContainer.dataset.renderedHtml !== newHtml) {
                pillsContainer.dataset.renderedHtml = newHtml;
                pillsContainer.innerHTML = newHtml;

                pillsContainer.querySelectorAll('[data-remove-pill]').forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var idx = parseInt(btn.getAttribute('data-remove-pill'), 10);
                        var pill = activePills[idx];
                        if (!pill) return;

                        var newUrl = new URL(window.location.href);
                        if (pill.type === 'category') {
                            var existing = newUrl.searchParams.getAll('category_id[]');
                            newUrl.searchParams.delete('category_id[]');
                            existing.filter(function (id) { return String(id) !== String(pill.val); }).forEach(function (id) {
                                newUrl.searchParams.append('category_id[]', id);
                            });
                            newUrl.searchParams.delete('category_id');
                        } else if (pill.type === 'price') {
                            newUrl.searchParams.delete('min_price');
                            newUrl.searchParams.delete('max_price');
                        } else if (pill.type === 'in_stock') {
                            newUrl.searchParams.delete('in_stock');
                        }
                        newUrl.searchParams.delete('page');
                        window.location.href = newUrl.toString();
                    });
                });
            }

            if (clearAllBtn && !clearAllBtn.__bound) {
                clearAllBtn.__bound = true;
                clearAllBtn.onclick = function () {
                    var cleanUrl = new URL(window.location.href);
                    cleanUrl.searchParams.delete('category_id[]');
                    cleanUrl.searchParams.delete('category_id');
                    cleanUrl.searchParams.delete('min_price');
                    cleanUrl.searchParams.delete('max_price');
                    cleanUrl.searchParams.delete('in_stock');
                    cleanUrl.searchParams.delete('page');
                    window.location.href = cleanUrl.toString();
                };
            }
        } else {
            strip.hidden = true;
            if (pillsContainer.dataset.renderedHtml !== '') {
                pillsContainer.dataset.renderedHtml = '';
                pillsContainer.innerHTML = '';
            }
        }
    }

    initPriceFilter();
    initSelectedFilters();

    var falakFiltersEl = document.querySelector('falak-filters');
    if (falakFiltersEl) {
        var filterDebounceTimer = null;
        var filterAttempts = 0;
        var priceObserver = new MutationObserver(function () {
            if (filterDebounceTimer) return;
            filterDebounceTimer = setTimeout(function () {
                filterDebounceTimer = null;
                initPriceFilter();
                initSelectedFilters();
                filterAttempts++;
                // Once price filter submit button is ready or max attempts reached, disconnect
                if (document.querySelector('.f-price-range__submit') || filterAttempts > 15) {
                    priceObserver.disconnect();
                }
            }, 120);
        });
        priceObserver.observe(falakFiltersEl, { childList: true, subtree: true });
    }

    /* listing: subcategories hydration */
    var subcatSection = document.querySelector('[data-category-subcategories]');
    if (subcatSection && !subcatSection.__hasHydrated) {
        subcatSection.__hasHydrated = true;
        var subcatList = subcatSection.querySelector('[data-subcategories-list]');
        var currentCatId = subcatSection.getAttribute('data-current-category-id');

        if (subcatList && subcatList.children.length === 0) {
            fetch('/api/storefront/categories')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    var categories = (data && data.data) ? data.data : (Array.isArray(data) ? data : []);
                    if (!categories || !categories.length) return;

                    var itemsToRender = [];
                    if (currentCatId) {
                        var targetCat = null;
                        function findCat(cats) {
                            for (var i = 0; i < cats.length; i++) {
                                if (String(cats[i].id) === String(currentCatId)) return cats[i];
                                if (cats[i].children && cats[i].children.length) {
                                    var f = findCat(cats[i].children);
                                    if (f) return f;
                                }
                            }
                            return null;
                        }
                        targetCat = findCat(categories);

                        if (targetCat && targetCat.children && targetCat.children.length) {
                            itemsToRender = targetCat.children;
                        } else {
                            itemsToRender = categories.filter(function (c) { return !c.parent_id; });
                        }
                    } else {
                        itemsToRender = categories.filter(function (c) { return !c.parent_id; });
                    }

                    if (!itemsToRender.length) return;

                    var isRtl = document.documentElement.getAttribute('dir') === 'rtl';
                    var shoppingBagSvg = '<svg class="category-subcard__icon" version="1.1" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><title>shopping-bag</title><path d="M28 10.667h-4v-2.667c0-4.412-3.588-8-8-8s-8 3.588-8 8v2.667h-4c-0.736 0-1.333 0.596-1.333 1.333v13.333c0 3.676 2.991 6.667 6.667 6.667h13.333c3.676 0 6.667-2.991 6.667-6.667v-13.333c0-0.737-0.597-1.333-1.333-1.333zM10.667 8c0-2.941 2.392-5.333 5.333-5.333s5.333 2.392 5.333 5.333v2.667h-10.667zM26.667 25.333c0 2.205-1.795 4-4 4h-13.333c-2.205 0-4-1.795-4-4v-12h2.667v2.667c0 0.737 0.597 1.333 1.333 1.333s1.333-0.596 1.333-1.333v-2.667h10.667v2.667c0 0.737 0.597 1.333 1.333 1.333s1.333-0.596 1.333-1.333v-2.667h2.667z"></path></svg>';

                    subcatList.innerHTML = itemsToRender.map(function (cat) {
                        var catName = (cat.name_json && cat.name_json[isRtl ? 'ar' : 'en']) || cat.name || '';
                        var catImg = cat.image_url || cat.image;
                        var avatarContent = catImg
                            ? '<img src="' + catImg + '" alt="' + catName + '" loading="lazy">'
                            : shoppingBagSvg;

                        return '<a href="/products?category_id%5B%5D=' + cat.id + '" class="category-subcard">' +
                            '<span class="category-subcard__avatar">' + avatarContent + '</span>' +
                            '<span class="category-subcard__name">' + catName + '</span>' +
                            '</a>';
                    }).join('');
                })
                .catch(function () { });
        }
    }

    /*  store branches */
    document.addEventListener('click', function (e) {
        var tab = e.target.closest('[data-branch-tab]');
        if (!tab) return;
        var block = tab.closest('.block--branches');
        if (!block) return;
        var targetIndex = tab.getAttribute('data-branch-tab');

        block.querySelectorAll('[data-branch-tab]').forEach(function (btn) {
            var active = btn.getAttribute('data-branch-tab') === targetIndex;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        block.querySelectorAll('[data-branch-panel]').forEach(function (panel) {
            var active = panel.getAttribute('data-branch-panel') === targetIndex;
            panel.classList.toggle('is-active', active);
            panel.hidden = !active;
        });

        var activePanel = block.querySelector('[data-branch-panel="' + targetIndex + '"]');
        if (activePanel) {
            var embedUrl = activePanel.getAttribute('data-map-embed');
            var linkUrl = activePanel.getAttribute('data-map-link');
            var iframe = block.querySelector('[data-branch-map-iframe]');
            var openLink = block.querySelector('[data-branch-map-link]');

            if (iframe && embedUrl) iframe.src = embedUrl;
            if (openLink && linkUrl) openLink.href = linkUrl;
        }
    });

    /* Product single page tabs (Description, Comments/Reviews, Shipping) */
    document.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('[data-tab-target]');
        if (!tabBtn) return;
        var container = tabBtn.closest('[data-tabs]');
        if (!container) return;
        var targetId = tabBtn.getAttribute('data-tab-target');
        var navBtns = container.querySelectorAll('[data-tab-target]');
        var panels = container.querySelectorAll('[role="tabpanel"]');

        navBtns.forEach(function (btn) {
            var active = (btn === tabBtn);
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
            var active = (panel.id === targetId);
            panel.classList.toggle('is-active', active);
            if (active) {
                panel.removeAttribute('hidden');
            } else {
                panel.setAttribute('hidden', '');
            }
        });
    });

    /* Product single page Comments tab empty state handling */
    function initCommentsEmptyState() {
        var tabComments = document.getElementById('tab-comments');
        if (!tabComments) return;

        function checkEmpty() {
            var hasList = tabComments.querySelector('.f-comments__item, .f-reviews-summary__bars');
            var hasEmpty = tabComments.querySelector('.f-comments__empty, .f-reviews-summary__empty');

            if (hasList) {
                tabComments.classList.remove('is-empty');
            } else if (hasEmpty) {
                tabComments.classList.add('is-empty');
            }
        }

        checkEmpty();
        if (window.MutationObserver) {
            var commentsObserver = new MutationObserver(checkEmpty);
            commentsObserver.observe(tabComments, { childList: true, subtree: true });
        }
    }
    initCommentsEmptyState();
    window.addEventListener('load', initCommentsEmptyState);

    /* Button icons for Add to cart (Cart icon) & Buy now (Wallet icon) in buy-box */
    var cartSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon btn-icon--cart" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
    var walletSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon btn-icon--wallet" aria-hidden="true"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>';

    function injectBuyBoxIcons() {
        document.querySelectorAll('.buy-box falak-add-product-button button').forEach(function (btn) {
            if (!btn.querySelector('.btn-icon--cart')) {
                btn.insertAdjacentHTML('afterbegin', cartSvg);
            }
        });
        document.querySelectorAll('.buy-box falak-quick-buy button').forEach(function (btn) {
            if (!btn.querySelector('.btn-icon--wallet')) {
                btn.insertAdjacentHTML('afterbegin', walletSvg);
            }
        });
    }

    injectBuyBoxIcons();
    window.addEventListener('load', injectBuyBoxIcons);

    var buyBoxEl = document.querySelector('.buy-box');
    if (buyBoxEl && window.MutationObserver) {
        var buyObserver = new MutationObserver(function () {
            injectBuyBoxIcons();
        });
        buyObserver.observe(buyBoxEl, { childList: true, subtree: true });
    }

    /* Search Modal "View all results for [query]" formatting */
    function updateSearchViewAll() {
        var modal = document.querySelector('#falak-search') || document.querySelector('falak-search');
        if (!modal) return;
        var input = modal.querySelector('.f-search__input') || document.querySelector('#falak-search .f-search__input');
        var viewAll = modal.querySelector('.f-search__view-all') || document.querySelector('#falak-search .f-search__view-all');
        if (!viewAll) return;
        var val = input ? input.value.trim() : '';
        var isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
        var chevron = isAr ? '‹' : '›';
        if (val) {
            var label = isAr ? ('عرض كل النتائج لـ "' + val + '" ' + chevron) : ('View all results for "' + val + '" ' + chevron);
            if (viewAll.textContent !== label) {
                viewAll.textContent = label;
            }
        }
    }

    document.addEventListener('input', function (e) {
        if (e.target && (e.target.matches('#falak-search .f-search__input, .f-search__input') || (e.target.classList && e.target.classList.contains('f-search__input')))) {
            updateSearchViewAll();
        }
    });

    if (window.MutationObserver) {
        var searchTarget = document.querySelector('#falak-search');
        if (searchTarget) {
            var searchObserver = new MutationObserver(function () {
                updateSearchViewAll();
            });
            searchObserver.observe(searchTarget, { childList: true, subtree: true });
        }
    }

    /* Product details enhancement: SKU, Detailed Description & Specifications */
    function enhanceProductSingle() {
        var productSingle = document.querySelector('.product-single');
        if (!productSingle) return;

        // 1. Check unit duplication on specs (if value already ends with kg / cm, hide the separate unit span)
        document.querySelectorAll('.product-specs__item').forEach(function (item) {
            var valEl = item.querySelector('[data-spec-val]');
            var unitEl = item.querySelector('[data-spec-unit]');
            if (!valEl || !unitEl) return;
            var text = valEl.textContent.trim().toLowerCase();
            if (!text) {
                item.hidden = true;
                return;
            }
            if (text.indexOf('kg') !== -1 || text.indexOf('كجم') !== -1 || text.indexOf('cm') !== -1 || text.indexOf('سم') !== -1) {
                unitEl.hidden = true;
            }
        });

        // 2. Fetch full product payload from storefront API if available, to fill any missing SKU, detailed description, or dimensions
        var idSource = productSingle.querySelector('[product-id]');
        var productId = idSource ? idSource.getAttribute('product-id') : null;
        if (!productId && window.location.pathname) {
            var match = window.location.pathname.match(/\/product(?:s)?\/([^\/?#]+)/);
            if (match) productId = match[1];
        }

        if (productId && window.falak && window.falak.product && typeof window.falak.product.show === 'function') {
            window.falak.product.show(productId).then(function (res) {
                var p = res && res.data ? res.data : res;
                if (!p) return;

                // Sync SKU
                var skuWrap = productSingle.querySelector('[data-product-sku]');
                var skuVal = productSingle.querySelector('[data-product-sku-value]');
                var sku = p.sku || p.code || (p.variants && p.variants[0] && p.variants[0].sku);
                if (skuWrap && skuVal) {
                    if (sku) {
                        skuVal.textContent = sku;
                        skuWrap.removeAttribute('hidden');
                    }
                }

                // Sync Detailed Description
                var detailedDescEl = productSingle.querySelector('[data-product-detailed-desc]');
                var detailed = p.detailed_description || p.detail_description || p.details || p.long_description || p.description_detail;
                if (detailedDescEl && detailed && detailed.trim() && detailed !== p.description) {
                    detailedDescEl.innerHTML = detailed;
                }

                // Sync Specifications (Weight, Height, Width, Length)
                var specsWrap = productSingle.querySelector('[data-product-specs]');
                var weight = p.weight || p.shipping_weight;
                var height = p.height || (p.dimensions && p.dimensions.height);
                var width = p.width || (p.dimensions && p.dimensions.width);
                var length = p.length || (p.dimensions && p.dimensions.length) || p.depth;

                var hasAny = false;
                function updateSpec(name, val) {
                    var item = productSingle.querySelector('[data-spec-item="' + name + '"]');
                    var span = productSingle.querySelector('[data-spec-val="' + name + '"]');
                    var unit = productSingle.querySelector('[data-spec-unit="' + name + '"]');
                    if (!item || !span) return;
                    if (val != null && String(val).trim() !== '' && String(val).trim() !== '0') {
                        var str = String(val).trim();
                        span.textContent = str;
                        item.removeAttribute('hidden');
                        hasAny = true;
                        if (unit) {
                            var lower = str.toLowerCase();
                            if (lower.indexOf('kg') !== -1 || lower.indexOf('كجم') !== -1 || lower.indexOf('cm') !== -1 || lower.indexOf('سم') !== -1) {
                                unit.hidden = true;
                            } else {
                                unit.removeAttribute('hidden');
                            }
                        }
                    }
                }

                updateSpec('weight', weight);
                updateSpec('height', height);
                updateSpec('width', width);
                updateSpec('length', length);

                if (hasAny && specsWrap) {
                    specsWrap.removeAttribute('hidden');
                }
            }).catch(function () { });
        }

        // 3. Variant change listener: update SKU dynamically if variant has a different SKU
        document.addEventListener('variant-change', function (e) {
            var variant = e.detail && (e.detail.variant || e.detail);
            if (variant && variant.sku) {
                var skuWrap = productSingle.querySelector('[data-product-sku]');
                var skuVal = productSingle.querySelector('[data-product-sku-value]');
                if (skuWrap && skuVal) {
                    skuVal.textContent = variant.sku;
                    skuWrap.removeAttribute('hidden');
                }
            }
        });

        // 4. Copy SKU button click handler
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-copy-sku]');
            if (!btn) return;
            var skuVal = productSingle.querySelector('[data-product-sku-value]');
            var text = skuVal ? skuVal.textContent.trim() : '';
            if (!text) return;
            var isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {
                    showToast(isAr ? 'تم نسخ رمز المنتج' : 'SKU copied to clipboard', 'success');
                }).catch(function () {
                    showToast(text, 'info');
                });
            }
        });
    }

    /* Customer area enhancements: dynamic theme-primary illustration hydration */
    function enhanceCustomerPages() {
        var accountEl = document.querySelector('.account');
        if (!accountEl) return;

        var PARCEL_SVG = '<svg class="empty-state__illustration" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M85 35 C145 20, 210 40, 215 95 C220 150, 160 175, 115 170 C70 165, 45 130, 50 85 C55 45, 60 40, 85 35 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 14%, #ffffff)" /><circle cx="48" cy="115" r="5" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, transparent)" stroke-width="2" fill="none" /><circle cx="56" cy="65" r="10" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="215" cy="48" r="8" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="68" cy="180" r="3.5" fill="#e59866" /><path d="M175 185 C190 190, 200 175, 210 180 C215 182, 222 175, 228 178" stroke="#e59866" stroke-width="1.8" stroke-dasharray="3 3" fill="none" /><circle cx="225" cy="160" r="11" fill="#e59866" /><path d="M221 156 L229 164 M229 156 L221 164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" /><g class="empty-state__parcel-group"><path d="M130 50 L195 85 L130 120 L65 85 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, #ffffff)" /><path d="M65 85 L130 120 V168 L65 133 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 65%, #ffffff)" /><path d="M130 120 L195 85 V133 L130 168 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 80%, #ffffff)" /><path d="M65 85 L130 120 L195 85 V133 L130 168 L65 133 Z" stroke="var(--color-primary, #ce5a67)" stroke-width="4" stroke-linejoin="round" /><path d="M130 120 V168" stroke="var(--color-primary, #ce5a67)" stroke-width="4" stroke-linejoin="round" /><polygon points="80,108 108,123 108,144 80,129" fill="#ffffff" /><line x1="86" y1="118" x2="102" y2="127" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 50%, #ffffff)" stroke-width="2.5" stroke-linecap="round" /><line x1="86" y1="125" x2="98" y2="132" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 50%, #ffffff)" stroke-width="2.5" stroke-linecap="round" /><path d="M97 68 L163 103" stroke="var(--color-primary, #ce5a67)" stroke-width="6" opacity="0.85" /><path d="M162 68 L98 103" stroke="var(--color-primary, #ce5a67)" stroke-width="6" opacity="0.85" /></g></svg>';
        var HEART_SVG = '<svg class="empty-state__illustration" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M85 35 C145 20, 210 40, 215 95 C220 150, 160 175, 115 170 C70 165, 45 130, 50 85 C55 45, 60 40, 85 35 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 14%, #ffffff)" /><circle cx="48" cy="115" r="5" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, transparent)" stroke-width="2" fill="none" /><circle cx="56" cy="65" r="10" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="215" cy="48" r="8" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="68" cy="180" r="3.5" fill="#e59866" /><path d="M175 185 C190 190, 200 175, 210 180 C215 182, 222 175, 228 178" stroke="#e59866" stroke-width="1.8" stroke-dasharray="3 3" fill="none" /><circle cx="225" cy="160" r="11" fill="#e59866" /><path d="M221 156 L229 164 M229 156 L221 164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" /><g class="empty-state__heart-group"><path d="M130 168 C130 168 62 125 62 82 C62 58 82 40 106 40 C120 40 128 48 130 52 C132 48 140 40 154 40 C178 40 198 58 198 82 C198 125 130 168 130 168 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 25%, #ffffff)" opacity="0.4" /><path d="M130 160 C130 160 68 120 68 80 C68 58 86 42 108 42 C121 42 127 50 130 54 C133 50 139 42 152 42 C174 42 192 58 192 80 C192 120 130 160 130 160 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 85%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="4.5" stroke-linejoin="round" /><path d="M88 64 C80 72 78 84 80 94" stroke="#ffffff" stroke-width="4" stroke-linecap="round" /><circle cx="88" cy="58" r="2.5" fill="#ffffff" /><path d="M185 45 L189 53 L197 57 L189 61 L185 69 L181 61 L173 57 L181 53 Z" fill="#e59866" /></g></svg>';
        var BELL_SVG = '<svg class="empty-state__illustration" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M85 35 C145 20, 210 40, 215 95 C220 150, 160 175, 115 170 C70 165, 45 130, 50 85 C55 45, 60 40, 85 35 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 14%, #ffffff)" /><circle cx="48" cy="115" r="5" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, transparent)" stroke-width="2" fill="none" /><circle cx="56" cy="65" r="10" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="215" cy="48" r="8" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="68" cy="180" r="3.5" fill="#e59866" /><path d="M175 185 C190 190, 200 175, 210 180 C215 182, 222 175, 228 178" stroke="#e59866" stroke-width="1.8" stroke-dasharray="3 3" fill="none" /><circle cx="225" cy="160" r="11" fill="#e59866" /><path d="M221 156 L229 164 M229 156 L221 164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" /><g class="empty-state__bell-group"><path d="M130 52 C108 52 92 68 92 98 C92 122 84 135 76 142 H184 C176 135 168 122 168 98 C168 68 152 52 130 52 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 75%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="4.5" stroke-linejoin="round" /><rect x="72" y="140" width="116" height="10" rx="5" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 45%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="3.5" /><circle cx="130" cy="158" r="12" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 85%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="3.5" /><path d="M124 52 V44 C124 40.7 126.7 38 130 38 C133.3 38 136 40.7 136 44 V52" stroke="var(--color-primary, #ce5a67)" stroke-width="4" stroke-linecap="round" /><path d="M72 82 C65 92 65 106 72 116" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 50%, transparent)" stroke-width="3" stroke-linecap="round" /><path d="M188 82 C195 92 195 106 188 116" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 50%, transparent)" stroke-width="3" stroke-linecap="round" /></g></svg>';
        var USER_SVG = '<svg class="empty-state__illustration" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M85 35 C145 20, 210 40, 215 95 C220 150, 160 175, 115 170 C70 165, 45 130, 50 85 C55 45, 60 40, 85 35 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 14%, #ffffff)" /><circle cx="48" cy="115" r="5" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, transparent)" stroke-width="2" fill="none" /><circle cx="56" cy="65" r="10" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="215" cy="48" r="8" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="68" cy="180" r="3.5" fill="#e59866" /><path d="M175 185 C190 190, 200 175, 210 180 C215 182, 222 175, 228 178" stroke="#e59866" stroke-width="1.8" stroke-dasharray="3 3" fill="none" /><circle cx="225" cy="160" r="11" fill="#e59866" /><path d="M221 156 L229 164 M229 156 L221 164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" /><g class="empty-state__user-group"><circle cx="130" cy="110" r="52" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 75%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="4.5" /><circle cx="130" cy="94" r="20" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 25%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="3" /><path d="M96 145 C96 126 111 120 130 120 C149 120 164 126 164 145" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, #ffffff)" stroke="var(--color-primary, #ce5a67)" stroke-width="3" stroke-linecap="round" /></g></svg>';

        function upgradeIcons() {
            // Check placeholders
            accountEl.querySelectorAll('.f-placeholder, .f-orders__empty, falak-placeholder').forEach(function (ph) {
                var iconEl = ph.querySelector('.f-placeholder__icon');
                if (iconEl && !iconEl.querySelector('svg')) {
                    var txt = (iconEl.textContent || '').trim();
                    if (txt === '📦' || ph.closest('falak-orders') || ph.closest('.f-orders')) {
                        iconEl.innerHTML = PARCEL_SVG;
                        iconEl.classList.add('empty-state__icon-wrap');
                    } else if (txt === '♡' || ph.closest('.account-page--wishlist')) {
                        iconEl.innerHTML = HEART_SVG;
                        iconEl.classList.add('empty-state__icon-wrap');
                    } else if (txt === '🔔' || ph.closest('.account-page--notifications')) {
                        iconEl.innerHTML = BELL_SVG;
                        iconEl.classList.add('empty-state__icon-wrap');
                    } else if (txt === '👤' || ph.closest('falak-user-profile')) {
                        iconEl.innerHTML = USER_SVG;
                        iconEl.classList.add('empty-state__icon-wrap');
                    }
                }
            });

            // Check standard empty-states
            accountEl.querySelectorAll('.empty-state__icon').forEach(function (iconEl) {
                if (!iconEl.querySelector('svg')) {
                    var txt = (iconEl.textContent || '').trim();
                    if (txt === '👤') {
                        iconEl.innerHTML = USER_SVG;
                        iconEl.classList.add('empty-state__icon-wrap');
                    }
                }
            });
        }

        upgradeIcons();

        if (window.MutationObserver) {
            var custObserver = new MutationObserver(function () {
                upgradeIcons();
            });
            custObserver.observe(accountEl, { childList: true, subtree: true });
        }
    }

    /* Cart page enhancements: hide page-head when empty and hydrate theme-primary cart SVG */
    function enhanceCartPage() {
        var cartEl = document.querySelector('[data-cart-page]');
        if (!cartEl) return;

        var CART_SVG = '<svg class="empty-state__illustration" viewBox="0 0 260 200" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M85 35 C145 20, 210 40, 215 95 C220 150, 160 175, 115 170 C70 165, 45 130, 50 85 C55 45, 60 40, 85 35 Z" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 14%, #ffffff)" /><circle cx="48" cy="115" r="5" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 35%, transparent)" stroke-width="2" fill="none" /><circle cx="56" cy="65" r="10" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="215" cy="48" r="8" stroke="color-mix(in srgb, var(--color-primary, #ce5a67) 30%, transparent)" stroke-width="2" fill="none" /><circle cx="68" cy="180" r="3.5" fill="#e59866" /><path d="M175 185 C190 190, 200 175, 210 180 C215 182, 222 175, 228 178" stroke="#e59866" stroke-width="1.8" stroke-dasharray="3 3" fill="none" /><circle cx="225" cy="160" r="11" fill="#e59866" /><path d="M221 156 L229 164 M229 156 L221 164" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" /><g class="empty-state__cart-group"><path d="M68 76 H78 L92 142 C93 147, 97 150, 102 150 H184 C189 150, 193 147, 194 142 L206 95 H83" stroke="var(--color-primary, #ce5a67)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.2" /><path d="M68 76 H78 L92 142 C93 147, 97 150, 102 150 H184 C189 150, 193 147, 194 142 L206 95 H83" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 38%, #ffffff)" /><rect x="106" y="104" width="46" height="6.5" rx="3.25" fill="#ffffff" /><rect x="112" y="120" width="46" height="6.5" rx="3.25" fill="#ffffff" /><circle cx="112" cy="165" r="13" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 42%, #ffffff)" /><circle cx="174" cy="165" r="13" fill="color-mix(in srgb, var(--color-primary, #ce5a67) 42%, #ffffff)" /><circle cx="196" cy="90" r="19" fill="var(--color-primary, #ce5a67)" /><path d="M189 83 L203 97 M203 83 L189 97" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" /></g></svg>';

        function checkCart() {
            var emptyEl = cartEl.querySelector('.empty-state, .f-placeholder, [data-cart-empty]');
            var pageHead = cartEl.querySelector('.page-head');
            if (emptyEl && pageHead) {
                pageHead.style.display = 'none';
            }

            var ph = cartEl.querySelector('.f-placeholder');
            if (ph) {
                var iconEl = ph.querySelector('.f-placeholder__icon');
                if (iconEl && !iconEl.querySelector('svg')) {
                    iconEl.innerHTML = CART_SVG;
                    iconEl.classList.add('empty-state__icon-wrap');
                }
            }
        }

        checkCart();

        if (window.MutationObserver) {
            var cartObs = new MutationObserver(function () {
                checkCart();
            });
            cartObs.observe(cartEl, { childList: true, subtree: true });
        }
    }

    enhanceProductSingle();
    enhanceCustomerPages();
    enhanceCartPage();
})();


