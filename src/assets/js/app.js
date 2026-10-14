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

    if (currentLang) {
        document.querySelectorAll('a[href]').forEach(function (link) {
            var href = link.getAttribute('href');

            if (!href || href.charAt(0) !== '/' || link.hasAttribute('data-set-lang')) return;

            var url = new URL(href, window.location.origin);
            url.searchParams.set('lang', currentLang);
            link.setAttribute('href', url.pathname + url.search + url.hash);
        });
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
        var searchObserver = new MutationObserver(function () {
            updateSearchViewAll();
        });
        var searchTarget = document.querySelector('#falak-search') || document.body;
        if (searchTarget) {
            searchObserver.observe(searchTarget, { childList: true, subtree: true });
        }
    }
})();
