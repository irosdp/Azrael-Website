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

  const platforms = [
    ["youtubeMusicUrl", "YouTube Music"],
    ["spotifyUrl", "Spotify"],
    ["appleMusicUrl", "Apple Music"],
    ["hyperfollowUrl", "HyperFollow"],
    ["youtubeUrl", "YouTube"],
    ["amazonMusicUrl", "Amazon Music"]
  ];

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
    const sorted = [...songs].sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
    return direction === "desc" ? sorted.reverse() : sorted;
  }

  function platformButtons(song) {
    const active = platforms
      .filter(([key]) => song[key])
      .map(([key, label], index) => {
        const cls = index === 0 ? "btn primary" : "btn";
        return `<a class="${cls}" href="${escapeHtml(song[key])}" target="_blank" rel="noopener">${label}</a>`;
      });

    if (active.length) return active.join("");
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
          return `<a href="${escapeHtml(href)}"${rel} ${disabled ? 'aria-disabled="true"' : ""}>${label}</a>`;
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

  function renderHome(config, songs) {
    const releaseOrder = sortSongs(songs);
    const latest = songs.find((song) => song.slug === config.latestReleaseSlug) || releaseOrder[0];
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

    const latestCard = $("#latest-release-card");
    if (latestCard) {
      latestCard.innerHTML = `
        <img src="${path(latest.coverImage)}" alt="${escapeHtml(latest.title)} cover art">
        <div class="feature-copy">
          <span class="meta">${escapeHtml(latest.albumName)} / ${formatDate(latest.releaseDate)}</span>
          <h3>${escapeHtml(latest.title)}</h3>
          <p>${escapeHtml(songDescription(latest))}</p>
          <div class="platforms">${platformButtons(latest)}</div>
        </div>
      `;
    }

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
    applyStaticTranslations();
    renderLanguageSwitcher();
    renderSocialLinks(siteConfig);
    renderFooterBrand();

    if (page === "home") renderHome(siteConfig, allSongs);
    if (page === "music") renderMusic(allSongs);
    if (page === "about") updateMeta(tr("meta.aboutTitle"), tr("meta.aboutDescription"), "assets/images/brand/azrael-stage-hero.png");
    if (page === "song") renderSongPage(allSongs);
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