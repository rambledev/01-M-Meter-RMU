// Google Chrome detection + "open this page in Chrome" deep link
// (2026-09-25) — user-agent sniffing is inherently fragile, but there is
// no feature-detection alternative for "which browser is this," and this
// app has a hard product requirement to steer everyone onto Chrome. Every
// other major Chromium-based browser (Edge, Opera, Samsung Internet, ...)
// also matches /Chrome/ in its UA string, so those have to be excluded
// explicitly first; Chrome for iOS ("CriOS") counts as Chrome even though
// it runs on WebKit under Apple's rules, since it's still the Chrome app.
export function isGoogleChrome(userAgent: string): boolean {
  if (/Edg\//.test(userAgent)) return false; // Microsoft Edge
  if (/OPR\/|Opera/.test(userAgent)) return false; // Opera
  if (/SamsungBrowser/.test(userAgent)) return false; // Samsung Internet
  if (/UCBrowser/.test(userAgent)) return false; // UC Browser
  if (/FBAN|FBAV/.test(userAgent)) return false; // Facebook in-app browser
  if (/Line\//.test(userAgent)) return false; // LINE in-app browser
  if (/Instagram/.test(userAgent)) return false; // Instagram in-app browser
  if (/CriOS/.test(userAgent)) return true; // Chrome for iOS
  return /Chrome\//.test(userAgent);
}

// Builds a URL that asks the OS to open the current page in Chrome
// specifically, rather than whatever browser this script is running in.
// - Android: an intent:// URL targeting Chrome's package — the reliable
//   way to force-open a specific app from a web page on Android.
// - iOS/desktop: the "googlechrome(s)://" scheme, which the real Chrome
//   app/binary registers as its own URL handler on every platform when
//   installed (this is what "Continue in Chrome" prompts have used for
//   years) — same scheme works on iOS, Windows, and macOS.
// If Chrome isn't installed, the OS/browser just ignores the unknown
// scheme; there's no reliable cross-platform way to detect that up front.
export function buildOpenInChromeUrl(currentUrl: string, userAgent: string): string {
  if (/Android/i.test(userAgent)) {
    const withoutScheme = currentUrl.replace(/^https?:\/\//, "");
    return `intent://${withoutScheme}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  if (currentUrl.startsWith("https://")) {
    return currentUrl.replace(/^https:\/\//, "googlechromes://");
  }
  return currentUrl.replace(/^http:\/\//, "googlechrome://");
}
