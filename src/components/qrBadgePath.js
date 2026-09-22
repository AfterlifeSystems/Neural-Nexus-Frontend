// `/` and `/welcome` are the same landing screen. The catch-all route renders
// LandingPage at `/`, and that page already has a QR code large enough to scan,
// so the corner badge must not repeat it there.

export function pathCarriesItsOwnQrCode(pathname) {
  const normalized = String(pathname ?? '').replace(/\/+$/, '') || '/';
  return normalized === '/' || normalized === '/welcome';
}

// `/login` and `/signup` are the signed-out auth card. On a phone the fixed
// corner badge sits on top of the password field and the submit button, so the
// badge must stay off those routes entirely.

export function pathIsSignedOutAuthForm(pathname) {
  const normalized = String(pathname ?? '').replace(/\/+$/, '') || '/';
  return normalized === '/login' || normalized === '/signup';
}
