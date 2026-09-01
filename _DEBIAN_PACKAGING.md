# Package Neural Nexus Frontend as an Ubuntu .deb

## Context

Neural-Nexus-Frontend is a Vite + React 19 SPA. `npm run build` emits static
assets into `dist/` — there is no server process of its own. Deployment today is
Vercel, with `vercel.json` supplying a single SPA rewrite
(`/(.*) → /index.html`).

The goal is to also distribute the frontend as a Debian package installable on
Ubuntu, so a machine can `apt install ./neural-nexus-frontend_*.deb` and get a
working site without Vercel, Docker, or a Node runtime on the target host.

Node is a **build-time** dependency only. The installed package contains static
files plus web-server configuration; nothing in it executes.

No application source changes are required or intended. Everything below is new
files under `packaging/` or `debian/`, plus one optional `vite.config.js` change
called out explicitly in "Open decisions".

## Package shape

`Architecture: all` (no compiled code). Installed size ≈ 1.6 MB with the
sourcemap excluded.

```
/usr/share/neural-nexus-frontend/          <- contents of dist/
    index.html
    icon.png  NeuralNexusIcon.png  robots.txt  sitemap.xml  vite.svg
    assets/index-<hash>.js                 (1.2M)
    assets/index-<hash>.css                (88K)
    assets/*.png                           (196K)
/etc/nginx/sites-available/neural-nexus-frontend   (conffile)
/usr/share/doc/neural-nexus-frontend/{copyright,changelog.Debian.gz}
```

### control

```
Package: neural-nexus-frontend
Version: <see versioning below>
Architecture: all
Maintainer: Evan Woods <e.woods.business@icloud.com>
Depends: nginx | nginx-full | nginx-light
Section: web
Priority: optional
Homepage: https://neuralnexus.site
Description: Neural Nexus web frontend
 Static single-page application for the Neural Nexus AI personality
 reconstruction platform, served by nginx.
```

### nginx site config

Ports the `vercel.json` rewrite. Without `try_files ... /index.html`, hard
refreshes on `react-router-dom` deep links return 404.

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/neural-nexus-frontend;
    location / { try_files $uri $uri/ /index.html; }
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; }
}
```

Vite content-hashes asset filenames, so the immutable one-year cache on
`/assets/` is safe. `index.html` must stay uncached (nginx default).

### Maintainer scripts

- `postinst`: symlink the site config into `/etc/nginx/sites-enabled/`,
  `nginx -t`, then reload. Do not enable if `nginx -t` fails.
- `prerm`: remove the symlink, reload nginx.
- Register `/etc/nginx/sites-available/neural-nexus-frontend` in `conffiles`
  so local edits survive upgrades.

## Critical files (all new)

| Path | Purpose |
|---|---|
| `debian/control` | package metadata, `Depends: nginx` |
| `debian/rules` | `override_dh_auto_build` → `npm ci && npm run build` |
| `debian/changelog` | version source of truth for dpkg |
| `debian/install` | `dist/* → usr/share/neural-nexus-frontend` |
| `debian/postinst`, `debian/prerm` | nginx site enable/disable |
| `packaging/nginx/neural-nexus-frontend.conf` | the server block above |
| `.gitignore` | ignore build artifacts (`../*.deb`, `debian/.debhelper/`, etc.) |

Reuses, unchanged: `package.json` `build` script, `vite.config.js`,
`vercel.json` (as the reference for the rewrite rule).

## Open decisions

**1. Sourcemap.** `vite.config.js` sets `build.sourcemap: true`.
`dist/assets/index-DmswI5Xn.js.map` is 15 MB of the current 19 MB `dist/`.
Options: exclude it from `debian/install` (recommended — keeps the app code
untouched, package stays ~1.6 MB); ship it in a separate
`neural-nexus-frontend-sourcemaps` package; or set `sourcemap: false` for
packaged builds, which *is* a code change and is therefore out of scope unless
approved.

**2. Versioning.** `package.json` is `0.0.0` and the repo has no git tags.
Debian versions must compare monotonically (`dpkg --compare-versions`) or
upgrades break. Pick a real start version (`0.1.0-1`) or derive one:
`0.0.0+git20260830.3593db9-1`.

**3. Build-time env vars.** Vite inlines `import.meta.env.*` into the bundle, so
the `.deb` is pinned to whatever backend was configured at build time. Call
sites:

- `src/services/neuralNexusApiClient.js:18` — `VITE_NEURAL_NEXUS_API_BASE_URL`,
  falls back to `http://localhost:8080`
- `src/components/BillingManagement.jsx:12` — `VITE_BILLING_PORTAL_URL`
- `src/config/demoAvatar.js:8,12` — `VITE_STREAMLIT_EMBED_URL`,
  `VITE_DEMO_ASSISTANT_ID`
- `src/components/AuthComponent.jsx:306,309`,
  `src/components/AvatarSelectionComponent.jsx:822` — `VITE_TESTING`

Consequence: staging and production need separate `.deb` builds, and `/etc/`
cannot retarget an installed package. The fix — ship
`/etc/neural-nexus-frontend/config.json` and read it before the bundle boots —
requires an app source change and is deferred.

**4. Build method.** `debian/` + `dpkg-buildpackage -us -uc -b` (lintian-clean,
signable, apt-repo-ready) vs. a single `packaging/build-deb.sh` staging a tree
for `dpkg-deb --root-owner-group --build` (~60 lines, not a real source
package). Plan above assumes the `debian/` route.

## Verification

```bash
# 1. Build
VITE_NEURAL_NEXUS_API_BASE_URL=https://api.neuralnexus.site \
  dpkg-buildpackage -us -uc -b

# 2. Inspect before installing anything
dpkg-deb --info    ../neural-nexus-frontend_*.deb
dpkg-deb --contents ../neural-nexus-frontend_*.deb
lintian ../neural-nexus-frontend_*.deb

# 3. Install (a container or VM, not the dev box — it reloads nginx)
sudo apt install ./../neural-nexus-frontend_*.deb

# 4. Confirm it serves, and that the SPA fallback works
curl -sI http://localhost/ | head -1                 # 200
curl -s  http://localhost/ | grep -q '<div id="root"' && echo root-ok
curl -sI http://localhost/avatars | head -1          # 200, NOT 404 <- the rewrite
curl -sI http://localhost/assets/index-*.js | grep -i cache-control  # immutable

# 5. Confirm the baked-in API URL is the intended one
grep -o 'https://api\.neuralnexus\.site' \
  /usr/share/neural-nexus-frontend/assets/index-*.js | head -1

# 6. Upgrade and removal are clean
sudo apt install ./../neural-nexus-frontend_<newer>_all.deb
sudo apt remove neural-nexus-frontend
test ! -e /etc/nginx/sites-enabled/neural-nexus-frontend && echo unlinked
sudo nginx -t
```

Toolchain is already present on this machine (Ubuntu 24.04 noble):
`dpkg-deb`, `dpkg-buildpackage`, `fakeroot`. `lintian` and `debhelper` may need
installing.
