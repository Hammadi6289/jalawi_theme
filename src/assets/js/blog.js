/**
 * Falak Theme — Blog storefront integration.
 * Fetches blogs from /api/storefront/blogs and renders listing (with tag & category filtering),
 * single article (with tags, <custom-falak-blog-comments>, and related articles),
 * and home page blog feeds dynamically matching Jalawi's visual identity.
 */
(function () {
    'use strict';

    var isArabic = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function t(key, fallback) {
        if (window.falak && window.falak.lang && typeof window.falak.lang.get === 'function') {
            var val = window.falak.lang.get(key);
            if (val && val !== key) return val;
        }
        return fallback !== undefined ? fallback : key;
    }

    function formatDate(str) {
        if (!str) return '';
        try {
            var d = new Date(str);
            if (isNaN(d.getTime())) return str;
            return d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return str;
        }
    }

    /*
     * Resolve media URLs safely: featured_image_url can arrive mangled as
     * ".../storage/https://..." when featured_image is already an absolute URL.
     */
    function resolveMedia(value) {
        var s = String(value || '').trim();
        if (!s) return '';
        if (/^(https?:)?[/][/]/i.test(s) || s.indexOf('data:') === 0) return s;
        if (s.charAt(0) === '/') return s;
        return '/storage/' + s.replace(/^[/]+/, '');
    }

    function resolveBlogImage(article) {
        if (!article) return '';
        var stored = String(article.featured_image || '').trim();
        if (stored && /^(https?:)?[/][/]/i.test(stored)) return stored;
        return resolveMedia(article.featured_image_url || article.image_url || article.image || stored);
    }

    /*
     * Parse category name when the endpoint returns a JSON string {"ar": ..., "en": ...}.
     */
    function resolveLabel(value) {
        var pair = value;
        if (typeof pair === 'string') {
            var trimmed = pair.trim();
            if (trimmed.charAt(0) !== '{') return trimmed;
            try { pair = JSON.parse(trimmed); } catch (e) { return trimmed; }
        }
        if (!pair || typeof pair !== 'object') return '';
        var locale = isArabic ? 'ar' : 'en';
        var other = isArabic ? 'en' : 'ar';
        return String(pair[locale] || pair[other] || Object.values(pair).find(Boolean) || '');
    }

    var CALENDAR_SVG = '<svg class="blog-meta__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12ZM4 10h16M8 3v4M16 3v4"/></svg>';
    var AUTHOR_SVG = '<svg class="blog-meta__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/></svg>';
    var ARROW_SVG = '<svg class="blog-read-more__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (isArabic ? 'M19 12H5m6 6-6-6 6-6' : 'M5 12h14m-6-6 6 6-6 6') + '"/></svg>';

    var readMoreLabel = isArabic ? 'اقرأ المزيد' : 'Read more';
    var noArticlesLabel = isArabic ? 'لا توجد مقالات بعد' : 'No articles yet';
    var notFoundLabel = isArabic ? 'المقال غير موجود' : 'Article not found';
    var backToBlogsLabel = isArabic ? 'العودة إلى المدونة' : 'Back to Blog';

    function buildArticleCard(article, isFeature) {
        var url = '/blogs/' + encodeURIComponent(article.slug || article.id);
        var imgUrl = resolveBlogImage(article);
        var altText = escapeHtml(article.featured_image_alt || article.title || '');
        var title = escapeHtml(article.title || '');
        var excerpt = article.excerpt ? escapeHtml(article.excerpt) : '';
        var dateFormatted = formatDate(article.published_at || article.created_at);
        var author = ((article.show_author === undefined || article.show_author) && article.author_name) ? escapeHtml(article.author_name) : '';
        var categoryName = article.category ? resolveLabel(article.category.name) : '';
        var categorySlug = article.category && article.category.slug ? article.category.slug : '';

        var categoryMeta = (categoryName && categorySlug)
            ? '<a class="blog-meta__item blog-meta__category" href="/blogs?category=' + encodeURIComponent(categorySlug) + '">' + escapeHtml(categoryName) + '</a>'
            : '';

        if (isFeature) {
            return '<div class="blog-feature">' +
                '<a class="blog-feature__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                    (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '" loading="eager">' : '<div class="blog-placeholder-img"></div>') +
                '</a>' +
                '<div class="blog-feature__body">' +
                    '<div class="blog-meta">' +
                        (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time dir="ltr">' + dateFormatted + '</time></span>' : '') +
                        (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                        categoryMeta +
                    '</div>' +
                    '<h2 class="blog-feature__title"><a href="' + url + '">' + title + '</a></h2>' +
                    (excerpt ? '<p class="blog-feature__excerpt">' + excerpt + '</p>' : '') +
                    '<a class="blog-read-more" href="' + url + '"><span>' + t('blog.read_more', readMoreLabel) + '</span>' + ARROW_SVG + '</a>' +
                '</div>' +
            '</div>';
        }

        return '<article class="blog-entry">' +
            '<a class="blog-entry__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '" loading="lazy">' : '<div class="blog-placeholder-img"></div>') +
            '</a>' +
            '<div class="blog-entry__body">' +
                '<div class="blog-meta">' +
                    (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time dir="ltr">' + dateFormatted + '</time></span>' : '') +
                    (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                    categoryMeta +
                '</div>' +
                '<h3 class="blog-entry__title"><a href="' + url + '">' + title + '</a></h3>' +
                (excerpt ? '<p class="blog-entry__excerpt">' + excerpt + '</p>' : '') +
                '<a class="blog-read-more" href="' + url + '"><span>' + t('blog.read_more', readMoreLabel) + '</span>' + ARROW_SVG + '</a>' +
            '</div>' +
        '</article>';
    }

    /* ---------------------------------------------------- 1. Blog Listing */
    function initBlogListing() {
        var feed = document.querySelector('[data-blog-feed]');
        if (!feed) return;

        var params = new URLSearchParams(window.location.search);
        var page = params.get('page') || '1';
        var tag = params.get('tag') || '';
        var category = params.get('category') || '';
        var search = params.get('search') || '';

        // If already rendered with server-side articles and no client filter is active, do nothing
        if (!tag && !category && !search && feed.querySelector('.blog-entry, .blog-feature')) return;

        var query = new URLSearchParams();
        query.set('page', page);
        if (tag) query.set('tag', tag);
        if (category) query.set('category', category);
        if (search) query.set('search', search);

        var apiUrl = '/api/storefront/blogs?' + query.toString();

        feed.innerHTML = '<div class="blog-loading"><div class="blog-spinner"></div></div>';

        fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
            .then(function (res) { return res.json(); })
            .then(function (json) {
                var list = [];
                var pagination = null;

                if (json && json.data) {
                    if (Array.isArray(json.data)) {
                        list = json.data;
                    } else if (Array.isArray(json.data.data)) {
                        list = json.data.data;
                        pagination = json.data;
                    }
                }

                var filterBanner = '';
                if (tag || category) {
                    var filterLabel = tag
                        ? t('blog.tagged', isArabic ? 'الوسم:' : 'Tagged:')
                        : t('common.categories', isArabic ? 'التصنيف:' : 'Category:');
                    var filterValue = tag || category;
                    if (!tag && category && list[0] && list[0].category) {
                        filterValue = resolveLabel(list[0].category.name) || category;
                    }
                    filterBanner = '<p class="blog-index__filter">' +
                        escapeHtml(filterLabel) + ' <strong>' + escapeHtml(filterValue) + '</strong> ' +
                        '<a href="/blogs">' + escapeHtml(t('blog.clear_filter', isArabic ? 'إزالة التصفية' : 'Clear filter')) + '</a>' +
                    '</p>';
                }

                if (!list.length) {
                    feed.innerHTML = filterBanner +
                        '<div class="empty-state">' +
                            '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                            '<p>' + escapeHtml(t('blog.none', noArticlesLabel)) + '</p>' +
                        '</div>';
                    return;
                }

                var html = filterBanner;
                // First article as featured header
                html += buildArticleCard(list[0], true);

                // Remaining articles in grid
                if (list.length > 1) {
                    html += '<div class="blog-list">';
                    for (var i = 1; i < list.length; i++) {
                        html += buildArticleCard(list[i], false);
                    }
                    html += '</div>';
                }

                // Pagination preserving tag/category filters
                if (pagination && pagination.last_page > 1) {
                    html += '<nav class="blog-pagination" aria-label="Pagination">';
                    for (var p = 1; p <= pagination.last_page; p++) {
                        var pageParams = new URLSearchParams(window.location.search);
                        pageParams.set('page', String(p));
                        var activeClass = p === pagination.current_page ? ' is-active' : '';
                        html += '<a class="blog-pagination__link' + activeClass + '" href="?' + escapeHtml(pageParams.toString()) + '">' + p + '</a>';
                    }
                    html += '</nav>';
                }

                feed.innerHTML = html;
            })
            .catch(function (err) {
                console.error('[Falak Blog] Failed to load blogs:', err);
                feed.innerHTML = '<div class="empty-state">' +
                    '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                    '<p>' + escapeHtml(t('blog.load_failed', noArticlesLabel)) + '</p>' +
                '</div>';
            });
    }

    /* ---------------------------------------------------- 2. Single Article & Related */
    var RELATED_COUNT = 3;

    function loadRelatedArticles(container, currentId, currentSlug, categorySlug) {
        var relatedSec = container.querySelector('[data-blog-related]');
        var relatedList = container.querySelector('[data-blog-related-list]');
        if (!relatedSec || !relatedList) return;

        function fetchBlogs(paramsStr) {
            return fetch('/api/storefront/blogs?' + paramsStr, { headers: { 'Accept': 'application/json' } })
                .then(function (r) { return r.ok ? r.json() : null; })
                .then(function (json) {
                    if (!json || !json.data) return [];
                    return Array.isArray(json.data) ? json.data : (json.data.data || []);
                })
                .catch(function () { return []; });
        }

        function isNotCurrent(row) {
            if (!row) return false;
            if (currentId && String(row.id) === String(currentId)) return false;
            if (currentSlug && String(row.slug) === String(currentSlug)) return false;
            return true;
        }

        var initialPromise = categorySlug
            ? fetchBlogs('per_page=' + (RELATED_COUNT + 1) + '&category=' + encodeURIComponent(categorySlug))
            : Promise.resolve([]);

        initialPromise.then(function (catRows) {
            var rows = catRows.filter(isNotCurrent);
            if (rows.length >= RELATED_COUNT) {
                return rows.slice(0, RELATED_COUNT);
            }
            return fetchBlogs('per_page=' + (RELATED_COUNT + 2)).then(function (latestRows) {
                var seen = {};
                rows.forEach(function (r) { seen[r.id] = true; });
                latestRows.filter(isNotCurrent).forEach(function (r) {
                    if (rows.length < RELATED_COUNT && !seen[r.id]) {
                        seen[r.id] = true;
                        rows.push(r);
                    }
                });
                return rows.slice(0, RELATED_COUNT);
            });
        }).then(function (finalRows) {
            if (!finalRows || !finalRows.length) return;
            relatedList.innerHTML = finalRows.map(function (art) {
                return buildArticleCard(art, false);
            }).join('');
            relatedSec.hidden = false;
        });
    }

    function initBlogSingle() {
        var container = document.querySelector('[data-blog-single]');
        if (!container) return;

        // Extract slug from URL: /blogs/{slug} or /blog/{slug}
        var path = window.location.pathname.replace(/\/+$/, '');
        var urlSlug = decodeURIComponent(path.split('/').pop() || '');

        // If already rendered with server-side article, just load related posts and ensure comments slug
        if (container.querySelector('.blog-article__title')) {
            var srvId = container.getAttribute('data-article-id') || '';
            var srvSlug = container.getAttribute('data-article-slug') || urlSlug;
            var srvCat = container.getAttribute('data-article-category') || '';
            var commentsEl = container.querySelector('custom-falak-blog-comments');
            if (!commentsEl && srvSlug) {
                var articleContent = container.querySelector('.blog-article-content');
                if (articleContent) {
                    var ce = document.createElement('custom-falak-blog-comments');
                    ce.setAttribute('slug', srvSlug);
                    articleContent.appendChild(ce);
                }
            }
            loadRelatedArticles(container, srvId, srvSlug, srvCat);
            return;
        }

        if (!urlSlug || urlSlug === 'blogs' || urlSlug === 'blog') return;

        container.innerHTML = '<div class="blog-loading"><div class="blog-spinner"></div></div>';

        var apiUrl = '/api/storefront/blogs/' + encodeURIComponent(urlSlug);

        fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
            .then(function (res) {
                if (!res.ok) throw new Error('Not found');
                return res.json();
            })
            .then(function (json) {
                var article = json && json.data ? json.data : null;
                if (!article || !article.title) throw new Error('Invalid article data');

                var title = escapeHtml(article.title);
                var excerpt = article.excerpt ? escapeHtml(article.excerpt) : '';
                var content = article.content || '';
                var imgUrl = resolveBlogImage(article);
                var altText = escapeHtml(article.featured_image_alt || article.title || '');
                var dateFormatted = formatDate(article.published_at || article.created_at);
                var author = ((article.show_author === undefined || article.show_author) && article.author_name) ? escapeHtml(article.author_name) : '';
                var categoryName = article.category ? resolveLabel(article.category.name) : '';
                var categorySlug = article.category && article.category.slug ? article.category.slug : '';
                var tags = Array.isArray(article.tags) ? article.tags : [];
                var articleSlug = article.slug || urlSlug;

                // Update document title
                document.title = article.title + ' — ' + (document.title.split('—').pop().trim() || 'Store');

                var tagsHtml = tags.length
                    ? '<ul class="blog-post__tags">' +
                        tags.map(function (tag) {
                            return '<li><a href="/blogs?tag=' + encodeURIComponent(tag) + '"><span aria-hidden="true">#</span>' + escapeHtml(tag) + '</a></li>';
                        }).join('') +
                      '</ul>'
                    : '';

                var categoryHtml = (categoryName && categorySlug)
                    ? '<span class="blog-meta__sep">|</span><a class="blog-meta__item blog-meta__category" href="/blogs?category=' + encodeURIComponent(categorySlug) + '">' + escapeHtml(categoryName) + '</a>'
                    : '';

                var html = '<nav class="blog-page__crumbs">' +
                    '<a href="/">' + escapeHtml(t('common.home', isArabic ? 'الرئيسية' : 'Home')) + '</a>' +
                    '<span class="blog-crumbs__sep">/</span>' +
                    '<a href="/blogs">' + escapeHtml(t('blog.title', isArabic ? 'المدونة' : 'Blog')) + '</a>' +
                    '<span class="blog-crumbs__sep">/</span>' +
                    '<span>' + title + '</span>' +
                '</nav>' +
                '<article class="blog-article-content">' +
                    '<header class="blog-article__head">' +
                        '<div class="blog-meta blog-meta--center">' +
                            (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time dir="ltr">' + dateFormatted + '</time></span>' : '') +
                            (dateFormatted && author ? '<span class="blog-meta__sep">|</span>' : '') +
                            (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                            categoryHtml +
                        '</div>' +
                        '<h1 class="blog-article__title">' + title + '</h1>' +
                        (excerpt ? '<p class="blog-article__excerpt">' + excerpt + '</p>' : '') +
                    '</header>' +
                    (imgUrl ? '<div class="blog-article__cover"><img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '"></div>' : '') +
                    '<div class="blog-article__body prose">' + content + '</div>' +
                    tagsHtml +
                    '<div class="blog-article__footer">' +
                        '<falak-social mode="share" class="blog-article__share" share-text="' + title + '"></falak-social>' +
                        '<div class="blog-article__back">' +
                            '<a class="btn btn--outline" href="/blogs">' + escapeHtml(t('blog.title', backToBlogsLabel)) + '</a>' +
                        '</div>' +
                    '</div>' +
                    '<custom-falak-blog-comments slug="' + escapeHtml(articleSlug) + '"></custom-falak-blog-comments>' +
                '</article>' +
                '<section class="blog-article__related" data-blog-related hidden>' +
                    '<h2 class="blog-article__related-title">' + escapeHtml(t('blog.related', isArabic ? 'مقالات ذات صلة' : 'Related articles')) + '</h2>' +
                    '<div class="blog-list" data-blog-related-list></div>' +
                '</section>';

                container.innerHTML = html;
                loadRelatedArticles(container, article.id, articleSlug, categorySlug);
            })
            .catch(function (err) {
                console.error('[Falak Blog] Failed to load article:', err);
                container.innerHTML = '<div class="empty-state">' +
                    '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                    '<p>' + escapeHtml(t('blog.not_found', notFoundLabel)) + '</p>' +
                    '<a class="btn btn--outline" href="/blogs">' + escapeHtml(t('blog.title', backToBlogsLabel)) + '</a>' +
                '</div>';
            });
    }

    /* ---------------------------------------------------- 3. Home Page Component */
    function initBlogHomeFeed() {
        var feeds = document.querySelectorAll('[data-blog-home-feed]');
        if (!feeds.length) return;

        fetch('/api/storefront/blogs?per_page=12', { headers: { 'Accept': 'application/json' } })
            .then(function (res) { return res.json(); })
            .then(function (json) {
                var list = [];
                if (json && json.data) {
                    list = Array.isArray(json.data) ? json.data : (json.data.data || []);
                }
                if (!list.length) return;

                feeds.forEach(function (feed) {
                    var readMore = feed.getAttribute('data-read-more') || t('blog.read_more', readMoreLabel);
                    var limit = parseInt(feed.getAttribute('data-limit'), 10) || 4;
                    var items = list.slice(0, limit);

                    feed.innerHTML = items.map(function (article, index) {
                        var url = '/blogs/' + encodeURIComponent(article.slug || article.id);
                        var imgUrl = resolveBlogImage(article);
                        var title = escapeHtml(article.title || '');
                        var excerpt = article.excerpt ? escapeHtml(article.excerpt) : '';
                        var dateFormatted = formatDate(article.published_at || article.created_at);

                        return '<article class="blog-card" data-reveal="slide-left" style="--reveal-delay: ' + (100 + index * 100) + 'ms;">' +
                            '<a class="blog-card__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                                (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + title + '" loading="lazy">' : '<div class="blog-placeholder-img"></div>') +
                            '</a>' +
                            '<div class="blog-card__body">' +
                                (dateFormatted ? '<p class="blog-card__date"><span dir="ltr">' + dateFormatted + '</span></p>' : '') +
                                '<h3 class="blog-card__title"><a href="' + url + '">' + title + '</a></h3>' +
                                (excerpt ? '<p class="blog-card__excerpt">' + excerpt + '</p>' : '') +
                                '<a class="blog-card__more" href="' + url + '">' + escapeHtml(readMore) + '</a>' +
                            '</div>' +
                        '</article>';
                    }).join('');
                });
            })
            .catch(function (err) {
                console.error('[Falak Blog] Home feed error:', err);
            });
    }

    /* ---------------------------------------------------- 4. <custom-falak-blog-comments> */
    if (window.customElements && !customElements.get('custom-falak-blog-comments')) {
        class CustomFalakBlogComments extends HTMLElement {
            connectedCallback() {
                if (!window.falak) return;

                window.falak.onReady(() => {
                    this.load();
                    this._offIn = window.falak.event.on('auth::logged.in', () => this.render());
                    this._offOut = window.falak.event.on('auth::logged.out', () => this.render());
                });
            }

            disconnectedCallback() {
                if (typeof this._offIn === 'function') this._offIn();
                if (typeof this._offOut === 'function') this._offOut();
            }

            escape(v) {
                return escapeHtml(v);
            }

            get slug() {
                return this.getAttribute('slug') || '';
            }

            async load() {
                const falak = window.falak;
                if (!this.slug) return;

                try {
                    const response = await falak.api.withoutNotifier(
                        () => falak.api.request('blogs/' + encodeURIComponent(this.slug) + '/comments', {
                            params: { per_page: 50 },
                        })
                    );

                    const payload = (response && response.data) || response;
                    this.comments = Array.isArray(payload) ? payload : ((payload && payload.data) || []);
                } catch (e) {
                    if (falak.logger) falak.logger.warn('custom-falak-blog-comments: fetch failed', e);
                    this.comments = [];
                }

                this.render();
            }

            date(value) {
                return formatDate(value);
            }

            initial(name) {
                const trimmed = String(name || '').trim();
                return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
            }

            render() {
                const falak = window.falak;
                const tr = key => falak.lang.get(key);
                const rows = this.comments || [];

                const list = rows.length
                    ? '<ul class="blog-comments__list">'
                        + rows.map(row =>
                            '<li class="blog-comment">'
                                + '<span class="blog-comment__avatar" aria-hidden="true">'
                                    + this.escape(this.initial(row.author_name))
                                + '</span>'
                                + '<div class="blog-comment__body">'
                                    + '<p class="blog-comment__meta">'
                                        + '<span class="blog-comment__author">'
                                            + this.escape(row.author_name || tr('blog.comment_anonymous'))
                                        + '</span>'
                                        + (this.date(row.created_at)
                                            ? '<span class="blog-comment__date" dir="ltr">' + this.escape(this.date(row.created_at)) + '</span>'
                                            : '')
                                    + '</p>'
                                    + '<p class="blog-comment__text">' + this.escape(row.comment) + '</p>'
                                + '</div>'
                            + '</li>').join('')
                      + '</ul>'
                    : '<p class="blog-comments__empty">' + this.escape(tr('blog.comments_none')) + '</p>';

                const form = falak.auth.isLoggedIn()
                    ? '<form class="blog-comments__form">'
                        + '<textarea class="blog-comments__input" name="comment" rows="4" maxlength="2000"'
                            + ' placeholder="' + this.escape(tr('blog.comment_placeholder')) + '" required></textarea>'
                        + '<p class="blog-comments__status" role="status" hidden></p>'
                        + '<button type="submit" class="btn btn--primary blog-comments__submit">'
                            + this.escape(tr('blog.comment_submit'))
                        + '</button>'
                      + '</form>'
                    : '<div class="blog-comments__signin">'
                        + '<p>' + this.escape(tr('blog.comment_signin')) + '</p>'
                        + '<button type="button" class="btn btn--primary blog-comments__signin-btn">'
                            + this.escape(tr('auth.login'))
                        + '</button>'
                      + '</div>';

                this.innerHTML =
                    '<section class="blog-comments">'
                        + '<h2 class="blog-comments__title">'
                            + this.escape(tr('blog.comments'))
                            + (rows.length ? ' <span class="blog-comments__count">' + rows.length + '</span>' : '')
                        + '</h2>'
                        + list
                        + form
                    + '</section>';

                this.wire();
            }

            wire() {
                const falak = window.falak;

                const signin = this.querySelector('.blog-comments__signin-btn');
                if (signin) {
                    signin.addEventListener('click', () => {
                        falak.event.dispatch('login::open');
                        falak.event.dispatch('auth::required');
                    });
                    return;
                }

                const form = this.querySelector('.blog-comments__form');
                if (!form) return;

                form.addEventListener('submit', async event => {
                    event.preventDefault();

                    const input = form.querySelector('.blog-comments__input');
                    const button = form.querySelector('.blog-comments__submit');
                    const status = form.querySelector('.blog-comments__status');
                    const comment = String(input.value || '').trim();

                    if (comment.length < 2) return;

                    button.disabled = true;
                    status.hidden = true;

                    try {
                        const response = await falak.api.request('/api/customer/blog-comments', {
                            method: 'post',
                            body: { slug: this.slug, comment },
                        });

                        const created = (response && response.data) || response;
                        input.value = '';

                        if (created && created.is_approved === false) {
                            status.textContent = falak.lang.get('blog.comment_pending');
                            status.hidden = false;
                        } else {
                            this.comments = (this.comments || []).concat(created || []);
                            this.render();
                        }
                    } catch (e) {
                        status.textContent = falak.lang.get('blog.comment_failed');
                        status.hidden = false;
                    } finally {
                        if (button.isConnected) button.disabled = false;
                    }
                });
            }
        }

        customElements.define('custom-falak-blog-comments', CustomFalakBlogComments);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            initBlogListing();
            initBlogSingle();
            initBlogHomeFeed();
        });
    } else {
        initBlogListing();
        initBlogSingle();
        initBlogHomeFeed();
    }
})();
