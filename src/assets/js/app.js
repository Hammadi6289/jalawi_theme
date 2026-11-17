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
    // sticky `top` equal to their height. On small scroll the bar turns to frosted
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
            stickyHeader.classList.toggle('is-scrolled', window.scrollY > 20);
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
                if (actions.closest('[data-wishlist-grid]') || actions.closest('.wishlist-grid')) return; // wishlist cards stay clean

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
                    if (productId) {
                        qvBtn.setAttribute('data-quick-view', productId);
                        var nameEl = card.querySelector('.f-card__title, .f-card__name');
                        if (nameEl) qvBtn.setAttribute('data-quick-view-name', (nameEl.textContent || '').trim());
                        var imgEl = card.querySelector('img');
                        if (imgEl && imgEl.src) qvBtn.setAttribute('data-quick-view-image', imgEl.src);
                    }
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

        // Wishlist card removal handler
        document.addEventListener('click', function (event) {
            var btn = event.target.closest('[data-wishlist-remove]');
            if (!btn) return;
            event.preventDefault();
            event.stopPropagation();

            var card = btn.closest('.product-card') || btn.closest('[data-product-id]') || btn.closest('.f-card');
            var productId = btn.getAttribute('data-wishlist-remove') || (card && card.getAttribute('data-product-id'));
            if (!productId || btn.disabled) return;

            btn.disabled = true;
            btn.style.opacity = '0.5';

            function removeCardFromDom() {
                if (!card) return;
                card.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                card.style.opacity = '0';
                card.style.transform = 'scale(0.92)';
                setTimeout(function () {
                    var grid = card.closest('[data-wishlist-grid]') || card.parentElement;
                    card.remove();
                    if (grid) {
                        var remaining = grid.querySelectorAll('.product-card, .f-card, [data-product-id]');
                        var countEl = document.querySelector('.page-head__meta');
                        if (countEl) {
                            countEl.textContent = remaining.length + ' item(s)';
                        }
                        if (remaining.length === 0) {
                            var emptyState = document.querySelector('[data-wishlist-empty]');
                            if (emptyState) emptyState.style.display = 'block';
                            grid.style.display = 'none';
                            if (countEl) countEl.style.display = 'none';
                        }
                    }
                }, 250);
            }

            if (window.falak && window.falak.wishlist && typeof window.falak.wishlist.remove === 'function') {
                window.falak.wishlist.remove(productId)
                    .then(removeCardFromDom)
                    .catch(function (err) {
                        console.warn('Wishlist remove error:', err);
                        removeCardFromDom();
                    });
            } else {
                removeCardFromDom();
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

    /* Search Modal "View all results for [query]" formatting & Mobile Cancel button */
    function enhanceSearchModal() {
        var modal = document.querySelector('#falak-search') || document.querySelector('falak-search');
        if (!modal) return;

        // 1. Inject cancel icon button on mobile into .f-search__form if not present
        var form = modal.querySelector('.f-search__form');
        if (form && !form.querySelector('.f-search__cancel-btn')) {
            var isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
            var cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'f-search__cancel-btn';
            cancelBtn.setAttribute('aria-label', isAr ? 'إلغاء' : 'Cancel');
            cancelBtn.innerHTML = '<svg class="f-search__cancel-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

            cancelBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();

                var closeBtn = modal.querySelector('.f-modal__close');
                if (closeBtn) {
                    closeBtn.click();
                    return;
                }
                var overlay = modal.querySelector('.f-modal__overlay');
                if (overlay) {
                    overlay.click();
                    return;
                }
                if (typeof modal.close === 'function') {
                    modal.close();
                    return;
                }
                modal.classList.remove('is-open', 'f-modal--open');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                document.body.classList.remove('f-modal-open', 'modal-open');
            });
            form.appendChild(cancelBtn);
        }

        // 2. Format view all link
        var input = modal.querySelector('.f-search__input') || document.querySelector('#falak-search .f-search__input');
        var viewAll = modal.querySelector('.f-search__view-all') || document.querySelector('#falak-search .f-search__view-all');
        if (!viewAll) return;
        var val = input ? input.value.trim() : '';
        var isArLang = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
        var chevron = isArLang ? '‹' : '›';
        if (val) {
            var label = isArLang ? ('عرض كل النتائج لـ "' + val + '" ' + chevron) : ('View all results for "' + val + '" ' + chevron);
            if (viewAll.textContent !== label) {
                viewAll.textContent = label;
            }
        }
    }

    document.addEventListener('input', function (e) {
        if (e.target && (e.target.matches('#falak-search .f-search__input, .f-search__input') || (e.target.classList && e.target.classList.contains('f-search__input')))) {
            enhanceSearchModal();
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target && e.target.closest('.search-link, [data-search-trigger], falak-search, .f-search__trigger')) {
            setTimeout(enhanceSearchModal, 50);
            setTimeout(enhanceSearchModal, 200);
        }
    });

    if (window.MutationObserver) {
        var searchTarget = document.querySelector('#falak-search');
        if (searchTarget) {
            var searchObserver = new MutationObserver(function () {
                enhanceSearchModal();
            });
            searchObserver.observe(searchTarget, { childList: true, subtree: true });
        }
        // Also watch body for when falak-search modal is mounted dynamically
        new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
                    var m = document.querySelector('#falak-search, falak-search');
                    if (m) {
                        enhanceSearchModal();
                        break;
                    }
                }
            }
        }).observe(document.body, { childList: true });
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

                // Sync Product URL / Link
                var copyLinkBtn = productSingle.querySelector('[data-copy-link], [data-copy-slug]');
                if (copyLinkBtn) {
                    if (p.url) {
                        copyLinkBtn.setAttribute('data-copy-url', p.url);
                    } else if (p.slug) {
                        copyLinkBtn.setAttribute('data-copy-url', '/product/' + p.slug);
                        copyLinkBtn.setAttribute('data-copy-slug', p.slug);
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

        // 5. Copy Product URL / Link button click handler
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-copy-link], [data-copy-slug]');
            if (!btn) return;

            var copyUrl = btn.getAttribute('data-copy-url');
            if (!copyUrl || copyUrl === '/') {
                copyUrl = window.location.href;
            } else if (copyUrl.indexOf('http://') !== 0 && copyUrl.indexOf('https://') !== 0) {
                var origin = window.location.origin || (window.location.protocol + '//' + window.location.host);
                copyUrl = origin + (copyUrl.indexOf('/') === 0 ? '' : '/') + copyUrl;
            }

            var textSpan = btn.querySelector('[data-copy-text]');
            var defaultText = textSpan ? (textSpan.getAttribute('data-label-copy') || textSpan.textContent) : '';
            var copiedText = textSpan ? (textSpan.getAttribute('data-label-copied') || 'Copied') : 'Copied';

            function copyFallback(str) {
                try {
                    var el = document.createElement('textarea');
                    el.value = str;
                    el.setAttribute('readonly', '');
                    el.style.position = 'fixed';
                    el.style.left = '-9999px';
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    return true;
                } catch (err) {
                    return false;
                }
            }

            function onCopied() {
                btn.classList.add('is-copied');
                if (textSpan) textSpan.textContent = copiedText;
                var isAr = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';
                if (typeof showToast === 'function') {
                    showToast(isAr ? 'تم نسخ رابط المنتج إلى الحافظة' : 'Product link copied to clipboard', 'success');
                }
                setTimeout(function () {
                    btn.classList.remove('is-copied');
                    if (textSpan) textSpan.textContent = defaultText;
                }, 2000);
            }

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(copyUrl).then(onCopied).catch(function () {
                    if (copyFallback(copyUrl)) onCopied();
                });
            } else {
                if (copyFallback(copyUrl)) onCopied();
            }
        });
    }

    /* Categories bar desktop overflow dropdown handler */
    function initCategoriesBar() {
        var catBar = document.querySelector('[data-cat-bar]');
        if (!catBar) return;

        var moreWrap = catBar.querySelector('[data-cat-more]');
        var moreBtn = catBar.querySelector('[data-cat-more-btn]');
        var dropdown = catBar.querySelector('[data-cat-dropdown]');
        if (!moreWrap || !moreBtn || !dropdown) return;

        moreBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var isOpen = moreWrap.classList.toggle('is-open');
            moreBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && moreWrap.classList.contains('is-open')) {
                moreWrap.classList.remove('is-open');
                moreBtn.setAttribute('aria-expanded', 'false');
                moreBtn.focus();
            }
        });

        document.addEventListener('click', function (e) {
            if (!moreWrap.contains(e.target)) {
                moreWrap.classList.remove('is-open');
                moreBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /* Newsletter dashboard dynamic data hydration */
    function enhanceNewsletter() {
        var storeSettings = (window.falak && window.falak.store && window.falak.store.settings) || (window.store && window.store.settings);
        if (!storeSettings) return;

        var nl = storeSettings.newsletter || {};
        var isEnabled = storeSettings.newsletter_enabled !== undefined ? storeSettings.newsletter_enabled : nl.enabled;
        if (isEnabled === false) {
            document.querySelectorAll('.block--newsletter, .site-footer__newsletter').forEach(function (el) {
                if (!document.body.classList.contains('is-editor') && !window.falakEditor) {
                    el.hidden = true;
                }
            });
            return;
        }

        var title = storeSettings.newsletter_title || nl.title;
        var subtitle = storeSettings.newsletter_description || storeSettings.newsletter_subtitle || nl.description || nl.subtitle;

        if (title) {
            document.querySelectorAll('.block--newsletter .block__title, .site-footer__newsletter-title').forEach(function (el) {
                if (!el.textContent.trim()) {
                    el.textContent = title;
                }
            });
        }

        if (subtitle) {
            document.querySelectorAll('.block--newsletter .block__subtitle, .site-footer__newsletter-desc').forEach(function (el) {
                if (!el.textContent.trim()) {
                    el.textContent = subtitle;
                }
            });
        }
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
    initCategoriesBar();
    enhanceNewsletter();

    /* ------------------------------------------------ video commerce */
    // Reads from [data-video-commerce] sections. Each section declares:
    //   data-limit      how many products to pull (default 4)
    //   data-badge      pill text (empty string = hidden)
    //   data-playback   "inview" | "hover"
    //   data-actions    "1" = render cart + wishlist buttons
    //
    // Endpoint: GET /api/storefront/videoCommerceProducts returns products
    // flagged with `is_video_commerce` in the store dashboard.
    //
    // Clicking product name goes to /product/:id.
    // Clicking video/image opens the fullscreen overlay carousel slider (matching overlay.png).
    // Overlay features: white circular sound toggle (top-start), close (top-end),
    // next/prev arrows, adjacent dimmed preview cards, and bottom buy action.

    function videoCommerce() {
        function isCustomizerEditor(sec) {
            var inIframe = false;
            try {
                inIframe = (window.self !== window.top);
            } catch (e) {
                inIframe = true;
            }
            if (!inIframe) return false;

            if (sec && sec.getAttribute('data-preview') === '1') return true;
            if (window.falak && (window.falak.isEditor || window.falak.editor)) return true;
            if (document.querySelector('[data-falak-editor]') || document.body.hasAttribute('data-falak-editor')) return true;
            if (window.location.search && /[?&](customizer|theme_editor|editor_mode)\b/i.test(window.location.search)) return true;

            try {
                if (window.parent && window.parent !== window && window.parent.document) {
                    if (window.parent.document.querySelector('.customizer, [data-customizer], .theme-editor, .falak-editor')) {
                        return true;
                    }
                }
            } catch (e) { }

            return false;
        }

        var SOUND_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>';
        var SOUND_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>';
        var CHEVRON_LEFT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        var CHEVRON_RIGHT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        var CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        var HEART_ICON = '<svg class="vc-heart-icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

        function escHtml(str) {
            return String(str == null ? '' : str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }

        function formatMoney(amount, currency) {
            if (window.falak && typeof window.falak.money === 'function') {
                return window.falak.money(amount, currency);
            }
            var num = Number(amount);
            var formatted = Number.isFinite(num) ? num.toFixed(2) : String(amount);
            return currency ? (formatted + ' ' + currency) : formatted;
        }

        /* --------------------------- Overlay modal & slider state --------------------------- */
        var overlayEl = null;
        var overlayIndex = 0;
        var overlayProducts = [];
        var isMuted = true; // start muted per browser autoplay policy
        var mobileObserver = null;

        function ensureWishlistHearts(container) {
            if (!container) return;
            var hosts = container.querySelectorAll('falak-wishlist-button');
            hosts.forEach(function (host) {
                var btn = host.querySelector('button');
                if (!btn) {
                    btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = host.closest('.vc-overlay__actions')
                        ? 'btn btn--card-icon vc-overlay__wishlist-btn'
                        : 'btn btn--card-icon vc-card__wishlist-btn';
                    btn.setAttribute('aria-label', 'Wishlist');
                    host.appendChild(btn);
                }
                var svg = btn.querySelector('svg');
                if (!svg || !svg.querySelector('path')) {
                    btn.innerHTML = HEART_ICON;
                } else {
                    svg.classList.add('vc-heart-icon');
                    svg.setAttribute('viewBox', '0 0 24 24');
                    svg.setAttribute('width', host.closest('.vc-overlay__actions') ? '22' : '20');
                    svg.setAttribute('height', host.closest('.vc-overlay__actions') ? '22' : '20');
                    svg.style.stroke = btn.classList.contains('is-added') ? '#ff4d6d' : '#ffffff';
                    svg.style.strokeWidth = '2px';
                    svg.style.fill = btn.classList.contains('is-added') ? '#ff4d6d' : 'none';
                    svg.style.display = 'block';
                }
            });
        }

        function ensureOverlay() {
            if (overlayEl) return overlayEl;

            overlayEl = document.createElement('div');
            overlayEl.className = 'vc-overlay';
            overlayEl.id = 'vc-overlay';
            overlayEl.setAttribute('role', 'dialog');
            overlayEl.setAttribute('aria-modal', 'true');
            overlayEl.setAttribute('aria-hidden', 'true');

            var isRtl = document.documentElement.dir === 'rtl';

            overlayEl.innerHTML =
                '<div class="vc-overlay__backdrop" data-vc-close></div>' +
                '<div class="vc-overlay__top-bar">' +
                '<button type="button" class="vc-overlay__chip vc-overlay__chip--sound" data-vc-sound aria-label="Toggle sound">' +
                (isMuted ? SOUND_OFF : SOUND_ON) +
                '</button>' +
                '<button type="button" class="vc-overlay__chip vc-overlay__chip--close" data-vc-close aria-label="Close">' +
                CLOSE_ICON +
                '</button>' +
                '</div>' +
                '<div class="vc-overlay__stage">' +
                '<button type="button" class="vc-overlay__arrow vc-overlay__arrow--prev" data-vc-prev aria-label="Previous">' +
                (isRtl ? CHEVRON_RIGHT : CHEVRON_LEFT) +
                '</button>' +
                '<div class="vc-overlay__reel" data-vc-reel></div>' +
                '<button type="button" class="vc-overlay__arrow vc-overlay__arrow--next" data-vc-next aria-label="Next">' +
                (isRtl ? CHEVRON_LEFT : CHEVRON_RIGHT) +
                '</button>' +
                '</div>';

            document.body.appendChild(overlayEl);

            overlayEl.addEventListener('click', function (e) {
                if (
                    e.target.closest('[data-vc-close]') ||
                    e.target === overlayEl ||
                    e.target.classList.contains('vc-overlay__backdrop') ||
                    e.target.classList.contains('vc-overlay__stage') ||
                    e.target.classList.contains('vc-overlay__reel')
                ) {
                    closeOverlay();
                    return;
                }
                if (e.target.closest('[data-vc-prev]')) {
                    goToSlide(overlayIndex - 1);
                    return;
                }
                if (e.target.closest('[data-vc-next]')) {
                    goToSlide(overlayIndex + 1);
                    return;
                }
                if (e.target.closest('[data-vc-sound]')) {
                    toggleSound();
                    return;
                }
                var clickedSlide = e.target.closest('.vc-overlay__slide');
                if (clickedSlide && !clickedSlide.classList.contains('is-active') && window.innerWidth > 767) {
                    var idx = parseInt(clickedSlide.getAttribute('data-index'), 10);
                    if (!isNaN(idx)) goToSlide(idx);
                }
            });

            document.addEventListener('keydown', function (e) {
                if (!overlayEl || !overlayEl.classList.contains('is-open')) return;
                if (e.key === 'Escape') {
                    closeOverlay();
                } else if (e.key === 'ArrowLeft') {
                    document.documentElement.dir === 'rtl' ? goToSlide(overlayIndex + 1) : goToSlide(overlayIndex - 1);
                } else if (e.key === 'ArrowRight') {
                    document.documentElement.dir === 'rtl' ? goToSlide(overlayIndex - 1) : goToSlide(overlayIndex + 1);
                } else if (e.key === 'ArrowUp') {
                    goToSlide(overlayIndex - 1);
                } else if (e.key === 'ArrowDown') {
                    goToSlide(overlayIndex + 1);
                }
            });

            return overlayEl;
        }

        function renderOverlaySlides() {
            var reel = overlayEl.querySelector('[data-vc-reel]');
            if (!reel) return;

            reel.innerHTML = '';
            var isAr = document.documentElement.dir === 'rtl' || (window.falak && window.falak.lang && window.falak.lang.locale === 'ar');

            overlayProducts.forEach(function (product, i) {
                var clip = product.video_url || product.clip_url || product.video || '';
                var poster = product.video_thumbnail_url || (product.images && product.images[0] && product.images[0].url) || product.image_url || product.image || '';
                var name = (isAr && product.name_ar) ? product.name_ar : (product.name || product.title || '');
                var href = '/product/' + encodeURIComponent(product.id);
                var priceHtml = '';

                var priceCents = product.price !== undefined ? product.price : (product.price_cents !== undefined ? product.price_cents : null);
                var saleCents = product.discount_price !== undefined ? product.discount_price : (product.discount_price_cents !== undefined ? product.discount_price_cents : null);
                var curr = product.currency || '';

                if (priceCents !== null && priceCents !== '') {
                    var pNum = Number(priceCents);
                    var sNum = Number(saleCents);
                    if (saleCents !== null && Number.isFinite(sNum) && sNum > 0 && sNum < pNum) {
                        priceHtml = '<div class="vc-overlay__price"><strong>' + escHtml(formatMoney(sNum, curr)) + '</strong> <del>' + escHtml(formatMoney(pNum, curr)) + '</del></div>';
                    } else {
                        priceHtml = '<div class="vc-overlay__price"><strong>' + escHtml(formatMoney(pNum, curr)) + '</strong></div>';
                    }
                }

                var slide = document.createElement('div');
                slide.className = 'vc-overlay__slide';
                slide.setAttribute('data-index', String(i));

                var videoTag = clip
                    ? '<video class="vc-overlay__video" src="' + escHtml(clip) + '" poster="' + escHtml(poster) + '" playsinline loop muted preload="auto"></video>'
                    : '<img class="vc-overlay__video" src="' + escHtml(poster) + '" alt="" loading="lazy">';

                slide.innerHTML =
                    '<div class="vc-overlay__media">' + videoTag + '</div>' +
                    '<div class="vc-overlay__scrim"></div>' +
                    '<div class="vc-overlay__info">' +
                    '<a class="vc-overlay__name" href="' + escHtml(href) + '">' + escHtml(name) + '</a>' +
                    priceHtml +
                    '<div class="vc-overlay__actions">' +
                    '<falak-add-product-button product-id="' + escHtml(product.id) + '" button-class="btn btn--primary vc-overlay__add-btn"></falak-add-product-button>' +
                    '<falak-wishlist-button product-id="' + escHtml(product.id) + '" button-class="btn btn--card-icon vc-overlay__wishlist-btn"></falak-wishlist-button>' +
                    '</div>' +
                    '</div>';

                reel.appendChild(slide);
            });

            // Show or hide arrows if only 1 product on desktop
            var prevBtn = overlayEl.querySelector('[data-vc-prev]');
            var nextBtn = overlayEl.querySelector('[data-vc-next]');
            if (prevBtn && nextBtn) {
                var hasMultiple = overlayProducts.length > 1;
                prevBtn.style.display = hasMultiple ? 'flex' : 'none';
                nextBtn.style.display = hasMultiple ? 'flex' : 'none';
            }
        }

        function setupMobileScrollObserver() {
            if (mobileObserver) {
                mobileObserver.disconnect();
                mobileObserver = null;
            }
            var reel = overlayEl.querySelector('[data-vc-reel]');
            if (!reel) return;

            mobileObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.55) {
                        var idx = parseInt(entry.target.getAttribute('data-index'), 10);
                        if (!isNaN(idx) && idx !== overlayIndex) {
                            overlayIndex = idx;
                            playActiveSlide(idx);
                        }
                    }
                });
            }, {
                root: reel,
                threshold: 0.55
            });

            var slides = reel.querySelectorAll('.vc-overlay__slide');
            slides.forEach(function (s) {
                mobileObserver.observe(s);
            });
        }

        function playActiveSlide(idx) {
            var slides = overlayEl.querySelectorAll('.vc-overlay__slide');
            var isDesktop = window.innerWidth > 767;
            var count = slides.length;
            if (!count) return;

            var prevIdx = (idx - 1 + count) % count;
            var nextIdx = (idx + 1) % count;

            slides.forEach(function (slide, i) {
                var vid = slide.querySelector('video');
                if (i === idx) {
                    slide.classList.add('is-active');
                    slide.classList.remove('is-prev', 'is-next');
                    if (vid) {
                        vid.muted = isMuted;
                        var p = vid.play();
                        if (p && p.catch) p.catch(function () { });
                    }
                    ensureWishlistHearts(slide);
                } else {
                    slide.classList.remove('is-active');
                    if (isDesktop) {
                        if (count > 1 && i === prevIdx) {
                            slide.classList.add('is-prev');
                            slide.classList.remove('is-next');
                        } else if (count > 1 && i === nextIdx) {
                            slide.classList.add('is-next');
                            slide.classList.remove('is-prev');
                        } else {
                            slide.classList.remove('is-prev', 'is-next');
                        }
                    } else {
                        slide.classList.remove('is-prev', 'is-next');
                    }
                    if (vid) {
                        vid.pause();
                        vid.currentTime = 0;
                    }
                }
            });

            updateSoundButtons();
        }

        function updateSlideClasses() {
            playActiveSlide(overlayIndex);
        }

        function updateSoundButtons() {
            if (!overlayEl) return;
            var soundBtns = overlayEl.querySelectorAll('[data-vc-sound]');
            soundBtns.forEach(function (btn) {
                btn.innerHTML = isMuted ? SOUND_OFF : SOUND_ON;
                btn.setAttribute('aria-label', isMuted ? 'Unmute' : 'Mute');
            });
        }

        function toggleSound() {
            isMuted = !isMuted;
            var activeSlide = overlayEl.querySelector('.vc-overlay__slide.is-active');
            if (activeSlide) {
                var vid = activeSlide.querySelector('video');
                if (vid) vid.muted = isMuted;
            }
            updateSoundButtons();
        }

        function goToSlide(newIdx) {
            var count = overlayProducts.length;
            if (!count) return;
            overlayIndex = (newIdx + count) % count;

            if (window.innerWidth <= 767) {
                var reel = overlayEl.querySelector('[data-vc-reel]');
                var slides = reel ? reel.querySelectorAll('.vc-overlay__slide') : [];
                if (slides[overlayIndex]) {
                    slides[overlayIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                updateSlideClasses();
            }
        }

        function openOverlay(startIndex, products) {
            ensureOverlay();
            if (products && products.length) {
                overlayProducts = products;
            }
            if (!overlayProducts || !overlayProducts.length) return;

            overlayIndex = Math.max(0, Math.min(startIndex || 0, overlayProducts.length - 1));

            // Pause all preview videos on the page
            document.querySelectorAll('.vc-card video').forEach(function (v) {
                try { v.pause(); } catch (e) { }
            });

            renderOverlaySlides();

            overlayEl.classList.add('is-open');
            overlayEl.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';

            var isMobile = window.innerWidth <= 767;

            if (isMobile) {
                requestAnimationFrame(function () {
                    var reel = overlayEl.querySelector('[data-vc-reel]');
                    var slides = reel ? reel.querySelectorAll('.vc-overlay__slide') : [];
                    if (slides[overlayIndex]) {
                        slides[overlayIndex].scrollIntoView({ behavior: 'instant', block: 'start' });
                    }
                    setupMobileScrollObserver();
                });
            }

            playActiveSlide(overlayIndex);

            ensureWishlistHearts(overlayEl);
            setTimeout(function () { ensureWishlistHearts(overlayEl); }, 100);
            setTimeout(function () { ensureWishlistHearts(overlayEl); }, 350);
        }

        function closeOverlay() {
            if (!overlayEl) return;
            if (mobileObserver) {
                mobileObserver.disconnect();
                mobileObserver = null;
            }
            overlayEl.classList.remove('is-open');
            overlayEl.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';

            // Pause and reset all overlay videos
            overlayEl.querySelectorAll('video').forEach(function (v) {
                try {
                    v.pause();
                    v.currentTime = 0;
                } catch (e) { }
            });

            // Remove active classes
            overlayEl.querySelectorAll('.vc-overlay__slide').forEach(function (s) {
                s.classList.remove('is-active', 'is-prev', 'is-next');
            });

            // Empty the reel so no old slides or videos linger in memory
            var reel = overlayEl.querySelector('[data-vc-reel]');
            if (reel) reel.innerHTML = '';
        }

        /* --------------------------- Grid Card Builder --------------------------- */
        function buildCard(product, section, index, allProductsList) {
            var badge = section.getAttribute('data-badge') || '';
            var actions = section.getAttribute('data-actions') === '1';
            var clip = product.video_url || product.clip_url || product.video || '';
            var poster = product.video_thumbnail_url || (product.images && product.images[0] && product.images[0].url) || product.image_url || product.image || '';
            var isAr = document.documentElement.dir === 'rtl' || (window.falak && window.falak.lang && window.falak.lang.locale === 'ar');
            var name = (isAr && product.name_ar) ? product.name_ar : (product.name || product.title || '');
            var href = '/product/' + encodeURIComponent(product.id);
            var priceHtml = '';

            var priceCents = product.price !== undefined ? product.price : (product.price_cents !== undefined ? product.price_cents : null);
            var saleCents = product.discount_price !== undefined ? product.discount_price : (product.discount_price_cents !== undefined ? product.discount_price_cents : null);
            var curr = product.currency || '';

            if (priceCents !== null && priceCents !== '') {
                var pNum = Number(priceCents);
                var sNum = Number(saleCents);
                if (saleCents !== null && Number.isFinite(sNum) && sNum > 0 && sNum < pNum) {
                    priceHtml = '<span class="vc-card__price"><strong>' + escHtml(formatMoney(sNum, curr)) + '</strong> <del>' + escHtml(formatMoney(pNum, curr)) + '</del></span>';
                } else {
                    priceHtml = '<span class="vc-card__price"><strong>' + escHtml(formatMoney(pNum, curr)) + '</strong></span>';
                }
            }

            var actionsHtml = '';
            if (actions) {
                actionsHtml = '<div class="vc-card__actions">' +
                    '<falak-add-product-button product-id="' + escHtml(product.id) + '" button-class="btn btn--primary btn--card-add" button-size="sm"></falak-add-product-button>' +
                    '<falak-wishlist-button product-id="' + escHtml(product.id) + '" button-class="btn btn--card-icon vc-card__wishlist-btn"></falak-wishlist-button>' +
                    '</div>';
            }

            var badgeHtml = badge
                ? '<span class="vc-card__badge">' + escHtml(badge) + '</span>'
                : '';

            var videoEl = clip
                ? '<video class="vc-card__video" src="' + escHtml(clip) + '" poster="' + escHtml(poster) + '" muted playsinline preload="none" loop disablepictureinpicture aria-hidden="true" tabindex="-1"></video>'
                : '<img class="vc-card__video" src="' + escHtml(poster) + '" alt="" loading="lazy">';

            var li = document.createElement('li');
            li.className = 'vc-card';
            li.setAttribute('data-vc-card', '');
            li.setAttribute('data-vc-index', String(index));
            li.innerHTML =
                videoEl +
                '<div class="vc-card__scrim" aria-hidden="true"></div>' +
                badgeHtml +
                '<div class="vc-card__info">' +
                '<a class="vc-card__name" href="' + escHtml(href) + '">' + escHtml(name) + '</a>' +
                priceHtml +
                actionsHtml +
                '</div>';

            // Clicking title or actions lets those actions execute.
            // Clicking the image/video/card surface opens the fullscreen overlay slider!
            li.addEventListener('click', function (e) {
                if (e.target.closest('a')) return; // Go to product page
                if (e.target.closest('button, falak-add-product-button, falak-wishlist-button')) return; // Action buttons
                e.preventDefault();
                openOverlay(index, allProductsList);
            });

            // Ensure wishlist icon is injected if the SDK renders an empty button
            ensureWishlistHearts(li);
            setTimeout(function () {
                ensureWishlistHearts(li);
            }, 180);

            return li;
        }

        // Delegated click listener on document as a safety fallback for any dynamic card clicks
        document.addEventListener('click', function (e) {
            var card = e.target.closest('.vc-card');
            if (!card) return;
            if (e.target.closest('a, button, falak-add-product-button, falak-wishlist-button')) return;
            var idx = parseInt(card.getAttribute('data-vc-index'), 10);
            if (!isNaN(idx) && overlayProducts && overlayProducts.length) {
                e.preventDefault();
                openOverlay(idx, overlayProducts);
            }
        });

        function wireCard(li, playback) {
            var video = li.querySelector('.vc-card__video');
            if (!video || video.tagName !== 'VIDEO') return;

            function play() {
                var p = video.play();
                if (p && p.catch) p.catch(function () { });
                li.classList.add('is-playing');
            }
            function pause() {
                video.pause();
                li.classList.remove('is-playing');
            }

            var isMobile = window.matchMedia('(pointer: coarse)').matches;

            if (playback === 'hover' && !isMobile) {
                li.addEventListener('pointerenter', play);
                li.addEventListener('pointerleave', pause);
            } else {
                // inview (default and mobile fallback)
                var obs = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) { play(); } else { pause(); }
                    });
                }, { threshold: 0.3 });
                obs.observe(li);
            }
        }

        function fetchProducts() {
            if (window.falak && window.falak.api && typeof window.falak.api.request === 'function') {
                return window.falak.api.withoutNotifier(function () {
                    return window.falak.api.request('videoCommerceProducts');
                }).then(function (res) {
                    return Array.isArray(res) ? res : (res && res.data) || [];
                }).catch(function () {
                    return fetchRaw();
                });
            }
            return fetchRaw();
        }

        function fetchRaw() {
            return fetch('/api/storefront/videoCommerceProducts', {
                credentials: 'same-origin',
                headers: { 'Accept': 'application/json' }
            }).then(function (res) {
                if (res.status === 404) return [];
                if (!res.ok) throw new Error('vc: ' + res.status);
                return res.json();
            }).then(function (data) {
                return Array.isArray(data) ? data : (data && data.data) || [];
            });
        }

        function initSections() {
            var sections = document.querySelectorAll('[data-video-commerce]');
            if (!sections.length) return;

            fetchProducts().then(function (products) {
                sections.forEach(function (section) {
                    var limit = parseInt(section.getAttribute('data-limit'), 10) || 4;
                    var playback = section.getAttribute('data-playback') || 'inview';
                    var grid = section.querySelector('[data-vc-grid]');
                    if (!grid) return;

                    var slice = products.slice(0, limit);

                    if (!slice.length) {
                        if (isCustomizerEditor(section)) {
                            var isAr = document.documentElement.dir === 'rtl';
                            grid.innerHTML = '<li style="grid-column: 1 / -1; list-style: none; padding: 2.5rem 1.5rem; text-align: center; border: 1px dashed rgba(0,0,0,0.2); border-radius: 14px; background: rgba(0,0,0,0.02);">' +
                                '<div style="font-size: 1.05rem; font-weight: 600; color: #111; margin-bottom: 0.4rem;">' + (isAr ? 'التجارة بالفيديو' : 'Video Commerce') + '</div>' +
                                '<div style="font-size: 0.85rem; color: #666;">' + (isAr ? 'لم تتم إضافة أي منتجات فيديو بعد من لوحة التحكم.' : 'No video commerce products added yet in the dashboard.') + '</div>' +
                                '</li>';
                            section.removeAttribute('hidden');
                            section.style.display = '';
                        } else {
                            section.hidden = true;
                            section.setAttribute('hidden', '');
                            section.style.display = 'none';
                        }
                        return;
                    }

                    grid.innerHTML = ''; // remove shimmer skeletons
                    slice.forEach(function (product, idx) {
                        var li = buildCard(product, section, idx, slice);
                        grid.appendChild(li);
                        wireCard(li, playback);
                    });

                    section.removeAttribute('hidden');
                    section.style.display = '';
                });
            }).catch(function () {
                sections.forEach(function (sec) {
                    if (isCustomizerEditor(sec)) {
                        sec.removeAttribute('hidden');
                        sec.style.display = '';
                    } else {
                        sec.hidden = true;
                        sec.setAttribute('hidden', '');
                        sec.style.display = 'none';
                    }
                });
            });
        }

        if (window.falak && typeof window.falak.onReady === 'function') {
            window.falak.onReady(initSections);
        } else if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initSections);
        } else {
            initSections();
        }

        // MutationObserver to automatically catch newly inserted blocks in customizer preview
        try {
            var pendingSweep = null;
            new MutationObserver(function (mutations) {
                var hasNew = false;
                for (var i = 0; i < mutations.length; i++) {
                    if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
                        hasNew = true;
                        break;
                    }
                }
                if (hasNew) {
                    if (pendingSweep) clearTimeout(pendingSweep);
                    pendingSweep = setTimeout(function () {
                        if (document.querySelector('[data-video-commerce] .vc-skeleton')) {
                            initSections();
                        }
                    }, 150);
                }
            }).observe(document.body, { childList: true, subtree: true });
        } catch (e) { }
    }

    videoCommerce();
})();

