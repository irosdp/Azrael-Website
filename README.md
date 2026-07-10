# Azrael Morathane Official Site

Static GitHub Pages artist hub built with plain HTML, CSS, and JavaScript.

## Edit content

- Songs: `data/songs.json`
- Social links, latest release, video embed: `data/site-config.json`
- Main styles: `assets/css/styles.css`

Each song in `data/songs.json` uses:

- `title`
- `slug`
- `releaseDate`
- `coverImage`
- `description`
- `youtubeUrl`
- `spotifyUrl`
- `appleMusicUrl`
- `youtubeMusicUrl`
- `amazonMusicUrl`
- `hyperfollowUrl`
- `albumName`
- `isrc` (recommended for automatic platform matching)
- `status` (`draft` hides the song from the public site)

## Website admin

Open `/admin/` to manage songs, covers, site settings, social links, and all
localized copy. The admin page is public and read-only until a GitHub
fine-grained personal access token is supplied in that browser tab.

Create the token for only `irosdp/Azrael-Website` with:

- Repository permissions > Contents: Read and write
- No account permissions

The token is stored in `sessionStorage`, is never committed, and is cleared when
the browser tab closes. Saving a new song also creates its generic
`songs/<slug>/index.html` page.

## Automatic platform-link finder

The admin's **Find platform links** button writes a pending request to
`data/link-requests.json`. `.github/workflows/find-song-links.yml` processes the
request and writes reviewable results to `data/link-candidates.json`. Candidate
links never replace the live song links until an editor previews and accepts
them in `/admin/`.

Add this repository secret under Settings > Secrets and variables > Actions:

- `YOUTUBE_API_KEY`

Apple Music candidates use the public iTunes Search API and need no secret.
Spotify and HyperFollow remain manual. If the YouTube secret is not configured,
the workflow still returns Apple candidates and reports that YouTube was skipped.

Run the local checks with:

```powershell
python -m unittest discover -s tests -v
python scripts/find_song_links.py
```

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload everything inside this folder to the repository root.
3. In GitHub, open Settings > Pages.
4. Set Source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`, then save.

After publishing, update `siteUrl` in `data/site-config.json` and replace the `#` social URLs with real links.
