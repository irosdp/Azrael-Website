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

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Upload everything inside this folder to the repository root.
3. In GitHub, open Settings > Pages.
4. Set Source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`, then save.

After publishing, update `siteUrl` in `data/site-config.json` and replace the `#` social URLs with real links.