/*
 * Category grid (categories-circles).
 * Fetched rather than rendered in Twig: a home block gets no page data, the
 * sandbox exposes no categories function, and there is no categories
 * component in the SDK. Ported from Nova's wireCategoryGrid.
 */
(function () {
    'use strict';

    var section = document.querySelector('[data-category-grid]');
    if (!section || !window.falak) return;

    var list = section.querySelector('[data-category-grid-list]');
    var limit = Number(section.getAttribute('data-limit') || 12);
    var withText = section.getAttribute('data-text') !== '0';

    window.falak.onReady(function () {
        window.falak.api.withoutNotifier(function () {
            return window.falak.api.request('categories');
        }).then(function (response) {
            var rows = Array.isArray(response) ? response : (response && response.data) || [];

            var categories = rows
                .filter(function (c) { return c && c.id && (c.status === undefined || c.status === 'active'); })
                .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
                .slice(0, limit);

            if (!categories.length) {
                var note = document.createElement('div');
                note.className = 'f-list__message f-list__message--empty';

                var noteText = document.createElement('p');
                noteText.textContent = window.falak.lang.get('categories.none_added');

                note.appendChild(noteText);
                list.insertAdjacentElement('afterend', note);
                section.removeAttribute('hidden');

                return;
            }

            categories.forEach(function (category) {
                var tile = document.createElement('a');
                tile.className = 'cat-tile';
                tile.href = window.falak.url.category(category.id);

                var figure = document.createElement('span');
                figure.className = 'cat-tile__figure';

                if (category.image_url) {
                    var img = document.createElement('img');
                    img.className = 'cat-tile__image';
                    img.src = category.image_url;
                    img.alt = '';
                    img.loading = 'lazy';
                    figure.appendChild(img);
                }

                var name = document.createElement('b');
                name.className = 'cat-tile__name';
                name.textContent = category.name || '';

                tile.appendChild(figure);
                tile.appendChild(name);

                if (withText && category.description) {
                    var text = document.createElement('small');
                    text.className = 'cat-tile__text';
                    text.textContent = category.description;
                    tile.appendChild(text);
                }

                list.appendChild(tile);
            });

            section.removeAttribute('hidden');
        }).catch(function (e) {
            if (window.falak.logger) {
                window.falak.logger.warn('categories band: fetch failed', e);
            }
        });
    });
})();

