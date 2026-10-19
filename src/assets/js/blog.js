/**
 * Falak Theme — Blog storefront integration.
 * Fetches blogs from /api/storefront/blogs and renders listing, single article,
 * and home page blog feeds dynamically matching the Falak dashboard.
 */
(function () {
    'use strict';

    var isArabic = document.documentElement.lang === 'ar' || document.documentElement.dir === 'rtl';

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function formatDate(str) {
        if (!str) return '';
        try {
            var d = new Date(str);
            if (isNaN(d.getTime())) return str;
            return d.toLocaleDateString(isArabic ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            return str;
        }
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
        var imgUrl = article.featured_image_url || article.image_url || article.image || '';
        var altText = escapeHtml(article.featured_image_alt || article.title || '');
        var title = escapeHtml(article.title || '');
        var excerpt = article.excerpt ? escapeHtml(article.excerpt) : '';
        var dateFormatted = formatDate(article.published_at || article.created_at);
        var author = (article.show_author && article.author_name) ? escapeHtml(article.author_name) : '';

        if (isFeature) {
            return '<div class="blog-feature">' +
                '<a class="blog-feature__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                    (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '" loading="eager">' : '<div class="blog-placeholder-img"></div>') +
                '</a>' +
                '<div class="blog-feature__body">' +
                    '<div class="blog-meta">' +
                        (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time>' + dateFormatted + '</time></span>' : '') +
                        (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                    '</div>' +
                    '<h2 class="blog-feature__title"><a href="' + url + '">' + title + '</a></h2>' +
                    (excerpt ? '<p class="blog-feature__excerpt">' + excerpt + '</p>' : '') +
                    '<a class="blog-read-more" href="' + url + '"><span>' + readMoreLabel + '</span>' + ARROW_SVG + '</a>' +
                '</div>' +
            '</div>';
        }

        return '<article class="blog-entry">' +
            '<a class="blog-entry__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '" loading="lazy">' : '<div class="blog-placeholder-img"></div>') +
            '</a>' +
            '<div class="blog-entry__body">' +
                '<div class="blog-meta">' +
                    (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time>' + dateFormatted + '</time></span>' : '') +
                    (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                '</div>' +
                '<h3 class="blog-entry__title"><a href="' + url + '">' + title + '</a></h3>' +
                (excerpt ? '<p class="blog-entry__excerpt">' + excerpt + '</p>' : '') +
                '<a class="blog-read-more" href="' + url + '"><span>' + readMoreLabel + '</span>' + ARROW_SVG + '</a>' +
            '</div>' +
        '</article>';
    }

    /* ---------------------------------------------------- 1. Blog Listing */
    function initBlogListing() {
        var feed = document.querySelector('[data-blog-feed]');
        if (!feed) return;

        // If already rendered with server-side articles, do nothing
        if (feed.querySelector('.blog-entry, .blog-feature')) return;

        var params = new URLSearchParams(window.location.search);
        var page = params.get('page') || '1';
        var apiUrl = '/api/storefront/blogs?page=' + encodeURIComponent(page);

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

                if (!list.length) {
                    feed.innerHTML = '<div class="empty-state">' +
                        '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                        '<p>' + noArticlesLabel + '</p>' +
                    '</div>';
                    return;
                }

                var html = '';
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

                // Pagination
                if (pagination && pagination.last_page > 1) {
                    html += '<nav class="blog-pagination" aria-label="Pagination">';
                    for (var p = 1; p <= pagination.last_page; p++) {
                        var activeClass = p === pagination.current_page ? ' is-active' : '';
                        html += '<a class="blog-pagination__link' + activeClass + '" href="?page=' + p + '">' + p + '</a>';
                    }
                    html += '</nav>';
                }

                feed.innerHTML = html;
            })
            .catch(function (err) {
                console.error('[Falak Blog] Failed to load blogs:', err);
                feed.innerHTML = '<div class="empty-state">' +
                    '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                    '<p>' + noArticlesLabel + '</p>' +
                '</div>';
            });
    }

    /* ---------------------------------------------------- 2. Single Article */
    function initBlogSingle() {
        var container = document.querySelector('[data-blog-single]');
        if (!container) return;

        // If already rendered with server-side article, do nothing
        if (container.querySelector('.blog-article__title')) return;

        // Extract slug from URL: /blogs/{slug} or /blog/{slug}
        var path = window.location.pathname.replace(/\/+$/, '');
        var slug = path.split('/').pop();

        if (!slug || slug === 'blogs' || slug === 'blog') return;

        container.innerHTML = '<div class="blog-loading"><div class="blog-spinner"></div></div>';

        var apiUrl = '/api/storefront/blogs/' + encodeURIComponent(slug);

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
                var imgUrl = article.featured_image_url || article.image_url || article.image || '';
                var altText = escapeHtml(article.featured_image_alt || article.title || '');
                var dateFormatted = formatDate(article.published_at || article.created_at);
                var author = (article.show_author && article.author_name) ? escapeHtml(article.author_name) : '';

                // Update document title
                document.title = article.title + ' — ' + (document.title.split('—').pop().trim() || 'Store');

                var html = '<nav class="blog-page__crumbs">' +
                    '<a href="/">' + (isArabic ? 'الرئيسية' : 'Home') + '</a>' +
                    '<span class="blog-crumbs__sep">/</span>' +
                    '<a href="/blogs">' + (isArabic ? 'المدونة' : 'Blog') + '</a>' +
                    '<span class="blog-crumbs__sep">/</span>' +
                    '<span>' + title + '</span>' +
                '</nav>' +
                '<article class="blog-article-content">' +
                    '<header class="blog-article__head">' +
                        '<div class="blog-meta blog-meta--center">' +
                            (dateFormatted ? '<span class="blog-meta__item">' + CALENDAR_SVG + '<time>' + dateFormatted + '</time></span>' : '') +
                            (dateFormatted && author ? '<span class="blog-meta__sep">|</span>' : '') +
                            (author ? '<span class="blog-meta__item">' + AUTHOR_SVG + '<span>' + author + '</span></span>' : '') +
                        '</div>' +
                        '<h1 class="blog-article__title">' + title + '</h1>' +
                        (excerpt ? '<p class="blog-article__excerpt">' + excerpt + '</p>' : '') +
                    '</header>' +
                    (imgUrl ? '<div class="blog-article__cover"><img src="' + escapeHtml(imgUrl) + '" alt="' + altText + '"></div>' : '') +
                    '<div class="blog-article__body prose">' + content + '</div>' +
                    '<div class="blog-article__footer">' +
                        '<falak-social mode="share" class="blog-article__share" share-text="' + title + '"></falak-social>' +
                        '<div class="blog-article__back">' +
                            '<a class="btn btn--outline" href="/blogs">' + backToBlogsLabel + '</a>' +
                        '</div>' +
                    '</div>' +
                '</article>';

                container.innerHTML = html;
            })
            .catch(function (err) {
                console.error('[Falak Blog] Failed to load article:', err);
                container.innerHTML = '<div class="empty-state">' +
                    '<div class="empty-state__icon" aria-hidden="true">📝</div>' +
                    '<p>' + notFoundLabel + '</p>' +
                    '<a class="btn btn--outline" href="/blogs">' + backToBlogsLabel + '</a>' +
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
                    var readMore = feed.getAttribute('data-read-more') || readMoreLabel;
                    var limit = parseInt(feed.getAttribute('data-limit'), 10) || 4;
                    var items = list.slice(0, limit);

                    feed.innerHTML = items.map(function (article, index) {
                        var url = '/blogs/' + encodeURIComponent(article.slug || article.id);
                        var imgUrl = article.featured_image_url || article.image_url || article.image || '';
                        var title = escapeHtml(article.title || '');
                        var excerpt = article.excerpt ? escapeHtml(article.excerpt) : '';
                        var dateFormatted = formatDate(article.published_at || article.created_at);

                        return '<article class="blog-card" data-reveal="slide-left" style="--reveal-delay: ' + (100 + index * 100) + 'ms;">' +
                            '<a class="blog-card__media" href="' + url + '" tabindex="-1" aria-hidden="true">' +
                                (imgUrl ? '<img src="' + escapeHtml(imgUrl) + '" alt="' + title + '" loading="lazy">' : '<div class="blog-placeholder-img"></div>') +
                            '</a>' +
                            '<div class="blog-card__body">' +
                                (dateFormatted ? '<p class="blog-card__date">' + dateFormatted + '</p>' : '') +
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
