(function () {
  "use strict";

  const repository = {
    owner: "irosdp",
    name: "Azrael-Website",
    branch: "main"
  };

  const files = {
    songs: "data/songs.json",
    site: "data/site-config.json",
    translations: "data/i18n.json",
    requests: "data/link-requests.json",
    candidates: "data/link-candidates.json"
  };

  const platformDefinitions = [
    { provider: "youtubeMusic", field: "youtubeMusicUrl", label: "YouTube Music" },
    { provider: "spotify", field: "spotifyUrl", label: "Spotify" },
    { provider: "appleMusic", field: "appleMusicUrl", label: "Apple Music" },
    { provider: "youtube", field: "youtubeUrl", label: "YouTube" },
    { provider: "amazonMusic", field: "amazonMusicUrl", label: "Amazon Music" },
    { provider: "hyperfollow", field: "hyperfollowUrl", label: "HyperFollow" }
  ];

  const state = {
    songs: [],
    site: {},
    i18n: {},
    requests: { version: 1, requests: {} },
    candidates: { version: 1, songs: {} },
    selectedSongId: "",
    translationLanguage: "zh-TW",
    translationSection: "home",
    activeTab: "songs",
    token: sessionStorage.getItem("azrael_admin_token") || "",
    githubUser: "",
    dirty: { songs: false, site: false, translations: false },
    pendingCovers: new Map(),
    pollTimer: null
  };

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function editorId() {
    return globalThis.crypto?.randomUUID?.() || `song-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function addEditorMetadata(song) {
    return {
      ...song,
      __editorId: song.__editorId || editorId(),
      __originalSlug: song.__originalSlug ?? song.slug ?? ""
    };
  }

  function cleanForJson(value) {
    if (Array.isArray(value)) return value.map(cleanForJson);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith("__"))
        .map(([key, child]) => [key, cleanForJson(child)])
    );
  }

  function jsonText(value) {
    return `${JSON.stringify(cleanForJson(value), null, 2)}\n`;
  }

  function toast(message, tone = "neutral") {
    const region = $("#toast-region");
    const node = document.createElement("div");
    node.className = `toast ${tone}`;
    node.textContent = message;
    region.appendChild(node);
    window.setTimeout(() => node.remove(), 4800);
  }

  function setConnection(label, tone = "neutral") {
    const target = $("#connection-state");
    target.textContent = label;
    target.dataset.tone = tone;
    $("#open-auth").textContent = state.githubUser ? state.githubUser : "連接 GitHub";
    updateSaveButton();
  }

  function updateSaveButton() {
    const button = $("#save-current");
    const dirty = state.dirty[state.activeTab];
    button.disabled = !state.token || !dirty;
    button.textContent = dirty ? "儲存變更" : "已儲存";
  }

  function markDirty(area, dirty = true) {
    state.dirty[area] = dirty;
    updateSaveButton();
    if (area === "songs") renderSongList();
  }

  async function loadJson(path, fallback) {
    try {
      const response = await fetch(`../${path}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (fallback !== undefined) return deepClone(fallback);
      throw new Error(`無法讀取 ${path}：${error.message}`);
    }
  }

  function switchTab(tab) {
    state.activeTab = tab;
    $$('[data-tab]').forEach((button) => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
    $$('[data-panel]').forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === tab));
    updateSaveButton();
  }

  function selectedSong() {
    return state.songs.find((song) => song.__editorId === state.selectedSongId) || null;
  }

  function songStatus(song) {
    if (song.status === "draft") return "草稿";
    if (song.releaseDate && song.releaseDate > new Date().toISOString().slice(0, 10)) return "預定";
    return "已發布";
  }

  function renderSongList() {
    const list = $("#song-list");
    const query = $("#song-search").value.trim().toLocaleLowerCase();
    const songs = [...state.songs]
      .filter((song) => `${song.title} ${song.slug}`.toLocaleLowerCase().includes(query))
      .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)));

    list.innerHTML = songs.map((song) => {
      const current = song.__editorId === state.selectedSongId ? ' aria-current="true"' : "";
      const cover = song.coverImage ? `../${escapeHtml(song.coverImage)}` : "../assets/images/brand/azrael-hero.png";
      return `
        <button type="button" data-song-id="${escapeHtml(song.__editorId)}"${current}>
          <img src="${cover}" alt="" loading="lazy">
          <span><strong>${escapeHtml(song.title || "未命名歌曲")}</strong><small>${escapeHtml(song.releaseDate || "未設定日期")} · ${escapeHtml(song.slug || "尚無 slug")}</small></span>
          <span class="status-chip ${song.status === "draft" ? "requested" : "ready"}">${songStatus(song)}</span>
        </button>
      `;
    }).join("") || '<p class="field-note" style="padding: 1rem">沒有符合的歌曲。</p>';

    $$('[data-song-id]', list).forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedSongId = button.dataset.songId;
        renderSongList();
        renderSongEditor();
      });
    });
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70);
  }

  function currentCoverSource(song) {
    const pending = state.pendingCovers.get(song.__editorId);
    if (pending?.objectUrl) return pending.objectUrl;
    return song.coverImage ? `../${song.coverImage}` : "../assets/images/brand/azrael-hero.png";
  }

  function platformFieldsMarkup(song) {
    return platformDefinitions.map(({ field, label }) => `
      <label class="field-wide">
        <span>${label}</span>
        <input type="url" data-song-field="${field}" value="${escapeHtml(song[field])}" placeholder="https://">
      </label>
    `).join("");
  }

  function lookupStatusMarkup(song) {
    const request = state.requests.requests?.[song.slug];
    const result = state.candidates.songs?.[song.slug];
    const status = result?.status || request?.status || "idle";
    const labels = {
      idle: "尚未搜尋",
      requested: "等待背景搜尋",
      searching: "搜尋中",
      ready: "候選已就緒",
      partial: "部分候選已就緒",
      error: "搜尋失敗"
    };
    return `<span class="status-chip ${escapeHtml(status)}">${escapeHtml(labels[status] || status)}</span>`;
  }

  function renderSongEditor() {
    const editor = $("#song-editor");
    const song = selectedSong();
    if (!song) {
      editor.innerHTML = '<div class="empty-editor"><div><p class="eyebrow">Music catalog</p><h1>選一首歌開始編輯</h1><p>新增歌曲後先儲存草稿，再按「自動尋找平台連結」。候選結果會留在這裡等你確認。</p></div></div>';
      return;
    }

    const hasSavedSlug = Boolean(song.__originalSlug);
    const isDirty = state.dirty.songs;
    editor.innerHTML = `
      <div class="editor-title-row">
        <div>
          <p class="eyebrow">Song editor</p>
          <h1>${escapeHtml(song.title || "未命名歌曲")}</h1>
          <p>${escapeHtml(song.slug || "先設定 slug")}</p>
        </div>
        <div class="editor-actions">
          <button class="button secondary" id="preview-current-links" type="button">預覽目前連結</button>
          <button class="button primary" id="request-link-search" type="button" ${!state.token || !hasSavedSlug || isDirty ? "disabled" : ""}>自動尋找平台連結</button>
          <button class="button danger" id="delete-song" type="button">刪除歌曲</button>
        </div>
      </div>

      <form class="song-form" id="song-form">
        <section class="form-section">
          <h2>歌曲資料</h2>
          <div class="form-grid">
            <label><span>歌名</span><input data-song-field="title" value="${escapeHtml(song.title)}" required></label>
            <label><span>網址 slug</span><input data-song-field="slug" value="${escapeHtml(song.slug)}" pattern="[a-z0-9-]+" required><small class="field-note">只能使用小寫英文字母、數字與連字號。</small></label>
            <label><span>發售日期</span><input type="date" data-song-field="releaseDate" value="${escapeHtml(song.releaseDate)}" required></label>
            <label><span>狀態</span><select data-song-field="status"><option value="draft" ${song.status === "draft" ? "selected" : ""}>草稿，不在前台顯示</option><option value="published" ${song.status !== "draft" ? "selected" : ""}>發布／預定發布</option></select></label>
            <label><span>專輯名稱</span><input data-song-field="albumName" value="${escapeHtml(song.albumName)}"></label>
            <label><span>ISRC</span><input data-song-field="isrc" value="${escapeHtml(song.isrc)}" maxlength="15" placeholder="例如 QZ…"><small class="field-note">建議填寫，平台比對會準確很多。</small></label>
            <label class="field-wide"><span>英文簡介（其他語言在「多國文字」編輯）</span><textarea data-song-field="description">${escapeHtml(song.description)}</textarea></label>
          </div>
        </section>

        <section class="form-section">
          <h2>封面</h2>
          <div class="cover-field">
            <img class="cover-preview" id="cover-preview" src="${escapeHtml(currentCoverSource(song))}" alt="歌曲封面預覽">
            <div class="form-grid">
              <label><span>網站路徑</span><input data-song-field="coverImage" value="${escapeHtml(song.coverImage)}" placeholder="assets/images/covers/song.png"></label>
              <label><span>上傳新封面</span><input id="cover-upload" type="file" accept="image/png,image/jpeg,image/webp"><small class="field-note">儲存時會上傳到 assets/images/covers/。</small></label>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h2>平台連結</h2>
          <div class="form-grid platform-fields">${platformFieldsMarkup(song)}</div>
        </section>
      </form>

      <section class="lookup-panel" id="lookup-panel">
        <div class="candidate-heading">
          <div><p class="eyebrow">Link finder</p><h2>平台候選結果</h2></div>
          ${lookupStatusMarkup(song)}
        </div>
        <p class="lookup-note">搜尋結果不會自動發布。請先播放或開啟預覽，再按「採用這個連結」；確認後仍需儲存歌曲。</p>
        <div id="candidate-results"></div>
      </section>
    `;

    bindSongEditor(song);
    renderCandidates(song);
  }

  function bindSongEditor(song) {
    $$('[data-song-field]', $("#song-form")).forEach((input) => {
      input.addEventListener("input", () => {
        const oldSlug = song.slug;
        song[input.dataset.songField] = input.value;
        if (input.dataset.songField === "title" && !song.slug) {
          song.slug = slugify(input.value);
        }
        markDirty("songs");
        if (input.dataset.songField === "title" || input.dataset.songField === "slug" || oldSlug !== song.slug) {
          renderSongList();
        }
      });
      input.addEventListener("change", () => {
        song[input.dataset.songField] = input.value;
        markDirty("songs");
      });
    });

    $("#cover-upload").addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const previous = state.pendingCovers.get(song.__editorId);
      if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
      const objectUrl = URL.createObjectURL(file);
      state.pendingCovers.set(song.__editorId, { file, objectUrl });
      $("#cover-preview").src = objectUrl;
      markDirty("songs");
    });

    $("#delete-song").addEventListener("click", () => {
      if (!window.confirm(`確定要從歌曲資料刪除「${song.title || "未命名歌曲"}」嗎？`)) return;
      state.songs = state.songs.filter((item) => item.__editorId !== song.__editorId);
      state.pendingCovers.delete(song.__editorId);
      state.selectedSongId = state.songs[0]?.__editorId || "";
      markDirty("songs");
      renderSongList();
      renderSongEditor();
    });

    $("#request-link-search").addEventListener("click", () => requestLinkSearch(song));
    $("#preview-current-links").addEventListener("click", () => previewCurrentLinks(song));
  }

  function previewCurrentLinks(song) {
    const providers = {};
    platformDefinitions.forEach(({ provider, field, label }) => {
      if (!song[field]) return;
      providers[provider] = [{
        id: `${provider}-current`,
        url: song[field],
        embedUrl: embedUrlFor(provider, song[field]),
        title: song.title,
        artist: state.site.artistName || "Azrael Morathane",
        album: song.albumName,
        releaseDate: song.releaseDate,
        artwork: song.coverImage ? `../${song.coverImage}` : "",
        confidence: 1,
        matchNotes: `目前正式欄位中的 ${label} 連結。`,
        source: "current"
      }];
    });
    state.candidates.songs[song.slug] = {
      status: "ready",
      completedAt: new Date().toISOString(),
      query: { title: song.title, artist: state.site.artistName || "Azrael Morathane", isrc: song.isrc || "" },
      providerStatus: {},
      providers
    };
    renderCandidates(song);
  }

  function embedUrlFor(provider, value) {
    try {
      const url = new URL(value);
      if (provider === "spotify") {
        const match = url.pathname.match(/\/(track|album)\/([A-Za-z0-9]+)/);
        return match ? `https://open.spotify.com/embed/${match[1]}/${match[2]}` : "";
      }
      if (provider === "youtube" || provider === "youtubeMusic") {
        const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
        return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
      }
      if (provider === "appleMusic" && url.hostname.endsWith("music.apple.com")) {
        return `https://embed.music.apple.com${url.pathname}${url.search}`;
      }
    } catch (_) {
      return "";
    }
    return "";
  }

  function candidatePreview(provider, candidate) {
    const embed = candidate.embedUrl || embedUrlFor(provider, candidate.url);
    if (embed && (provider === "youtube" || provider === "youtubeMusic")) {
      return `<div class="candidate-preview youtube"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(candidate.title)} 預覽" loading="lazy" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    }
    if (embed && (provider === "spotify" || provider === "appleMusic")) {
      return `<div class="candidate-preview"><iframe src="${escapeHtml(embed)}" title="${escapeHtml(candidate.title)} 預覽" loading="lazy" allow="autoplay; encrypted-media"></iframe></div>`;
    }
    if (candidate.previewUrl) {
      return `<div class="candidate-preview"><audio controls preload="none" src="${escapeHtml(candidate.previewUrl)}">瀏覽器不支援音訊預覽。</audio></div>`;
    }
    const artwork = candidate.artwork || "../assets/images/brand/azrael-hero.png";
    return `<div class="candidate-preview candidate-fallback"><img src="${escapeHtml(artwork)}" alt=""><div><strong>${escapeHtml(candidate.title)}</strong><p>此平台沒有提供內嵌音訊，請使用「開啟平台」檢視。</p></div></div>`;
  }

  function renderCandidates(song) {
    const target = $("#candidate-results");
    if (!target) return;
    const result = state.candidates.songs?.[song.slug];
    if (!result) {
      target.innerHTML = '<p class="field-note">尚無候選結果。儲存歌曲後即可提出搜尋，或先預覽目前已填入的連結。</p>';
      return;
    }

    const groups = platformDefinitions
      .filter(({ provider }) => Array.isArray(result.providers?.[provider]) && result.providers[provider].length)
      .map(({ provider, field, label }) => {
        const cards = result.providers[provider].map((candidate, index) => {
          const confidence = Math.round(Number(candidate.confidence || 0) * 100);
          return `
            <article class="candidate-card">
              ${candidatePreview(provider, candidate)}
              <div class="candidate-body">
                <div class="candidate-meta"><span class="confidence-chip">吻合度 ${confidence}%</span><span class="status-chip">候選 ${index + 1}</span></div>
                <div><h3>${escapeHtml(candidate.title || song.title)}</h3><p>${escapeHtml(candidate.artist || "")} · ${escapeHtml(candidate.album || "")} ${candidate.releaseDate ? `· ${escapeHtml(String(candidate.releaseDate).slice(0, 10))}` : ""}</p></div>
                <p>${escapeHtml(candidate.matchNotes || "請開啟平台確認版本與發售資訊。")}</p>
                <div class="candidate-actions">
                  <a class="button secondary compact" href="${escapeHtml(candidate.url)}" target="_blank" rel="noopener">開啟平台</a>
                  <button class="button primary compact" type="button" data-use-candidate="${escapeHtml(provider)}:${index}" data-target-field="${escapeHtml(field)}">採用這個連結</button>
                </div>
              </div>
            </article>
          `;
        }).join("");
        return `<section class="provider-group"><div class="provider-title"><h3>${escapeHtml(label)}</h3><span class="status-chip ready">${result.providers[provider].length} 個候選</span></div><div class="candidate-results">${cards}</div></section>`;
      }).join("");

    const unavailable = Object.entries(result.providerStatus || {})
      .filter(([, value]) => value && value !== "ok")
      .map(([provider, value]) => `${provider}: ${value}`)
      .join(" · ");
    target.innerHTML = groups || '<p class="field-note">這次沒有找到可確認的候選連結。</p>';
    if (unavailable) target.insertAdjacentHTML("afterbegin", `<p class="lookup-note">${escapeHtml(unavailable)}</p>`);

    $$('[data-use-candidate]', target).forEach((button) => {
      button.addEventListener("click", () => {
        const [provider, indexText] = button.dataset.useCandidate.split(":");
        const candidate = result.providers[provider][Number(indexText)];
        song[button.dataset.targetField] = candidate.url;
        markDirty("songs");
        renderSongEditor();
        toast(`已把 ${candidate.url} 填入歌曲資料，儲存後才會發布。`, "success");
      });
    });
  }

  function addSong() {
    const today = new Date().toISOString().slice(0, 10);
    const song = addEditorMetadata({
      title: "",
      slug: "",
      releaseDate: today,
      coverImage: "assets/images/brand/azrael-hero.png",
      description: "",
      youtubeUrl: "",
      spotifyUrl: "",
      appleMusicUrl: "",
      youtubeMusicUrl: "",
      amazonMusicUrl: "",
      hyperfollowUrl: "",
      albumName: "",
      isrc: "",
      status: "draft"
    });
    state.songs.push(song);
    state.selectedSongId = song.__editorId;
    markDirty("songs");
    renderSongList();
    renderSongEditor();
    $("[data-song-field=title]")?.focus();
  }

  function renderSiteForm() {
    const form = $("#site-form");
    const config = state.site;
    const latestOptions = state.songs
      .filter((song) => song.status !== "draft")
      .sort((a, b) => String(b.releaseDate).localeCompare(String(a.releaseDate)))
      .map((song) => `<option value="${escapeHtml(song.slug)}" ${song.slug === config.latestReleaseSlug ? "selected" : ""}>${escapeHtml(song.title)} (${escapeHtml(song.releaseDate)})</option>`)
      .join("");

    form.innerHTML = `
      <section class="form-section"><h2>基本資料</h2><div class="form-grid">
        <label><span>藝人名稱</span><input data-site-field="artistName" value="${escapeHtml(config.artistName)}"></label>
        <label><span>正式網站網址</span><input type="url" data-site-field="siteUrl" value="${escapeHtml(config.siteUrl)}"></label>
        <label><span>右下角最新發售</span><select data-site-field="latestReleaseSlug">${latestOptions}</select></label>
        <label><span>首頁影片</span><input type="url" data-site-field="videoEmbedUrl" value="${escapeHtml(config.videoEmbedUrl)}"></label>
      </div></section>
      <section class="form-section"><h2>電子報</h2><div class="form-grid">
        <label><span>Apps Script endpoint</span><input type="url" data-site-nested="newsletter.endpoint" value="${escapeHtml(config.newsletter?.endpoint)}"></label>
        <label><span>啟用狀態</span><select data-site-nested="newsletter.enabled"><option value="true" ${config.newsletter?.enabled ? "selected" : ""}>啟用</option><option value="false" ${!config.newsletter?.enabled ? "selected" : ""}>停用</option></select></label>
      </div></section>
      <section class="form-section"><div class="editor-title-row"><div><h2>社群連結</h2><p>拖曳排序暫不開放，可用上下按鈕調整。</p></div><button class="button secondary compact" id="add-social" type="button">新增社群</button></div><div class="social-editor" id="social-editor"></div></section>
    `;

    renderSocialEditor();
    $$('[data-site-field]', form).forEach((input) => input.addEventListener("input", () => {
      config[input.dataset.siteField] = input.value;
      markDirty("site");
    }));
    $$('[data-site-nested]', form).forEach((input) => input.addEventListener("change", () => {
      const [parent, child] = input.dataset.siteNested.split(".");
      config[parent] ||= {};
      config[parent][child] = input.value === "true" ? true : input.value === "false" ? false : input.value;
      markDirty("site");
    }));
    $("#add-social").addEventListener("click", () => {
      config.socialLinks ||= [];
      config.socialLinks.push({ label: "New platform", url: "" });
      markDirty("site");
      renderSocialEditor();
    });
  }

  function renderSocialEditor() {
    const target = $("#social-editor");
    if (!target) return;
    const links = state.site.socialLinks ||= [];
    target.innerHTML = links.map((item, index) => `
      <div class="social-item">
        <label><span>平台名稱</span><input data-social-label="${index}" value="${escapeHtml(item.label)}"></label>
        <label><span>網址</span><input type="url" data-social-url="${index}" value="${escapeHtml(item.url)}"></label>
        <div class="editor-actions"><button class="button secondary compact" type="button" data-social-up="${index}" ${index === 0 ? "disabled" : ""}>上移</button><button class="button secondary compact" type="button" data-social-down="${index}" ${index === links.length - 1 ? "disabled" : ""}>下移</button><button class="button danger compact" type="button" data-social-remove="${index}">移除</button></div>
      </div>
    `).join("");
    $$('[data-social-label]', target).forEach((input) => input.addEventListener("input", () => { links[Number(input.dataset.socialLabel)].label = input.value; markDirty("site"); }));
    $$('[data-social-url]', target).forEach((input) => input.addEventListener("input", () => { links[Number(input.dataset.socialUrl)].url = input.value; markDirty("site"); }));
    $$('[data-social-remove]', target).forEach((button) => button.addEventListener("click", () => { links.splice(Number(button.dataset.socialRemove), 1); markDirty("site"); renderSocialEditor(); }));
    $$('[data-social-up]', target).forEach((button) => button.addEventListener("click", () => { const i = Number(button.dataset.socialUp); [links[i - 1], links[i]] = [links[i], links[i - 1]]; markDirty("site"); renderSocialEditor(); }));
    $$('[data-social-down]', target).forEach((button) => button.addEventListener("click", () => { const i = Number(button.dataset.socialDown); [links[i + 1], links[i]] = [links[i], links[i + 1]]; markDirty("site"); renderSocialEditor(); }));
  }

  function flattenStrings(value, prefix = "") {
    const rows = [];
    Object.entries(value || {}).forEach(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof child === "string") rows.push({ path, value: child });
      else if (child && typeof child === "object" && !Array.isArray(child)) rows.push(...flattenStrings(child, path));
    });
    return rows;
  }

  function setByPath(target, path, value) {
    const keys = path.split(".");
    const leaf = keys.pop();
    const parent = keys.reduce((node, key) => (node[key] ||= {}), target);
    parent[leaf] = value;
  }

  function getByPath(target, path) {
    return path.split(".").reduce((value, key) => value?.[key], target);
  }

  function renderTranslationControls() {
    const language = $("#translation-language");
    language.innerHTML = Object.entries(state.i18n).map(([code, data]) => `<option value="${escapeHtml(code)}" ${code === state.translationLanguage ? "selected" : ""}>${escapeHtml(data.label || code)}</option>`).join("");
    const sections = Object.keys(state.i18n[state.translationLanguage] || {}).filter((key) => !["label", "locale"].includes(key));
    if (!sections.includes(state.translationSection)) state.translationSection = sections[0] || "home";
    $("#translation-section").innerHTML = sections.map((section) => `<option value="${escapeHtml(section)}" ${section === state.translationSection ? "selected" : ""}>${escapeHtml(section)}</option>`).join("");
    renderTranslationForm();
  }

  function renderTranslationForm() {
    const form = $("#translation-form");
    const root = state.i18n[state.translationLanguage]?.[state.translationSection] || {};
    const english = state.i18n.en?.[state.translationSection] || {};
    const rows = flattenStrings(root);
    form.innerHTML = rows.map(({ path, value }) => {
      const reference = getByPath(english, path);
      const field = value.length > 90 || value.includes("\n")
        ? `<textarea data-translation-path="${escapeHtml(path)}">${escapeHtml(value)}</textarea>`
        : `<input data-translation-path="${escapeHtml(path)}" value="${escapeHtml(value)}">`;
      return `<label class="translation-field"><span class="translation-path">${escapeHtml(`${state.translationSection}.${path}`)}</span>${field}${state.translationLanguage !== "en" && reference ? `<small class="english-reference">English: ${escapeHtml(reference)}</small>` : ""}</label>`;
    }).join("") || '<p class="field-note">這個區段沒有可編輯的文字。</p>';
    $$('[data-translation-path]', form).forEach((input) => input.addEventListener("input", () => {
      setByPath(state.i18n[state.translationLanguage][state.translationSection], input.dataset.translationPath, input.value);
      markDirty("translations");
    }));
  }

  function githubHeaders() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${state.token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  async function githubRequest(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { ...githubHeaders(), ...(options.headers || {}) } });
    if (response.status === 204) return null;
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || `${response.status} ${response.statusText}`);
    return body;
  }

  function contentsUrl(path) {
    return `https://api.github.com/repos/${repository.owner}/${repository.name}/contents/${path}`;
  }

  async function githubGetFile(path) {
    try {
      const query = new URLSearchParams({
        ref: repository.branch,
        cacheBust: String(Date.now())
      });
      return await githubRequest(`${contentsUrl(path)}?${query}`);
    } catch (error) {
      if (String(error.message).includes("Not Found")) return null;
      throw error;
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  function textToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function base64ToText(content) {
    const binary = atob(String(content || "").replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function githubPut(path, contentBase64, message) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = await githubGetFile(path);
      try {
        return await githubPutAtSha(path, contentBase64, message, existing?.sha);
      } catch (error) {
        lastError = error;
        if (!/does not match|conflict|sha/i.test(error.message) || attempt === 2) throw error;
      }
    }
    throw lastError;
  }

  async function githubPutAtSha(path, contentBase64, message, sha) {
    return githubRequest(contentsUrl(path), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: contentBase64,
        branch: repository.branch,
        ...(sha ? { sha } : {})
      })
    });
  }

  async function githubPutText(path, text, message) {
    return githubPut(path, textToBase64(text), message);
  }

  async function githubGetJson(path, fallback) {
    const file = await githubGetFile(path);
    if (!file?.content) return deepClone(fallback);
    return JSON.parse(base64ToText(file.content));
  }

  async function githubUpdateJson(path, fallback, update, message) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const file = await githubGetFile(path);
      const current = file?.content ? JSON.parse(base64ToText(file.content)) : deepClone(fallback);
      const next = update(current);
      try {
        await githubPutAtSha(path, textToBase64(jsonText(next)), message, file?.sha);
        return next;
      } catch (error) {
        lastError = error;
        if (!/does not match|conflict|sha/i.test(error.message) || attempt === 3) throw error;
      }
    }
    throw lastError;
  }

  async function verifyToken(token) {
    state.token = token.trim();
    const user = await githubRequest("https://api.github.com/user");
    await githubRequest(`https://api.github.com/repos/${repository.owner}/${repository.name}`);
    state.githubUser = user.login;
    sessionStorage.setItem("azrael_admin_token", state.token);
    setConnection(`已連接 ${user.login}`, "success");
    renderSongEditor();
  }

  function clearToken() {
    state.token = "";
    state.githubUser = "";
    sessionStorage.removeItem("azrael_admin_token");
    $("#github-token").value = "";
    setConnection("唯讀模式", "neutral");
    renderSongEditor();
  }

  function validateSong(song) {
    const required = ["title", "slug", "releaseDate", "coverImage"];
    const missing = required.filter((key) => !String(song[key] || "").trim());
    if (missing.length) throw new Error(`請先填完：${missing.join(", ")}`);
    if (!/^[a-z0-9-]+$/.test(song.slug)) throw new Error("slug 只能使用小寫英文字母、數字與連字號。");
    const duplicate = state.songs.find((item) => item.__editorId !== song.__editorId && item.slug === song.slug);
    if (duplicate) throw new Error(`slug「${song.slug}」已被另一首歌使用。`);
  }

  function syncSongDescriptionKeys(song) {
    let changed = false;
    Object.entries(state.i18n).forEach(([language, translation]) => {
      translation.songDescriptions ||= {};
      const descriptions = translation.songDescriptions;
      if (song.__originalSlug && song.__originalSlug !== song.slug && Object.hasOwn(descriptions, song.__originalSlug)) {
        descriptions[song.slug] = descriptions[song.__originalSlug];
        delete descriptions[song.__originalSlug];
        changed = true;
      }
      if (!Object.hasOwn(descriptions, song.slug)) {
        descriptions[song.slug] = language === "en" ? song.description || "" : "";
        changed = true;
      }
      if (language === "en" && descriptions[song.slug] !== (song.description || "")) {
        descriptions[song.slug] = song.description || "";
        changed = true;
      }
    });
    return changed;
  }

  function fileExtension(file) {
    if (file.type === "image/jpeg") return "jpg";
    if (file.type === "image/webp") return "webp";
    return "png";
  }

  function songPageHtml(song) {
    const title = escapeHtml(song.title);
    const description = escapeHtml(song.description || `${song.title} by Azrael Morathane.`);
    const image = escapeHtml(song.coverImage);
    const slug = escapeHtml(song.slug);
    return `<!doctype html>
<html lang="en" data-base="../..">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} | Azrael Morathane</title>
  <meta name="description" content="${description}">
  <meta property="og:type" content="music.song">
  <meta property="og:site_name" content="Azrael Morathane">
  <meta property="og:title" content="${title} | Azrael Morathane">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="../../${image}">
  <link rel="stylesheet" href="../../assets/css/styles.css">
</head>
<body data-page="song" data-song-slug="${slug}">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header"><div class="nav-wrap"><a class="brand" href="../../index.html" aria-label="Azrael Morathane home"><strong>Azrael Morathane</strong><span>Gothic anime metal</span></a><nav class="site-nav" aria-label="Primary"><a href="../../index.html">Home</a><a href="../../music.html" aria-current="page">Music</a><a href="../../about.html">About</a></nav></div></header>
  <main id="main" data-error-target><div id="song-page"></div></main>
  <footer class="site-footer"><div class="container footer-inner"><span>© 2026 Azrael Morathane</span><div class="social-row" data-social-links></div></div></footer>
  <script src="../../assets/js/app.js" defer></script>
</body>
</html>
`;
  }

  async function saveSongs() {
    const song = selectedSong();
    if (!song) throw new Error("請先選擇歌曲。");
    validateSong(song);

    const pending = state.pendingCovers.get(song.__editorId);
    if (pending) {
      const extension = fileExtension(pending.file);
      const path = `assets/images/covers/${song.slug}.${extension}`;
      const bytes = new Uint8Array(await pending.file.arrayBuffer());
      await githubPut(path, bytesToBase64(bytes), `Upload cover for ${song.title}`);
      song.coverImage = path;
      URL.revokeObjectURL(pending.objectUrl);
      state.pendingCovers.delete(song.__editorId);
    }

    if (!song.__originalSlug || song.__originalSlug !== song.slug) {
      await githubPutText(`songs/${song.slug}/index.html`, songPageHtml(song), `Create song page: ${song.title}`);
    }
    await githubPutText(files.songs, jsonText(state.songs), `Update song data: ${song.title}`);
    if (syncSongDescriptionKeys(song)) {
      await githubPutText(files.translations, jsonText(state.i18n), `Prepare translations: ${song.title}`);
      markDirty("translations", false);
      renderTranslationControls();
    }
    song.__originalSlug = song.slug;
    markDirty("songs", false);
    renderSongEditor();
    toast(`已儲存「${song.title}」，GitHub Pages 會開始更新。`, "success");
  }

  async function saveCurrent() {
    if (!state.token) {
      $("#auth-dialog").showModal();
      return;
    }
    const button = $("#save-current");
    button.disabled = true;
    button.textContent = "儲存中…";
    try {
      if (state.activeTab === "songs") await saveSongs();
      if (state.activeTab === "site") {
        await githubPutText(files.site, jsonText(state.site), "Update website settings from admin");
        markDirty("site", false);
        toast("網站設定已儲存。", "success");
      }
      if (state.activeTab === "translations") {
        await githubPutText(files.translations, jsonText(state.i18n), "Update localized website copy from admin");
        markDirty("translations", false);
        toast("多國文字已儲存。", "success");
      }
    } catch (error) {
      toast(`儲存失敗：${error.message}`, "error");
    } finally {
      updateSaveButton();
    }
  }

  async function requestLinkSearch(song) {
    if (!state.token) return $("#auth-dialog").showModal();
    if (state.dirty.songs) return toast("請先儲存歌曲，再提出平台搜尋。", "error");

    const requestId = new Date().toISOString();
    const button = $("#request-link-search");
    button.disabled = true;
    button.textContent = "送出搜尋…";
    try {
      const requests = await githubUpdateJson(
        files.requests,
        { version: 1, requests: {} },
        (latest) => {
          latest.version = 1;
          latest.requests ||= {};
          latest.requests[song.slug] = {
            requestId,
            slug: song.slug,
            requestedAt: requestId,
            requestedBy: state.githubUser,
            status: "requested"
          };
          return latest;
        },
        `Request platform link search: ${song.title}`
      );
      state.requests = requests;
      renderSongEditor();
      toast("搜尋請求已送出。GitHub Actions 完成後，候選會自動出現在這裡。", "success");
      pollCandidates(song.slug, requestId);
    } catch (error) {
      toast(`無法提出搜尋：${error.message}`, "error");
      renderSongEditor();
    }
  }

  function pollCandidates(slug, requestId) {
    if (state.pollTimer) window.clearInterval(state.pollTimer);
    let attempts = 0;
    const check = async () => {
      attempts += 1;
      try {
        const candidates = await githubGetJson(files.candidates, { version: 1, songs: {} });
        const result = candidates.songs?.[slug];
        if (result && (!result.requestId || result.requestId === requestId)) {
          state.candidates = candidates;
          const song = selectedSong();
          if (song?.slug === slug) renderSongEditor();
          if (["ready", "partial", "error"].includes(result.status)) {
            window.clearInterval(state.pollTimer);
            state.pollTimer = null;
            toast(result.status === "error" ? "搜尋完成，但沒有找到候選。" : "平台候選已回傳，可以開始預覽。", result.status === "error" ? "error" : "success");
          }
        }
      } catch (_) {
        // A workflow may be writing the file; the next poll will retry.
      }
      if (attempts >= 40 && state.pollTimer) {
        window.clearInterval(state.pollTimer);
        state.pollTimer = null;
        toast("背景搜尋仍在執行，可稍後重新整理後台查看結果。", "neutral");
      }
    };
    check();
    state.pollTimer = window.setInterval(check, 6000);
  }

  function bindGlobalEvents() {
    $$('[data-tab]').forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
    $("#song-search").addEventListener("input", renderSongList);
    $("#add-song").addEventListener("click", addSong);
    $("#save-current").addEventListener("click", saveCurrent);
    $("#open-auth").addEventListener("click", () => {
      $("#github-token").value = state.token;
      $("#auth-status").textContent = "";
      $("#auth-dialog").showModal();
    });
    $("#connect-github").addEventListener("click", async () => {
      const status = $("#auth-status");
      status.textContent = "正在驗證 GitHub 權限…";
      try {
        await verifyToken($("#github-token").value);
        status.textContent = `已連接 ${state.githubUser}。`;
        window.setTimeout(() => $("#auth-dialog").close(), 500);
      } catch (error) {
        clearToken();
        status.textContent = `連接失敗：${error.message}`;
      }
    });
    $("#disconnect-github").addEventListener("click", () => {
      clearToken();
      $("#auth-status").textContent = "已清除這個分頁中的 Token。";
    });
    $("#translation-language").addEventListener("change", (event) => {
      state.translationLanguage = event.target.value;
      renderTranslationControls();
    });
    $("#translation-section").addEventListener("change", (event) => {
      state.translationSection = event.target.value;
      renderTranslationForm();
    });
    window.addEventListener("beforeunload", (event) => {
      if (!Object.values(state.dirty).some(Boolean)) return;
      event.preventDefault();
      event.returnValue = "";
    });
  }

  async function init() {
    bindGlobalEvents();
    try {
      const [songs, site, i18n, requests, candidates] = await Promise.all([
        loadJson(files.songs),
        loadJson(files.site),
        loadJson(files.translations),
        loadJson(files.requests, { version: 1, requests: {} }),
        loadJson(files.candidates, { version: 1, songs: {} })
      ]);
      state.songs = songs.map(addEditorMetadata);
      state.site = site;
      state.i18n = i18n;
      state.requests = requests;
      state.candidates = candidates;
      state.selectedSongId = state.songs[0]?.__editorId || "";
      renderSongList();
      renderSongEditor();
      renderSiteForm();
      renderTranslationControls();

      if (state.token) {
        try {
          await verifyToken(state.token);
        } catch (_) {
          clearToken();
          toast("先前的 GitHub Token 已失效，已回到唯讀模式。", "error");
        }
      } else {
        setConnection("唯讀模式", "neutral");
      }
    } catch (error) {
      $("#song-editor").innerHTML = `<div class="empty-editor"><div><p class="eyebrow">Load error</p><h1>後台資料讀取失敗</h1><p>${escapeHtml(error.message)}</p></div></div>`;
      toast(error.message, "error");
    }
  }

  init();
})();
