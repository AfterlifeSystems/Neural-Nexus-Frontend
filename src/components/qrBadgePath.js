// `/` and `/welcome` are the same landing screen. The catch-all route renders
// LandingPage at `/`, and that page already has a QR code large enough to scan,
// so the corner badge must not repeat it there.

export function pathCarriesItsOwnQrCode(pathname) {
  const normalized = String(pathname ?? '').replace(/\/+$/, '') || '/';
  return normalized === '/' || normalized === '/welcome';
}
