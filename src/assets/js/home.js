/*
    Falak Theme 2026 — home page behavior (hero slider, shop by category).

    The slider itself is the SDK's <falak-slider> (scrolling, autoplay, loop,
    arrows, dots, thumbnail cards). This file only adds what it doesn't do:
      - plays the active slide's background video and pauses the others;
      - marks the active slide (.is-active) so its text can animate in;
      - adds the description line to product cards (<falak-product-card>)
        and fills category cards from the SDK;
      - fills the photo grid's flip cards (Jalawi's shop by category) (and builds them when the
        section lists no category).
*/
(function () {
    'use strict';

    var isArabic = (document.documentElement.lang || '').indexOf('ar') === 0;

    function syncSlides(slider, index) {
        slider.querySelectorAll('.hero-slider__slide').forEach(function (slide, i) {
            var active = i === index;
            slide.classList.toggle('is-active', active);
            var video = slide.querySelector('.hero-slider__video');
            if (!video) return;
            if (active) {
                video.muted = true;
                var playing = video.play();
                if (playing && playing.catch) playing.catch(function () { /* autoplay refused — poster stays */ });
            } else {
                video.pause();
            }
        });
    }

    document.querySelectorAll('falak-slider.hero-slider').forEach(function (slider) {
        slider.addEventListener('slide-change', function (event) {
            syncSlides(slider, event.detail && typeof event.detail.index === 'number' ? event.detail.index : 0);
        });
        syncSlides(slider, 0);
    });

    /* ------------------------------------------- product / category cards */

    function whenSdk(fn) {
        if (window.falak && window.falak.onReady) return window.falak.onReady().then(fn);
        window.addEventListener('load', function () {
            if (window.falak && window.falak.onReady) window.falak.onReady().then(fn);
        });
    }

    // Product cards are the SDK's <falak-product-card>; Jalawi also shows a
    // short line under the name, which the card doesn't print. It's read
    // from the card's own loaded product (no second request) once it renders.
    var HERO_CART_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';

    function decorateProductThumb(host) {
        var card = host.querySelector('falak-product-card');
        var target = host.querySelector('[data-hero-thumb-desc]');
        var viewBtn = host.querySelector('.hero-thumb__view');
        if (!card) return;

        function sync() {
            // 1. Fill description line if available
            if (target && !target.textContent) {
                var p = card.product;
                if (p) {
                    var desc = (isArabic && p.subtitle_ar) || p.subtitle || (isArabic && p.description_ar) || p.description || '';
                    if (desc) {
                        var tmp = document.createElement('div');
                        tmp.innerHTML = desc;
                        target.textContent = (tmp.textContent || '').trim();
                    }
                }
            }

            // 2. Ensure Add to Cart button has icon and matches styling
            var actions = card.querySelector('.f-card__actions');
            var addBtn = card.querySelector('.f-card__add, .f-add-product__button, falak-add-product-button button');
            if (addBtn && !addBtn.querySelector('svg')) {
                addBtn.insertAdjacentHTML('afterbegin', HERO_CART_ICON);
            }

            // 3. Keep view (eye) button inside .f-card__actions side by side with add button
            if (actions && viewBtn && viewBtn.parentNode !== actions) {
                actions.appendChild(viewBtn);
            }

            return Boolean(card.product && actions);
        }

        if (sync()) return;
        var observer = new MutationObserver(function () {
            if (sync()) observer.disconnect();
        });
        observer.observe(card, { childList: true, subtree: true });
    }

    // The store's categories, fetched once for every section that needs them.
    var categoriesPromise = null;
    function loadCategories() {
        if (!categoriesPromise) {
            categoriesPromise = window.falak.product.categories
                ? window.falak.product.categories().then(function (res) {
                    var list = res && res.data ? res.data : res;
                    return Array.isArray(list) ? list : [];
                })
                : Promise.resolve([]);
        }
        return categoriesPromise;
    }

    function categoryName(c) { return (isArabic && c.name_ar) || c.name || ''; }

    function fillCategories(cards) {
        loadCategories().then(function (list) {
            cards.forEach(function (card) {
                var id = card.getAttribute('data-hero-category');
                var match = list.filter(function (c) { return String(c.id) === String(id); })[0];
                if (!match) return;
                var title = card.querySelector('[data-hero-thumb-title]');
                if (title && !title.hasAttribute('data-custom')) title.textContent = (isArabic && match.name_ar) || match.name;
                var img = card.querySelector('[data-hero-thumb-image]');
                var catImage = match.image_url || match.image;
                if (catImage && img && !img.hasAttribute('data-custom')) img.src = catImage;
                var href = '/products?category_id[]=' + encodeURIComponent(match.id);
                card.querySelectorAll('a.hero-thumb__media, a.hero-thumb__name, a.hero-thumb__pill').forEach(function (a) {
                    a.href = href;
                });
            });
        }).catch(function () { /* card keeps the slide's own title */ });
    }

    document.querySelectorAll('.hero-thumb--product').forEach(decorateProductThumb);

    var categoryCards = Array.prototype.slice.call(document.querySelectorAll('[data-hero-category]'));
    if (categoryCards.length) {
        whenSdk(function () {
            if (window.falak.product) fillCategories(categoryCards);
        });
    }

    /* ------------------------------------------------- shop by category */
    // Flip cards: the category's name, photo and sub-categories come from the
    // store; a merchant's own name/photo (data-custom) wins. With no category
    // picked in the section, the cards are built here for every main one.

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    var ARROW = '<svg class="cat-card__arrow" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6"/></svg>';

    function fillCatCard(card, category) {
        var name = card.querySelector('[data-cat-name]');
        if (name && !name.hasAttribute('data-custom')) name.textContent = categoryName(category);

        var image = category.image_url || category.image;
        card.querySelectorAll('[data-cat-image]').forEach(function (img) {
            if (img.hasAttribute('data-custom') || !image) return;
            img.src = image;
            img.hidden = false;
        });

        var href = '/products?category_id[]=' + encodeURIComponent(category.id);
        card.querySelectorAll('a.cat-card__front, a.cat-card__cover, a.cat-card__label').forEach(function (a) {
            a.href = href;
        });

        // The back face lists the picked category's own sub-categories.
        var subs = card.querySelector('[data-cat-subs]');
        var children = Array.isArray(category.children) ? category.children : [];
        if (subs && children.length) {
            renderSubs(subs, children.map(function (child) {
                return { name: categoryName(child), href: '/products?category_id[]=' + encodeURIComponent(child.id) };
            }));
        }
    }

    function renderSubs(list, links) {
        list.innerHTML = links.map(function (link) {
            return '<li><a href="' + escapeHtml(link.href) + '"><span>' + escapeHtml(link.name) + '</span>' + ARROW + '</a></li>';
        }).join('');
        // Like Jalawi, a card with sub-categories has no link of its own
        // behind them — only the links and the name below.
        var card = list.closest('.cat-card');
        if (card) card.classList.toggle('has-subs', links.length > 0);
    }

    function catCardHtml(category, i) {
        var href = '/products?category_id[]=' + encodeURIComponent(category.id);
        var image = category.image_url || category.image || '';
        var img = function (cls) {
            return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + escapeHtml(image) + '" alt="" loading="lazy" data-cat-image' + (image ? '' : ' hidden') + '>';
        };
        return '<div class="cat-card" data-reveal="slide-left" style="--reveal-delay: ' + (100 + i * 80) + 'ms;" data-category-id="' + escapeHtml(category.id) + '">' +
            '<div class="cat-card__inner">' +
                '<a class="cat-card__front" href="' + href + '" tabindex="-1" aria-hidden="true">' + img('') + '</a>' +
                '<div class="cat-card__back">' + img('cat-card__back-img') +
                    '<span class="cat-card__overlay" aria-hidden="true"></span>' +
                    '<a class="cat-card__cover" href="' + href + '" tabindex="-1" aria-hidden="true"></a>' +
                    '<ul class="cat-card__subs" data-cat-subs></ul>' +
                '</div>' +
            '</div>' +
            '<a class="cat-card__label" href="' + href + '"><span class="cat-card__name" data-cat-name>' + escapeHtml(categoryName(category)) + '</span>' + ARROW + '</a>' +
        '</div>';
    }

    var pickedCatCards = Array.prototype.slice.call(document.querySelectorAll('.cat-card[data-category-id]'));
    var autoCatHosts = Array.prototype.slice.call(document.querySelectorAll('[data-cats-auto]'));

    if (pickedCatCards.length || autoCatHosts.length) {
        whenSdk(function () {
            if (!window.falak.product) return;
            loadCategories().then(function (list) {
                var byId = {};
                (function index(items) {
                    items.forEach(function (c) {
                        byId[String(c.id)] = c;
                        if (Array.isArray(c.children)) index(c.children);
                    });
                })(list);

                pickedCatCards.forEach(function (card) {
                    var category = byId[card.getAttribute('data-category-id')];
                    if (category) fillCatCard(card, category);
                });

                var roots = list.filter(function (c) { return c.parent_id === null || c.parent_id === undefined; });
                autoCatHosts.forEach(function (host) {
                    if (!roots.length) return;
                    var limit = parseInt(host.getAttribute('data-limit'), 10);
                    var shown = limit > 0 ? roots.slice(0, limit) : roots;
                    // Built whole, then attached, so <falak-slider> finds its
                    // slides when it connects.
                    var slider = document.createElement('falak-slider');
                    slider.className = 'cats__slider';
                    slider.style.setProperty('--cats-cols', host.getAttribute('data-columns') || '4');
                    if (host.hasAttribute('data-autoplay')) slider.setAttribute('auto-play', '');
                    slider.setAttribute('auto-play-delay', '3000');
                    slider.setAttribute('loop', '');
                    slider.setAttribute('show-controls', 'false');
                    slider.setAttribute('static-when-single', '');
                    slider.innerHTML = shown.map(catCardHtml).join('');
                    slider.querySelectorAll('.cat-card').forEach(function (card, i) { fillCatCard(card, shown[i]); });
                    host.appendChild(slider);
                });
            }).catch(function () { /* cards keep the merchant's own names and photos */ });
        });
    }
})();