/*
 * <custom-falak-testimonials> — the testimonials block's "real reviews" source.
 *
 * Reads GET /api/storefront/reviews and renders them inside Jalawi's
 * <falak-slider class="testimonials-slider"> using the exact same
 * .testimonial-card structure as the manual branch in testimonials.twig.
 */
(function () {
    'use strict';

    if (window.customElements && customElements.get('custom-falak-testimonials')) return;

    class CustomFalakTestimonials extends HTMLElement {
        connectedCallback() {
            if (!window.falak) return;
            window.falak.onReady(() => this.load());
        }

        escape(v) {
            return String(v ?? '').replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        }

        async load() {
            const falak = window.falak;
            const limit = Number(this.getAttribute('limit')) || 6;

            this.innerHTML = '<div class="testimonials-grid">'
                + new Array(Math.min(limit, 3)).fill(
                    '<div class="testimonial-card testimonial-card--skeleton" aria-hidden="true"></div>'
                ).join('')
                + '</div>';

            try {
                const response = await falak.api.withoutNotifier(() => falak.api.request('reviews', {
                    params: { per_page: limit },
                }));

                this.reviews = (response && (response.reviews || response.data)) || [];
                if (!Array.isArray(this.reviews)) this.reviews = [];
            } catch (e) {
                if (falak.logger) falak.logger.warn('custom-falak-testimonials: fetch failed', e);
                this.reviews = [];
            }

            this.render();
        }

        render() {
            const falak = window.falak;
            const showStars = this.hasAttribute('show-stars');

            if (!this.reviews.length) {
                this.innerHTML = '';

                const section = this.closest('.block--testimonials');
                if (section) section.hidden = true;
                return;
            }

            const cardsHtml = this.reviews.map((row) => {
                const name = row.customer_name || falak.lang.get('product.anonymous');
                const text = row.review_comment || '';
                const rating = Math.min(5, Math.round(Number(row.review_rating) || 0));

                let starsHtml = '';
                if (showStars && rating > 0) {
                    let spans = '';
                    for (let i = 1; i <= 5; i++) {
                        spans += '<span class="testimonial-star ' + (i <= rating ? 'is-filled' : 'is-empty') + '">★</span>';
                    }
                    starsHtml = '<div class="testimonial-card__stars" data-falak-part="stars" aria-label="' + rating + '/5">' + spans + '</div>';
                }

                return '<figure class="testimonial-card">'
                    + (text ? '<blockquote class="testimonial-card__quote" data-falak-part="quote">' + this.escape(text) + '</blockquote>' : '')
                    + '<div class="testimonial-card__footer">'
                    + '<div class="testimonial-card__author" data-falak-part="author">'
                    + '<div class="testimonial-card__avatar testimonial-card__avatar--placeholder" data-falak-part="picture" aria-hidden="true">'
                    + '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
                    + '</div>'
                    + '<div class="testimonial-card__meta">'
                    + '<figcaption class="testimonial-card__name" data-falak-part="author_name">' + this.escape(name) + '</figcaption>'
                    + '</div>'
                    + '</div>'
                    + starsHtml
                    + '</div>'
                    + '</figure>';
            }).join('');

            this.innerHTML = '<div class="testimonials-slider-wrap">'
                + '<falak-slider class="testimonials-slider" slides-per-view="3" gap="1.5rem" show-controls loop>'
                + '<div slot="items" class="testimonials-grid">'
                + cardsHtml
                + '</div>'
                + '</falak-slider>'
                + '</div>';
        }
    }

    customElements.define('custom-falak-testimonials', CustomFalakTestimonials);
})();

