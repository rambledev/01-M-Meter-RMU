import { describe, expect, it } from "vitest";
import { buildOpenInChromeUrl, isGoogleChrome } from "./detectChrome";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
const CHROME_DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0.0.0 Mobile/15E148 Safari/604.1";
const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const SAFARI_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";
const EDGE =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0";
const OPERA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 OPR/110.0.0.0";
const SAMSUNG_INTERNET =
  "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const LINE_IN_APP =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Line/14.7.0";

describe("isGoogleChrome", () => {
  it("accepts real Chrome on Android and desktop", () => {
    expect(isGoogleChrome(CHROME_ANDROID)).toBe(true);
    expect(isGoogleChrome(CHROME_DESKTOP)).toBe(true);
  });

  it("accepts Chrome for iOS (CriOS)", () => {
    expect(isGoogleChrome(CHROME_IOS)).toBe(true);
  });

  it("rejects Safari", () => {
    expect(isGoogleChrome(SAFARI_IOS)).toBe(false);
    expect(isGoogleChrome(SAFARI_MAC)).toBe(false);
  });

  it("rejects Firefox", () => {
    expect(isGoogleChrome(FIREFOX)).toBe(false);
  });

  it("rejects other Chromium-based browsers that also match /Chrome/", () => {
    expect(isGoogleChrome(EDGE)).toBe(false);
    expect(isGoogleChrome(OPERA)).toBe(false);
    expect(isGoogleChrome(SAMSUNG_INTERNET)).toBe(false);
  });

  it("rejects an in-app browser even when its UA contains Chrome", () => {
    expect(isGoogleChrome(LINE_IN_APP)).toBe(false);
  });
});

describe("buildOpenInChromeUrl", () => {
  it("builds an Android intent:// URL", () => {
    expect(buildOpenInChromeUrl("https://example.com/path?x=1", CHROME_ANDROID)).toBe(
      "intent://example.com/path?x=1#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  it("builds a googlechromes:// URL for https on iOS", () => {
    expect(buildOpenInChromeUrl("https://example.com/", SAFARI_IOS)).toBe(
      "googlechromes://example.com/",
    );
  });

  it("builds a googlechromes:// URL for https on desktop", () => {
    expect(buildOpenInChromeUrl("https://example.com/", SAFARI_MAC)).toBe(
      "googlechromes://example.com/",
    );
  });

  it("builds a googlechrome:// URL for plain http", () => {
    expect(buildOpenInChromeUrl("http://example.com/", FIREFOX)).toBe(
      "googlechrome://example.com/",
    );
  });
});
