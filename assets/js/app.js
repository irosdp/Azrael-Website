(function () {
  const root = document.documentElement;
  const base = root.dataset.base || ".";
  const page = document.body.dataset.page;
  const storageKey = "azrael_language";

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const path = (value) => base === "." ? value : `${base}/${value}`;
  const pagePath = (value) => base === "." ? value : `${base}/${value}`;

  let siteConfig = {};
  let allSongs = [];
  let i18n = {};
  let currentLanguage = "en";
  let latestCarouselTimer = null;
  const latestCarouselDelay = 6500;

  const platforms = [
    ["youtubeMusicUrl", "YouTube Music"],
    ["spotifyUrl", "Spotify"],
    ["appleMusicUrl", "Apple Music"],
    ["hyperfollowUrl", "HyperFollow"],
    ["youtubeUrl", "YouTube"],
    ["amazonMusicUrl", "Amazon Music"]
  ];

  const icons = {
    youtubeMusicUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5v7l5.6-3.5L10 8.5Z" fill="currentColor"/></svg>',
    youtubeUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 9.2v5.6l4.8-2.8-4.8-2.8Z" fill="currentColor"/></svg>',
    spotifyUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.8 10c2.8-.8 5.9-.5 8.5.9M8.4 12.7c2.2-.6 4.7-.3 6.7.8M9 15.1c1.6-.4 3.3-.2 4.8.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    appleMusicUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 4.5v10.2a3 3 0 1 1-1.8-2.7V7.1L9 8.2v8.1a3 3 0 1 1-1.8-2.7V6.9l9.3-1.9Z" fill="currentColor"/></svg>',
    hyperfollowUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.8 14.2a3.4 3.4 0 0 1 0-4.8l2.1-2.1a3.4 3.4 0 0 1 4.8 4.8l-1.1 1.1M14.2 9.8a3.4 3.4 0 0 1 0 4.8l-2.1 2.1a3.4 3.4 0 0 1-4.8-4.8l1.1-1.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    amazonMusicUrl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5c1.2-1.2 2.9-2 5-2 3 0 5 1.7 5 4.5v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17 15.5c-1.1 1.1-2.8 1.9-5.2 1.9-2.3 0-4-.7-5.1-1.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="16.2" cy="7.8" r="1" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 8.1h2.2V4.8h-2.7c-3 0-4.5 1.8-4.5 4.6v2H6.8v3.5h2.3v5h3.7v-5h3l.5-3.5h-3.5V9.7c0-1 .4-1.6 1.3-1.6Z" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.9 10.4 20.2 3h-1.5l-5.5 6.4L8.8 3H3.8l6.7 9.7L3.5 21h1.5l6.1-7.1 4.9 7.1h5L13.9 10.4Zm-2.1 2.4-.7-1L5.7 4.2h2.4l4.3 6.1.7 1 5.8 8.5h-2.4l-4.7-7Z" fill="currentColor"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 9.2v5.6l4.8-2.8-4.8-2.8Z" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.3 4.8v8.8a4.1 4.1 0 1 1-3.1-4v3.1a1.5 1.5 0 1 0 1 1.4V4.8h2.1c.5 2 1.8 3.4 3.7 4v3.1a7 7 0 0 1-3.7-1.2Z" fill="currentColor"/></svg>',
    music: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 4.5v10.6a3 3 0 1 1-1.9-2.8V7.1L9 8.2v8.1a3 3 0 1 1-1.9-2.8V6.8L16 4.5Z" fill="currentColor"/></svg>'
  };

  const languageAliases = {
    "en": "en",
    "en-us": "en",
    "en-gb": "en",
    "zh": "zh-TW",
    "zh-tw": "zh-TW",
    "zh-hant": "zh-TW",
    "zh-hk": "zh-TW",
    "ja": "ja",
    "ja-jp": "ja",
    "es": "es",
    "es-es": "es",
    "es-mx": "es",
    "pt": "pt-BR",
    "pt-br": "pt-BR",
    "fr": "fr",
    "fr-fr": "fr",
    "de": "de",
    "de-de": "de",
    "id": "id",
    "id-id": "id",
    "in": "id"
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function iconSvg(name) {
    return icons[name] || icons.music;
  }

  function socialIconName(label) {
    const normalized = String(label || "").toLowerCase().replace(/\s+/g, "");
    if (normalized.includes("instagram")) return "instagram";
    if (normalized.includes("facebook")) return "facebook";
    if (normalized === "x" || normalized.includes("twitter")) return "x";
    if (normalized.includes("youtube")) return "youtube";
    if (normalized.includes("tiktok")) return "tiktok";
    return "music";
  }

  function normalizeLanguage(value) {
    if (!value) return "en";
    const lowered = String(value).toLowerCase();
    if (languageAliases[lowered] && i18n[languageAliases[lowered]]) return languageAliases[lowered];
    const primary = lowered.split("-")[0];
    if (languageAliases[primary] && i18n[languageAliases[primary]]) return languageAliases[primary];
    return "en";
  }

  function detectLanguage() {
    const candidates = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate);
      if (normalized !== "en") return normalized;
    }
    return "en";
  }

  function getByKey(source, key) {
    return key.split(".").reduce((value, part) => value && value[part], source);
  }

  function tr(key, replacements = {}) {
    const value = getByKey(i18n[currentLanguage], key) || getByKey(i18n.en, key) || key;
    return String(value).replace(/\{(\w+)\}/g, (_, name) => replacements[name] || "");
  }

  function formatDate(value) {
    if (!value) return "";
    const locale = getByKey(i18n[currentLanguage], "locale") || "en-US";
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`));
  }

  function songDescription(song) {
    return getByKey(i18n[currentLanguage], `songDescriptions.${song.slug}`) || getByKey(i18n.en, `songDescriptions.${song.slug}`) || song.description || "";
  }

  function songUrl(song) {
    return pagePath(`songs/${song.slug}/`);
  }

  function sortSongs(songs, direction = "asc") {
    const sorted = [...songs].sort((a, b) => {
      if (!a.releaseDate && !b.releaseDate) return 0;
      if (!a.releaseDate) return 1;
      if (!b.releaseDate) return -1;
      return a.releaseDate.localeCompare(b.releaseDate);
    });
    if (direction !== "desc") return sorted;
    const dated = sorted.filter((song) => song.releaseDate).reverse();
    return [...dated, ...sorted.filter((song) => !song.releaseDate)];
  }
  function todayKey() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function releasedSongs(songs) {
    const today = todayKey();
    const released = songs.filter((song) => song.releaseDate && song.releaseDate <= today);
    return sortSongs(released.length ? released : songs, "desc");
  }
  function youtubeUrlFor(song) {
    if (song.youtubeUrl) return song.youtubeUrl;
    if (!song.youtubeMusicUrl) return "";

    const match = song.youtubeMusicUrl.match(/(?:[?&]v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
    return match ? `https://youtu.be/${match[1]}` : "";
  }

  function platformHref(song, key) {
    return key === "youtubeUrl" ? youtubeUrlFor(song) : song[key];
  }

  function platformButtons(song) {
    const hasAnyLink = platforms.some(([key]) => platformHref(song, key));
    let activeIndex = 0;
    const buttons = platforms
      .map(([key, label]) => {
        const href = platformHref(song, key);
        if (href) {
          const cls = activeIndex === 0 ? "btn primary" : "btn";
          activeIndex += 1;
          return `<a class="${cls}" href="${escapeHtml(href)}" target="_blank" rel="noopener"><span class="btn-icon">${iconSvg(key)}</span><span>${label}</span></a>`;
        }

        if (key === "youtubeUrl" && hasAnyLink) {
          return `<span class="btn disabled" aria-disabled="true"><span class="btn-icon">${iconSvg(key)}</span><span>${label}</span></span>`;
        }

        return "";
      })
      .filter(Boolean);

    if (buttons.length) return buttons.join("");
    return `<span class="btn disabled" aria-disabled="true">${escapeHtml(tr("home.linksComingSoon"))}</span>`;
  }

  function updateMeta(title, description, image) {
    document.title = title;
    const metaDescription = $('meta[name="description"]');
    if (metaDescription) metaDescription.setAttribute("content", description);

    const pairs = {
      "og:title": title,
      "og:description": description,
      "og:image": image ? path(image) : path("assets/images/brand/azrael-stage-hero.png")
    };

    Object.entries(pairs).forEach(([property, value]) => {
      const tag = $(`meta[property="${property}"]`);
      if (tag) tag.setAttribute("content", value);
    });
  }

  function applyStaticTranslations() {
    root.lang = currentLanguage === "zh-TW" ? "zh-Hant-TW" : currentLanguage;

    $$('[data-i18n]').forEach((node) => {
      node.textContent = tr(node.dataset.i18n);
    });

    $$('[data-i18n-attr]').forEach((node) => {
      node.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":");
        if (attr && key) node.setAttribute(attr, tr(key));
      });
    });

    $$(".site-nav a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (href.includes("index.html")) link.textContent = tr("nav.home");
      if (href.includes("music.html")) link.textContent = tr("nav.music");
      if (href.includes("about.html")) link.textContent = tr("nav.about");
    });

    const brandTagline = $(".brand span");
    if (brandTagline) brandTagline.textContent = tr("common.tagline");

    const skipLink = $(".skip-link");
    if (skipLink) skipLink.textContent = tr("common.skip");
  }

  function renderLanguageSwitcher() {
    const nav = $(".site-nav");
    if (!nav) return;

    let switcher = $(".lang-switcher", nav);
    if (!switcher) {
      switcher = document.createElement("details");
      switcher.className = "lang-switcher";
      nav.appendChild(switcher);
    }

    const buttons = Object.entries(i18n).map(([code, data]) => {
      const current = code === currentLanguage ? ' aria-current="true"' : "";
      return `<button type="button" data-lang="${escapeHtml(code)}"${current}>${escapeHtml(data.label)}</button>`;
    }).join("");

    switcher.innerHTML = `
      <summary aria-label="${escapeHtml(tr("lang.button"))}">${escapeHtml(tr("lang.button"))}</summary>
      <div class="lang-menu" role="menu">${buttons}</div>
    `;

    $$("button[data-lang]", switcher).forEach((button) => {
      button.addEventListener("click", () => {
        setLanguage(button.dataset.lang, true);
        switcher.open = false;
      });
    });
  }

  function maybeShowLanguagePrompt() {
    if (localStorage.getItem(storageKey)) return;
    const detected = detectLanguage();
    if (detected === "en" || !i18n[detected]) return;

    const prompt = document.createElement("div");
    prompt.className = "language-prompt";
    prompt.innerHTML = `
      <div>
        <strong>${escapeHtml(tr("lang.promptTitle"))}</strong>
        <p>${escapeHtml(tr("lang.promptCopy", { language: i18n[detected].label }))}</p>
      </div>
      <div class="prompt-actions">
        <button type="button" data-prompt-lang="${escapeHtml(detected)}">${escapeHtml(i18n[detected].label)}</button>
        <button type="button" data-prompt-lang="en">${escapeHtml(tr("lang.english"))}</button>
      </div>
    `;

    document.body.appendChild(prompt);
    $$("button", prompt).forEach((button) => {
      button.addEventListener("click", () => {
        setLanguage(button.dataset.promptLang, true);
        prompt.remove();
      });
    });
  }

  function renderSongCard(song) {
    return `
      <a class="song-card" href="${songUrl(song)}" aria-label="${escapeHtml(song.title)}">
        <img src="${path(song.coverImage)}" alt="${escapeHtml(song.title)} cover art" loading="lazy">
        <span class="meta">${escapeHtml(song.albumName)} / ${formatDate(song.releaseDate)}</span>
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(songDescription(song))}</p>
      </a>
    `;
  }

  function renderSocialLinks(config) {
    $$('[data-social-links]').forEach((target) => {
      const links = (config.socialLinks || [])
        .map((item) => {
          const disabled = !item.url || item.url === "#";
          const href = disabled ? "#" : item.url;
          const rel = disabled ? "" : ' target="_blank" rel="noopener"';
          const label = escapeHtml(item.label);
          return `<a href="${escapeHtml(href)}"${rel} ${disabled ? 'aria-disabled="true"' : ""}><span class="btn-icon">${iconSvg(socialIconName(item.label))}</span><span>${label}</span></a>`;
        })
        .join("");
      target.innerHTML = links;
    });
  }

  function videoEmbed(url) {
    if (!url) {
      return `
        <div class="video-placeholder">
          <div>
            <p class="eyebrow">${escapeHtml(tr("home.watchEyebrow"))}</p>
            <h3>${escapeHtml(tr("home.watchTitle"))}</h3>
            <p>${escapeHtml(tr("home.heroCopy"))}</p>
          </div>
        </div>
      `;
    }

    const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{6,})/);
    const src = idMatch ? `https://www.youtube-nocookie.com/embed/${idMatch[1]}` : url;
    return `<iframe src="${escapeHtml(src)}" title="Azrael Morathane official video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
  }

  function carouselArrow(direction) {
    const points = direction === "prev" ? "14 7 9 12 14 17" : "10 7 15 12 10 17";
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M${points}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function featureCardMarkup(song, index, total) {
    const count = total > 1 ? `<span class="carousel-count">${index + 1} / ${total}</span>` : "";
    const controls = total > 1 ? `
      <button class="carousel-nav carousel-prev" type="button" aria-label="Previous release" data-carousel-prev>${carouselArrow("prev")}</button>
      <button class="carousel-nav carousel-next" type="button" aria-label="Next release" data-carousel-next>${carouselArrow("next")}</button>
      <div class="carousel-progress" aria-hidden="true"><span></span></div>
    ` : "";

    return `
      <img src="${path(song.coverImage)}" alt="${escapeHtml(song.title)} cover art">
      <div class="feature-copy">
        <span class="meta">${escapeHtml(song.albumName)} / ${formatDate(song.releaseDate)}${count}</span>
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(songDescription(song))}</p>
        <div class="platforms">${platformButtons(song)}</div>
      </div>
      ${controls}
    `;
  }

  function renderLatestCarousel(songs) {
    const latestCard = $("#latest-release-card");
    if (!latestCard) return;

    if (latestCarouselTimer) {
      clearTimeout(latestCarouselTimer);
      latestCarouselTimer = null;
    }

    const carouselSongs = releasedSongs(songs).slice(0, 3);
    if (!carouselSongs.length) return;

    let index = 0;

    const scheduleNext = () => {
      if (latestCarouselTimer) clearTimeout(latestCarouselTimer);
      if (carouselSongs.length <= 1) return;
      latestCarouselTimer = window.setTimeout(() => {
        show(index + 1, "next");
        scheduleNext();
      }, latestCarouselDelay);
    };

    const bindControls = () => {
      const previous = $("[data-carousel-prev]", latestCard);
      const next = $("[data-carousel-next]", latestCard);
      if (previous) previous.addEventListener("click", () => {
        show(index - 1, "prev");
        scheduleNext();
      });
      if (next) next.addEventListener("click", () => {
        show(index + 1, "next");
        scheduleNext();
      });
    };

    function show(nextIndex, direction) {
      index = (nextIndex + carouselSongs.length) % carouselSongs.length;
      latestCard.dataset.direction = direction || "next";
      latestCard.innerHTML = featureCardMarkup(carouselSongs[index], index, carouselSongs.length);
      latestCard.classList.remove("is-sliding");
      void latestCard.offsetWidth;
      latestCard.classList.add("is-sliding");
      bindControls();
    }

    show(0, "next");
    scheduleNext();
  }
  function renderHome(config, songs) {
    const releaseOrder = sortSongs(songs);
    const latest = releasedSongs(songs)[0] || songs.find((song) => song.slug === config.latestReleaseSlug) || releaseOrder[0];
    if (!latest) return;

    updateMeta(tr("meta.homeTitle"), tr("meta.homeDescription"), "assets/images/brand/azrael-stage-hero.png");

    const heroRelease = $("#hero-release");
    if (heroRelease) {
      heroRelease.innerHTML = `
        <div class="release-mini">
          <img src="${path(latest.coverImage)}" alt="${escapeHtml(latest.title)} cover art">
          <div>
            <span class="meta">${escapeHtml(tr("home.latestEyebrow"))} / ${formatDate(latest.releaseDate)}</span>
            <h3>${escapeHtml(latest.title)}</h3>
            <p>${escapeHtml(latest.albumName)}</p>
          </div>
        </div>
        <div class="actions">
          <a class="btn primary" href="${songUrl(latest)}">${escapeHtml(tr("home.listenWatch"))}</a>
          <a class="btn" href="${pagePath("music.html")}">${escapeHtml(tr("home.allMusic"))}</a>
        </div>
      `;
    }

    renderLatestCarousel(songs);

    const homeGrid = $("#home-music-grid");
    if (homeGrid) homeGrid.innerHTML = releaseOrder.slice(0, 6).map(renderSongCard).join("");

    const videoFrame = $("#video-frame");
    if (videoFrame) videoFrame.innerHTML = videoEmbed(config.videoEmbedUrl);
  }

  function renderMusic(songs) {
    updateMeta(tr("meta.musicTitle"), tr("meta.musicDescription"), "assets/images/brand/azrael-stage-hero.png");
    const grid = $("#music-grid");
    if (grid) grid.innerHTML = sortSongs(songs).map(renderSongCard).join("");
  }

  function renderSongPage(songs) {
    const slug = document.body.dataset.songSlug || new URLSearchParams(window.location.search).get("slug");
    const song = songs.find((item) => item.slug === slug);
    const target = $("#song-page");
    if (!target) return;

    if (!song) {
      updateMeta("Song not found | Azrael Morathane", "This Azrael Morathane song page could not be found.");
      target.innerHTML = `
        <section class="section">
          <div class="container empty-state">
            <h1>Song not found</h1>
            <p>The requested song is not listed in data/songs.json.</p>
            <a class="btn primary" href="${pagePath("music.html")}">${escapeHtml(tr("home.allMusic"))}</a>
          </div>
        </section>
      `;
      return;
    }

    const description = songDescription(song);
    updateMeta(`${song.title} | Azrael Morathane`, description, song.coverImage);

    target.innerHTML = `
      <section class="song-hero container">
        <img src="${path(song.coverImage)}" alt="${escapeHtml(song.title)} cover art">
        <div class="song-detail">
          <span class="meta">${escapeHtml(song.albumName)} / ${formatDate(song.releaseDate)}</span>
          <h1>${escapeHtml(song.title)}</h1>
          <p>${escapeHtml(description)}</p>
          <div class="platforms">${platformButtons(song)}</div>
        </div>
      </section>
    `;
  }

  function renderFooterBrand() {
    $$(".site-footer .footer-inner").forEach((footer) => {
      let brand = $(".footer-brand", footer);
      const oldText = Array.from(footer.children).find((child) => child.tagName === "SPAN");
      if (!brand) {
        brand = document.createElement("div");
        brand.className = "footer-brand";
        footer.insertBefore(brand, footer.firstChild);
      }
      if (oldText) oldText.remove();
      brand.innerHTML = `<img src="${path("assets/images/brand/morathane-studio-logo.png")}" alt="Morathane Records logo"><span>${escapeHtml(tr("footer.label"))}</span>`;
    });
  }

  function renderNewsletter(config) {
    const form = $("#newsletter-form");
    if (!form || form.dataset.bound === "true") return;
    form.dataset.bound = "true";

    const settings = config.newsletter || {};
    const input = $('input[type="email"]', form);
    const button = $("button", form);
    const status = $("[data-newsletter-status]", form);
    const honeypot = $('input[name="website"]', form);
    const endpoint = settings.endpoint || "";
    const fieldName = settings.emailFieldName || "email";

    if (input) input.name = fieldName;

    if (!endpoint) {
      if (input) input.disabled = true;
      if (button) button.disabled = true;
      if (status) status.textContent = tr("newsletter.disabled");
      return;
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!input || !button) return;
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }

      if (status) status.textContent = tr("newsletter.sending");
      button.disabled = true;

      const payload = new URLSearchParams();
      payload.append(fieldName, input.value.trim());
      payload.append("source", "azrael_website");
      payload.append("page", window.location.href);
      payload.append("website", honeypot ? honeypot.value : "");

      try {
        if (!honeypot || !honeypot.value) {
          await fetch(endpoint, {
            method: "POST",
            mode: "no-cors",
            body: payload
          });
        }
        form.reset();
        if (status) status.textContent = tr("newsletter.success");
      } catch (error) {
        if (status) status.textContent = tr("newsletter.error");
      } finally {
        button.disabled = false;
      }
    });
  }

  function renderCurrentPage() {
    const publicSongs = allSongs.filter((song) => song.status !== "draft");
    applyStaticTranslations();
    renderLanguageSwitcher();
    renderSocialLinks(siteConfig);
    renderFooterBrand();

    if (page === "home") renderHome(siteConfig, publicSongs);
    if (page === "music") renderMusic(publicSongs);
    if (page === "about") updateMeta(tr("meta.aboutTitle"), tr("meta.aboutDescription"), "assets/images/brand/azrael-stage-hero.png");
    if (page === "song") renderSongPage(publicSongs);
  }

  function setLanguage(language, persist) {
    currentLanguage = i18n[language] ? language : "en";
    if (persist) localStorage.setItem(storageKey, currentLanguage);
    renderCurrentPage();
  }

  async function boot() {
    try {
      const [configResponse, songsResponse, i18nResponse] = await Promise.all([
        fetch(path("data/site-config.json")),
        fetch(path("data/songs.json")),
        fetch(path("data/i18n.json"))
      ]);

      [siteConfig, allSongs, i18n] = await Promise.all([
        configResponse.json(),
        songsResponse.json(),
        i18nResponse.json()
      ]);

      currentLanguage = normalizeLanguage(localStorage.getItem(storageKey)) || "en";
      renderNewsletter(siteConfig);
      renderCurrentPage();
      maybeShowLanguagePrompt();
    } catch (error) {
      console.error(error);
      const target = $("[data-error-target]") || $("main");
      if (target) target.insertAdjacentHTML("afterbegin", '<div class="container empty-state"><p>Site data could not be loaded.</p></div>');
    }
  }

  boot();
})();