/**
 * Quick View Web Component
 *
 * WHAT IS STILL THE LIBRARY'S, and is not reimplemented here:
 *
 *   falak-modal                 the dialog itself â€” focus, scroll lock, escape
 *   falak-rating-stars          the stars
 *   falak-product-options       the variant pills, availability per pill
 *   falak-quantity-input        the stepper
 *   falak-add-product-button    the add â€” it calls the cart API itself
 *   falak-product-availability  "notify me", shown only while sold out
 *   falak-wishlist-button       the heart
 *   falak-social mode=share     the share sheet
 *
 * Only the gallery and the layout are the theme's, for the same reason they
 * are on the product page: the library has no gallery component.
 *
 * Driven either by a trigger in the page â€”
 *
 *     <a href="/product/12" data-quick-view="12"
 *        data-quick-view-name="â€¦" data-quick-view-image="â€¦">
 *
 * â€” or from the bus, for anything that holds no element:
 *
 *     falak.event.dispatch('quick-view::open', { id: 12 })
 */
(function () {
    'use strict';

    if (window.customElements && customElements.get('custom-falak-quick-view')) return;

    class CustomFalakQuickView extends HTMLElement {

        /*
         * One element serves the whole page, created the first time something
         * asks for it. Each open builds a FRESH <falak-modal>, because the
         * modal snapshots its content on first render and re-renders from that
         * snapshot â€” the same arrangement <falak-quick-add> uses.
         */
        static open(seed) {
            let host = document.querySelector('custom-falak-quick-view');

            if (!host) {
                host = document.createElement('custom-falak-quick-view');
                document.body.appendChild(host);
            }

            return host.open(seed);
        }

        /**
         * @param {{ id: number|string, name?: string, image?: string }} seed
         *   Whatever the trigger already knew. It is painted immediately so the
         *   dialog opens on the product rather than on an empty box, and is
         *   replaced by the real record once the fetch lands.
         */
        async open(seed) {
            const falak = window.falak;
            if (!falak) return null;

            const id = seed && (seed.id !== undefined ? seed.id : seed.productId);
            if (!id) return null;

            /* A second open while one is on screen replaces it rather than
               stacking two dialogs for two different products. */
            if (this._modal) this._modal.remove();

            const modal = document.createElement('falak-modal');
            modal.className = 'f-quick-view';
            modal.setAttribute('width', 'xl');
            modal.setAttribute('aria-label', falak.lang.get('product.quick_view'));
            /* The real dialog and the skeleton share one grid cell. The real
               one is filled behind the skeleton and stays inert until it is
               worth looking at; only then does the skeleton fade off it. */
            modal.innerHTML = '<div class="qv-shell">'
                + '<div class="qv" data-qv-root inert></div>'
                + '<div class="qv qv--loading" data-qv-loader>' + this.skeleton(seed) + '</div>'
            + '</div>';

            this.appendChild(modal);
            this._modal = modal;
            this.dropOnClose(modal);

            // Let the modal render before opening so its transition plays.
            await Promise.resolve();
            modal.open();

            const product = await this.load(id);

            /* Closed, or replaced by another product, while the request was in
               flight â€” painting now would either resurrect a dead dialog or
               overwrite the newer one. */
            if (this._modal !== modal || !modal.isConnected) return modal;

            const root = modal.querySelector('[data-qv-root]');

            if (root) root.innerHTML = this.body(this.read(product, seed));

            this.wireGallery(modal);
            this.wireShare(modal);
            this.wireOptions(modal);
            this.closeOnAdd(modal);

            /* Enter in the stepper would submit the column's form and reload
               the page under the dialog. */
            const form = modal.querySelector('[data-qv-form]');
            if (form) form.addEventListener('submit', event => event.preventDefault());

            await this.settle(root);
            if (this._modal !== modal || !modal.isConnected) return modal;
            this.reveal(modal);

            falak.event.dispatch('quick-view::opened', { productId: id });

            return modal;
        }

        /*
         * Resolves once the lead picture (or clip) can be shown, so the
         * skeleton never lifts onto an empty frame that then pops in. Capped:
         * a slow CDN is no reason to hold the buy box hostage.
         */
        settle(root) {
            const media = root && root.querySelector('.qv__slide.is-active img, .qv__slide.is-active video');
            const loaded = new Promise(resolve => {
                if (!media) return resolve();
                if (media.tagName === 'VIDEO') {
                    if (media.readyState >= 2) return resolve();
                    media.addEventListener('loadeddata', resolve, { once: true });
                } else {
                    if (media.complete) return resolve();
                    media.addEventListener('load', resolve, { once: true });
                }
                media.addEventListener('error', resolve, { once: true });
            });

            /* One frame more, so the SDK elements in the buy box have drawn. */
            return Promise.race([loaded, new Promise(resolve => setTimeout(resolve, 4000))])
                .then(() => new Promise(resolve => requestAnimationFrame(() => resolve())));
        }

        reveal(modal) {
            const root = modal.querySelector('[data-qv-root]');
            const loader = modal.querySelector('[data-qv-loader]');

            if (root) root.removeAttribute('inert');
            if (!loader) return;

            loader.classList.add('is-done');
            setTimeout(() => loader.remove(), 300);
        }

        close() {
            if (this._modal) this._modal.close();
        }

        /*
         * The product record, memoised for the life of the page.
         *
         * A shopper comparing four items in a grid opens, closes and reopens
         * the same dialog; without this, every reopen is another round trip for
         * a record that has not changed. The variations travel with it, which
         * is also what saves <falak-product-options> from a second request of
         * its own â€” it is given them rather than told to `fetch`.
         */
        async load(id) {
            this._records = this._records || {};
            if (this._records[id]) return this._records[id];

            const falak = window.falak;

            try {
                const response = await falak.api.withoutNotifier(() => falak.product.show(id));
                const product = (response && response.data) ? response.data : response;

                if (product) this._records[id] = product;

                return product;
            } catch (error) {
                falak.logger.warn('custom-falak-quick-view: fetch failed', error);
                return null;
            }
        }

        /*
         * Both product shapes, the way the card's normaliser reads them:
         *
         *   the API's raw row       price_cents, discount_price_cents, images[]
         *   the server's mapProduct price_amount, compare_at, images[]
         *
         * The dialog is fed by the API, but a caller that already holds a
         * mapped record can pass it straight in and skip the fetch.
         */
        /*
         * A category's name in the page language, whichever shape carried it:
         * the resolved `name` + `name_ar` the product endpoints send, the
         * `name_json` pair the categories endpoint adds, or `name` as the
         * {ar, en} map straight off the model. The last one is what a raw
         * Category row serializes to, and reading it as text printed
         * "Category: [object Object]" under the product name. The fallback
         * order is the server's: asked-for language, then Arabic, then English.
         */
        categoryName(row) {
            if (!row) return '';
            const locale = window.falak.lang.locale;
            const pair = row.name_json || (row.name && typeof row.name === 'object' ? row.name : null);
            if (pair) return pair[locale] || pair.ar || pair.en || '';
            return (locale === 'ar' && row.name_ar ? row.name_ar : row.name) || '';
        }

        read(raw, seed) {
            const falak = window.falak;
            const locale = falak.lang.locale;
            const p = raw || {};
            const s = seed || {};

            const mapped = p.price_cents === undefined && p.price_amount !== undefined;
            const list = mapped ? Number(p.price_amount || 0) : Number(p.price_cents || 0);
            const discount = mapped ? 0 : Number(p.discount_price_cents || 0);
            const onSale = discount > 0 && discount < list;

            /* Every picture the product has, lead first. The lead is added only
               when the relation did not already carry it â€” a repeated first
               slide reads as a broken gallery, not as emphasis. */
            const images = (Array.isArray(p.images) ? p.images : [])
                .map(img => this.media(typeof img === 'string' ? img : (img.url || img.image_path)))
                .filter(Boolean);

            const lead = this.media(p.image_path || p.image) || s.image || null;
            if (lead && images.indexOf(lead) === -1) images.unshift(lead);

            const variations = Array.isArray(p.variations) ? p.variations : [];
            /* The merchant's display config for those variations â€” order,
               labels, swatch colours. Carried for the same reason as
               `variations`: read() builds this object field by field, so
               anything it does not name is dropped, and without this the
               dialog drew plain pills while the product page drew swatches. */
            const options = Array.isArray(p.options) ? p.options : [];
            const backorders = !!p.allow_backorders;

            /* A variant product is in stock while ANY variant is â€” the same
               rule the server's productInStock() applies.

               A null (or absent) quantity is UNLIMITED, not zero: a store that
               does not count stock sends no number at all, and reading that as
               "none left" put "Out of stock" on its whole catalogue. */
            const inStock = mapped
                ? p.in_stock !== false
                : (backorders || (variations.length
                    ? variations.some(v => v.quantity === null || v.quantity === undefined || Number(v.quantity) > 0)
                    : (p.quantity === null || p.quantity === undefined || Number(p.quantity) > 0)));

            const unlimited = backorders || p.quantity === null || p.quantity === undefined;
            const available = mapped
                ? (p.available === undefined ? null : p.available)
                : (unlimited ? null : Math.max(0, Number(p.quantity)));

            const categories = Array.isArray(p.categories) ? p.categories : [];
            const category = categories.length
                ? {
                    name: this.categoryName(categories[0]),
                    url: falak.url.category(categories[0].id),
                }
                : (p.category
                    ? { name: this.categoryName(p.category), url: p.category.url || falak.url.category(p.category.id) }
                    : null);

            const id = p.id !== undefined ? p.id : s.id;

            return {
                id: id,
                name: ((locale === 'ar' && p.name_ar ? p.name_ar : p.name) || s.name || ''),
                url: falak.url.product(id),
                images: images,
                price: onSale ? discount : list,
                /* A number from the raw shape; mapProduct hands compare_at over
                   ALREADY FORMATTED. Both are kept as they come and the
                   renderer decides â€” running a formatted string back through
                   money() produces nonsense. */
                compareAt: onSale ? list : (mapped ? (p.compare_at || null) : null),
                /*
                 * The clip, for a product that has NO still at all.
                 *
                 * The video-commerce wall's cards are the ones that hit this:
                 * a merchant who uploaded a clip and no photograph. The shopper
                 * clicked a card that was showing them something, so opening on
                 * a grey placeholder reads as a broken dialog. This is a
                 * fallback only â€” a product with photographs shows the
                 * photographs, exactly as its own page does.
                 */
                video: this.media(p.video_url || p.video_path),
                poster: this.media(p.video_thumbnail_path),
                variations: variations,
                options: options,
                category: category && category.name ? category : null,
                sku: p.sku || null,
                description: ((locale === 'ar' && p.description_ar ? p.description_ar : p.description) || p.short_description || p.details || '').trim(),
                specs: this.specs(p),
                rating: p.reviews_avg_rating !== undefined && p.reviews_avg_rating !== null
                    ? p.reviews_avg_rating
                    : (p.rating !== undefined && p.rating !== null ? p.rating : null),
                reviews: Number(p.reviews_count || 0),
                isTaxable: !!p.is_taxable,
                /*
                 * A PRINTING product (a photo mug, a printed shirt) is designed
                 * before it is bought, so its add button must open the design
                 * dialog rather than add a blank product. `is_printing` is the
                 * server-rendered (mapProduct) flag; the raw API row carries
                 * product_type instead.
                 */
                isPrinting: p.is_printing !== undefined
                    ? !!p.is_printing
                    : p.product_type === 'printing',
                /* A SERVICE is booked through the wizard, not added. */
                isService: p.is_service !== undefined
                    ? !!p.is_service
                    : p.product_type === 'service',
                inStock: inStock,
                available: available,
                /* The record never arrived â€” everything below the name would be
                   a guess, so the dialog says so and offers the page instead. */
                partial: !raw,
            };
        }

        /* ------------------------------------------------------------ markup */

        /* What is on screen until the dialog is ready: the picture and the
           name the trigger already carried, with a spinner over the picture,
           and shimmering bars where the price and the buy box are about to be. */
        skeleton(seed) {
            const s = seed || {};
            const bone = mod => '<span class="qv__bone' + (mod ? ' qv__bone--' + mod : '') + '"></span>';

            return ''
                + '<div class="qv__media">'
                    + '<div class="qv__frame">'
                        + (s.image
                            ? '<figure class="qv__slide is-active"><img src="' + this.escape(s.image) + '" alt=""></figure>'
                            : '<figure class="qv__slide qv__slide--empty is-active">' + bone('fill') + '</figure>')
                        + '<span class="qv__spinner" role="status" aria-live="polite"'
                            + ' aria-label="' + this.escape(this.trans('common.loading')) + '"></span>'
                    + '</div>'
                    + '<div class="qv__thumbs">' + bone('thumb') + bone('thumb') + bone('thumb') + '</div>'
                + '</div>'
                + '<div class="qv__info">'
                    + '<div class="qv__body">'
                        + bone('eyebrow')
                        + (s.name ? '<h2 class="qv__title">' + this.escape(s.name) + '</h2>' : bone('title'))
                        + bone('price')
                        + bone('line')
                        + bone('line')
                        + bone('short')
                    + '</div>'
                    + '<div class="qv__footer">'
                        + '<div class="qv__actions">' + bone('qty') + bone('button') + '</div>'
                    + '</div>'
                + '</div>';
        }

        body(p) {
            const falak = window.falak;
            const t = key => this.trans(key);

            if (p.partial) {
                return '<div class="qv__failed">'
                    + '<p>' + this.escape(t('product.quick_view_failed')) + '</p>'
                    + '<a class="btn btn--primary" href="' + this.escape(p.url) + '">'
                        + this.escape(t('product.full_details'))
                    + '</a>'
                + '</div>';
            }

            const many = p.images.length > 1;

            const slides = p.images.length
                ? p.images.map((src, index) =>
                    '<figure class="qv__slide' + (index === 0 ? ' is-active' : '') + '"'
                        + ' data-qv-slide data-index="' + index + '">'
                        + '<img src="' + this.escape(src) + '" alt="' + this.escape(p.name) + '"'
                            + (index === 0 ? '' : ' loading="lazy"') + '>'
                    + '</figure>').join('')
                : p.video
                    /* Autoplaying muted and looping, with no controls: this is
                       the same treatment the card gave the clip, and a dialog
                       the shopper opened to look at one product is exactly
                       where the clip should keep running. */
                    ? '<figure class="qv__slide is-active">'
                        + '<video autoplay muted loop playsinline preload="metadata"'
                            + (p.poster ? ' poster="' + this.escape(p.poster) + '"' : '')
                            + ' src="' + this.escape(p.video) + '"></video>'
                    + '</figure>'
                    : '<figure class="qv__slide qv__slide--empty is-active"></figure>';

            /* Arrows on the stage, a "1 / 5" counter in its corner and a thumb
               strip under it. The strip is desktop-only (CSS): on a phone the
               stage is the full width and a row of tiles just pushes the buy
               box further below the fold. */
            const nav = many
                ? '<button type="button" class="qv__nav qv__nav--prev" data-qv-prev'
                        + ' aria-label="' + this.escape(t('common.previous')) + '">' + this.chevron('start') + '</button>'
                    + '<button type="button" class="qv__nav qv__nav--next" data-qv-next'
                        + ' aria-label="' + this.escape(t('common.next')) + '">' + this.chevron('end') + '</button>'
                    + '<span class="qv__counter" data-qv-counter dir="ltr">1 / ' + p.images.length + '</span>'
                : '';

            const thumbs = many
                ? '<div class="qv__thumbs">'
                    + p.images.map((src, index) =>
                        '<button type="button" class="qv__thumb' + (index === 0 ? ' is-active' : '') + '"'
                            + ' data-qv-thumb="' + index + '" aria-label="' + (index + 1) + ' / ' + p.images.length + '">'
                            + '<img src="' + this.escape(src) + '" alt="" loading="lazy">'
                        + '</button>').join('')
                + '</div>'
                : '';

            /* Only off a numeric compare price: mapProduct hands it over
               already formatted, and a percentage worked out of a string is a
               guess. */
            const off = typeof p.compareAt === 'number' && p.compareAt > p.price
                ? Math.round((1 - p.price / p.compareAt) * 100)
                : 0;

            /* Server-rendered from the record already in hand rather than
               `fetch`: the dialog has just paid for the product and its
               variations came with it, and a second request would land after
               the pills were expected on screen. */
            const options = p.variations.length
                ? '<falak-product-options class="qv__options" data-qv-options'
                    + ' product-id="' + this.escape(p.id) + '"'
                    /* The merchant's display config travels with the record too
                       (product.show eager-loads it), so the dialog draws the same
                       swatches the product page does instead of plain pills. */
                    + (p.options && p.options.length
                        ? ' options="' + this.escape(JSON.stringify(p.options)) + '"'
                        : '')
                    + ' variations="' + this.escape(JSON.stringify(p.variations)) + '"></falak-product-options>'
                : '';

            const money = v => (typeof v === 'number' ? falak.money(v) : v);

            return ''
                + '<div class="qv__media">'
                    + '<div class="qv__frame">'
                        + '<div class="qv__stage" data-qv-stage>' + slides + '</div>'
                        + (off > 0 ? '<span class="qv__badge" dir="ltr">-' + off + '%</span>' : '')
                        + nav
                    + '</div>'
                    + thumbs
                + '</div>'

                /* A form, so <falak-add-product-button> resolves its stepper
                   and its options INSIDE the dialog. Both selectors are scoped
                   to the nearest form first and only then page-wide, which is
                   what keeps a quick view opened from a product page off that
                   page's own stepper. It is the whole column because the
                   options scroll in the body while the stepper and the button
                   stay pinned in the footer. */
                + '<form class="qv__info" data-qv-form novalidate>'
                  + '<div class="qv__body">'
                    + '<div class="qv__tools">'
                        + (p.category
                            ? '<a class="qv__eyebrow" href="' + this.escape(p.category.url) + '">' + this.escape(p.category.name) + '</a>'
                            : '<span class="qv__eyebrow"></span>')
                        + '<falak-wishlist-button class="qv__tool" product-id="' + this.escape(p.id) + '"'
                            + ' button-class="qv__tool-btn"></falak-wishlist-button>'

                        /* <falak-social mode="share"> has no trigger of its own
                           â€” it always draws its row inline â€” so the trigger is
                           the theme's and the component keeps owning the
                           networks and the URLs. Same wrapper as the product
                           page's gallery. */
                        + '<div class="qv__tool qv__share" data-qv-share>'
                            + '<button type="button" class="qv__tool-btn" data-qv-share-toggle'
                                + ' aria-expanded="false" aria-label="' + this.escape(t('footer.share')) + '">'
                                + this.shareGlyph()
                            + '</button>'
                            + '<falak-social class="qv__share-sheet" mode="share" hide-title'
                                /* Absolute: a share link is opened on another
                                   site, where "/product/12" resolves to
                                   nothing at all. */
                                + ' share-url="' + this.escape(window.location.origin + p.url) + '"'
                                + ' share-text="' + this.escape(p.name) + '"></falak-social>'
                        + '</div>'
                    + '</div>'

                    + '<h2 class="qv__title"><a href="' + this.escape(p.url) + '">' + this.escape(p.name) + '</a></h2>'

                    + '<p class="qv__price">'
                        + '<span class="qv__amount" data-qv-amount>' + this.escape(falak.money(p.price)) + '</span>'
                        + '<del class="qv__was" data-qv-was' + (p.compareAt ? '' : ' hidden') + '>'
                            + this.escape(p.compareAt ? money(p.compareAt) : '')
                        + '</del>'
                    + '</p>'

                    /* Server values, not `fetch`: the record already carries the
                       aggregate, and a fetched rating pops in and shoves the buy
                       box down inside a box this short. */
                    + (p.reviews > 0
                        ? '<a class="qv__rating" href="' + this.escape(p.url) + '#product-reviews">'
                            + '<falak-rating-stars value="' + this.escape(p.rating || 0) + '"'
                                + ' total="' + p.reviews + '"></falak-rating-stars>'
                        + '</a>'
                        : '')

                    /* Stock and SKU on one quiet line, both repainted when a
                       variant is chosen (see wireOptions). */
                    + '<p class="qv__status">'
                        + '<span class="qv__stock' + (p.inStock ? '' : ' qv__stock--out') + '" data-qv-stock>'
                            + this.escape(t(p.inStock ? 'product.in_stock' : 'product.out_of_stock'))
                        + '</span>'
                        + '<span class="qv__sku" data-qv-sku-wrap' + (p.sku ? '' : ' hidden') + '>'
                            + this.escape(t('product.sku')) + ' '
                            + '<span dir="ltr" data-qv-sku>' + this.escape(p.sku || '') + '</span>'
                        + '</span>'
                        + (p.isTaxable ? '<span class="qv__tax">' + this.escape(t('product.tax_included')) + '</span>' : '')
                    + '</p>'

                    + (p.description ? '<div class="qv__desc">' + p.description + '</div>' : '')

                    + options
                  + '</div>'

                  + '<div class="qv__footer">'
                    + '<div class="qv__actions">'
                        + '<falak-quantity-input class="qv__qty" data-qv-qty value="1" min="1"'
                            + (p.available ? ' max="' + p.available + '"' : '')
                            + ' label="' + this.escape(t('product.quantity')) + '"></falak-quantity-input>'

                        + '<falak-add-product-button class="qv__add"'
                            + ' product-id="' + this.escape(p.id) + '"'
                            + ' product-status="' + (p.inStock ? 'sale' : 'out') + '"'
                            + ' quantity-selector="[data-qv-qty]"'
                            + (p.variations.length ? ' options-selector="[data-qv-options]"' : '')
                            /* A printing product: the button opens the design
                               dialog over this one rather than adding undesigned. */
                            + (p.isPrinting
                                ? ' requires-design'
                                    + ' product-url="' + this.escape(p.url) + '"'
                                    + ' product-name="' + this.escape(p.name) + '"'
                                    + ' product-image="' + this.escape((p.images && p.images[0]) || '') + '"'
                                    + ' product-price="' + this.escape(window.falak.money(p.price)) + '"'
                                : '')
                            /* A service: the button opens the booking wizard. */
                            + (p.isService ? ' product-type="booking"' : '')
                            + ' source="quick-view"'
                            + ' button-class="btn btn--primary qv__add-btn">'
                            + (p.isService
                                ? '<span data-booking-label>' + this.escape(t('product.book_now')) + '</span>'
                                : this.bagGlyph()
                                    + '<span>' + this.escape(t(p.isPrinting ? 'product.design_now' : 'product.add_to_cart')) + '</span>')
                        + '</falak-add-product-button>'
                    + '</div>'

                    /* Shows itself only while the product (or the chosen
                       variant) is sold out, so it needs no condition. */
                    + '<falak-product-availability class="qv__notify"'
                        + ' product-id="' + this.escape(p.id) + '"'
                        + ' product-status="' + (p.inStock ? 'sale' : 'out') + '"'
                        + ' button-class="btn btn--outline"></falak-product-availability>'

                    /* The dialog is a preview, not a replacement: the long
                       description, the tabs, the reviews and the Q&A are all
                       still only on the page. The line beside it echoes the
                       shopper's choice back to them. */
                    + '<div class="qv__foot-meta">'
                        + '<span class="qv__summary" data-qv-summary></span>'
                        + '<a class="qv__details" href="' + this.escape(p.url) + '">'
                            + this.escape(t('product.full_details'))
                            + this.arrow()
                        + '</a>'
                    + '</div>'
                  + '</div>'
                + '</form>';
        }

        /* ----------------------------------------------------------- wiring */

        /*
         * The gallery: the slides are all in the markup and only ever toggled,
         * never rebuilt â€” so the browser keeps the decoded images and switching
         * back to one that has been seen is instant. Same rule as the product
         * page's own gallery.
         */
        wireGallery(modal) {
            const stage = modal.querySelector('[data-qv-stage]');
            if (!stage) return;

            const slides = [...stage.querySelectorAll('[data-qv-slide]')];
            if (slides.length < 2) return;

            let current = 0;

            const counter = modal.querySelector('[data-qv-counter]');
            const thumbs = [...modal.querySelectorAll('[data-qv-thumb]')];

            const show = (index) => {
                current = (index + slides.length) % slides.length;
                slides.forEach((slide, i) => slide.classList.toggle('is-active', i === current));
                thumbs.forEach((thumb, i) => thumb.classList.toggle('is-active', i === current));
                if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
            };

            const prev = modal.querySelector('[data-qv-prev]');
            const next = modal.querySelector('[data-qv-next]');

            if (prev) prev.addEventListener('click', () => show(current - 1));
            if (next) next.addEventListener('click', () => show(current + 1));

            thumbs.forEach(thumb => thumb.addEventListener('click', () => {
                show(Number(thumb.getAttribute('data-qv-thumb')));
            }));

            /* Arrow keys move the gallery, but only while focus is not in a
               field â€” there the arrows belong to the stepper. */
            modal.addEventListener('keydown', (event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                if (event.target.closest('input, select, textarea')) return;

                /* In RTL the left arrow means "the next one along", so the step
                   is read off the document's direction rather than assumed. */
                const rtl = document.documentElement.getAttribute('dir') === 'rtl';
                const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';

                event.preventDefault();
                show(current + (forward ? 1 : -1));
            });
        }

        /* Only decides when the share row is on screen; the component still
           renders it. Scoped to the modal, so the product page's own share
           popover behind the dialog is left alone. */
        wireShare(modal) {
            const share = modal.querySelector('[data-qv-share]');
            if (!share) return;

            const toggle = share.querySelector('[data-qv-share-toggle]');

            const close = () => {
                share.classList.remove('is-open');
                toggle.setAttribute('aria-expanded', 'false');
            };

            toggle.addEventListener('click', (event) => {
                event.stopPropagation();
                const open = share.classList.toggle('is-open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });

            /* A share link inside the sheet must still work, so this only
               closes on a click that landed outside the whole wrapper. The
               listener dies with the dialog. */
            modal.addEventListener('click', (event) => {
                if (!share.contains(event.target)) close();
            });
        }

        /*
         * The price, stock, SKU and the "Chalk Â· Brown"
         * summary follow the chosen variant.
         *
         * Read off the options element's own bubbling `changed` event rather
         * than the bus: the bus also carries the product page's options, and a
         * quick view opened over a product page must not repaint from those.
         * Each value falls back to the product's own until the choice is
         * complete, so an unfinished choice never shows a stale variant.
         */
        wireOptions(modal) {
            const options = modal.querySelector('[data-qv-options]');
            if (!options) return;

            const falak = window.falak;
            const t = key => this.trans(key);
            const pick = sel => modal.querySelector(sel);

            const amount = pick('[data-qv-amount]');
            const was = pick('[data-qv-was]');
            const stock = pick('[data-qv-stock]');
            const skuWrap = pick('[data-qv-sku-wrap]');
            const sku = pick('[data-qv-sku]');
            const summary = pick('[data-qv-summary]');

            const base = {
                amount: amount ? amount.textContent : '',
                was: was ? was.textContent : '',
                wasHidden: was ? was.hidden : true,
                stock: stock ? stock.textContent : '',
                out: stock ? stock.classList.contains('qv__stock--out') : false,
                sku: sku ? sku.textContent : '',
            };

            const paint = (detail) => {
                const d = detail || {};
                const price = Number(d.price);
                const compare = Number(d.comparePrice);
                const hasPrice = d.complete && Number.isFinite(price) && price > 0;
                const text = hasPrice ? falak.money(price) : base.amount;

                if (amount) amount.textContent = text;

                if (was) {
                    const hasCompare = hasPrice && Number.isFinite(compare) && compare > price;
                    was.textContent = hasCompare ? falak.money(compare) : (hasPrice ? '' : base.was);
                    was.hidden = hasCompare ? false : (hasPrice ? true : base.wasHidden);
                }

                if (stock) {
                    const known = d.complete && d.inStock !== null && d.inStock !== undefined;
                    const out = known ? !d.inStock : base.out;
                    stock.textContent = known ? t(out ? 'product.out_of_stock' : 'product.in_stock') : base.stock;
                    stock.classList.toggle('qv__stock--out', out);
                }

                if (sku && skuWrap) {
                    const value = (d.complete && d.sku) || base.sku;
                    sku.textContent = value;
                    skuWrap.hidden = !value;
                }

                if (summary) {
                    /* The merchant's value labels, in the component's own group
                       order â€” the same words the pills show. */
                    const selected = d.selected || options.selected || {};
                    const groups = Array.isArray(options.groups) ? options.groups : [];
                    summary.textContent = groups
                        .filter(g => selected[g.key] !== undefined)
                        .map(g => (typeof options.valueLabel === 'function' ? options.valueLabel(g, selected[g.key]) : selected[g.key]))
                        .join(' Â· ');
                }
            };

            options.addEventListener('changed', event => paint(event.detail));

            /* A choice the component pre-selected on its first render landed
               before this listener existed. */
            requestAnimationFrame(() => paint({
                complete: options.isComplete,
                selected: options.selected,
                price: options.variation ? options.variation.price : null,
                comparePrice: options.variation ? options.variation.comparePrice : null,
                inStock: options.variation ? options.variation.inStock : null,
                sku: options.variation ? options.variation.sku : null,
            }));
        }

        /*
         * Added: the shopper is done here. The dialog was opened to look at one
         * product, and leaving it up over the grid afterwards just makes them
         * dismiss it themselves. The pause lets the button's own "Added âœ“" be
         * read first.
         */
        closeOnAdd(modal) {
            modal.addEventListener('success', (event) => {
                if (!event.target.matches('falak-add-product-button')) return;
                window.setTimeout(() => modal.close(), 700);
            });
        }

        /*
         * Drop the modal once it closes, rather than leaving it parked in the
         * document until the next open.
         *
         * It carries a loaded <falak-product-options> for this product, and
         * <falak-add-product-button> looks for its options element across the
         * whole document. A closed dialog left in the tree would be found by
         * the CARD's button on the next click. Escape and backdrop clicks close
         * the modal without telling this component, so the attribute is watched
         * rather than hooking close().
         */
        dropOnClose(modal) {
            const watcher = new MutationObserver(() => {
                if (modal.hasAttribute('visible')) return;

                watcher.disconnect();

                // After the close transition, so the dialog is not yanked mid-fade.
                window.setTimeout(() => {
                    if (this._modal === modal) this._modal = null;
                    modal.remove();
                }, 400);
            });

            watcher.observe(modal, { attributes: true, attributeFilter: ['visible'] });
        }

        /* ---------------------------------------------------------- helpers */

        /* Weight and dimensions, for the same chips the product page draws
           under its variants. The API sends the decimals as strings ("12.00");
           Number() drops the padding, and a blank or zero field is left out
           rather than printed as "0 cm". */
        specs(p) {
            return [
                ['weight', 'product.weight_unit'],
                ['length', 'product.dimension_unit'],
                ['width', 'product.dimension_unit'],
                ['height', 'product.dimension_unit'],
            ]
                .map(([key, unit]) => ({ key: key, unit: unit, value: Number(p[key]) || 0 }))
                .filter(s => s.value > 0);
        }

        specsMarkup(specs) {
            return '';
        }

        trans(key) {
            return window.falak.lang.get(key);
        }

        /* The API returns media as bare storage paths ('products/x.jpg'), so
           anything not already absolute is resolved against the public disk. */
        media(v) {
            const s = String(v || '').trim();
            if (!s) return null;
            if (/^(https?:)?\/\//i.test(s) || s.indexOf('data:') === 0) return s;
            if (s.charAt(0) === '/') return s;
            return '/storage/' + s.replace(/^\/+/, '');
        }

        escape(v) {
            return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) {
                return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
            });
        }

        /* Logical, not physical: `start` points back the way the page reads, so
           one set of markup is correct in both directions. */
        chevron(side) {
            return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + (side === 'start' ? '<path d="m15 18-6-6 6-6"/>' : '<path d="m9 18 6-6-6-6"/>')
                + '</svg>';
        }

        /* Points the way the page reads, so it flips in Arabic. */
        arrow() {
            return '<svg class="qv__arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
        }

        shareGlyph() {
            return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>'
                + '<path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';
        }

        bagGlyph() {
            return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
                + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
                + '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>'
                + '<path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
        }
    }

    customElements.define('custom-falak-quick-view', CustomFalakQuickView);

    /*
     * The bus entry point, subscribed HERE rather than in the element's
     * connectedCallback.
     *
     * The element is created on demand â€” the first open is what makes it â€” so a
     * listener registered on the element itself could only ever hear the SECOND
     * dispatch. A Twig page or a merchant script driving the dialog from the bus
     * would have found its first call silently ignored.
     *
     * falak.init() runs in the page before this deferred script, so the bus is
     * already there; the guard is for the customizer, which evaluates the
     * theme's script in isolation.
     */
    if (window.falak) {
        window.falak.event.on('quick-view::open', function (payload) {
            CustomFalakQuickView.open(payload || {});
        });
    }

    /*
     * One delegated listener for every trigger on the page, however it got
     * there â€” a card the SDK slider built after this ran is covered without
     * re-wiring, which a per-element listener could not do.
     *
     * The trigger stays an <a href> pointing at the product page: a
     * middle-click, a modifier-click, and a page whose JavaScript has not run
     * yet (or failed) all still reach the product. The dialog is the
     * enhancement, never the only way through.
     */
    document.addEventListener('click', function (event) {
        const trigger = event.target.closest('[data-quick-view]');
        if (!trigger || !window.falak) return;

        // Anything but a plain left click is the shopper asking for a new tab.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        event.preventDefault();

        /*
         * A PRINTING product's eye opens the design dialog instead: the
         * SDK's <falak-quick-add> in design mode, the same studio window
         * the card's add button and the product page open, so the shopper
         * lands in the customizer rather than in a buy box that could only
         * send them there. Without the component (an SDK build that left
         * it out) the quick view stays the fallback â€” its own add button
         * carries `requires-design`, so the design is still never skipped.
         */
        if (trigger.hasAttribute('data-quick-view-design')) {
            const FalakQuickAdd = window.customElements && customElements.get('falak-quick-add');

            if (FalakQuickAdd && typeof FalakQuickAdd.open === 'function') {
                const id = trigger.getAttribute('data-quick-view');

                FalakQuickAdd.open({
                    productId: id,
                    name: trigger.getAttribute('data-quick-view-name') || '',
                    image: trigger.getAttribute('data-quick-view-image') || '',
                    price: trigger.getAttribute('data-quick-view-price') || '',
                    url: trigger.getAttribute('href') || window.falak.url.product(id),
                }, { design: true });
                return;
            }
        }

        CustomFalakQuickView.open({
            id: trigger.getAttribute('data-quick-view'),
            name: trigger.getAttribute('data-quick-view-name') || '',
            image: trigger.getAttribute('data-quick-view-image') || '',
        });
    });
})();
