import { describe, expect, it } from "vitest";
import { attributedDownloadUrl, isBareDownloadPage } from "./download-attribution";

const ORIGIN = "https://sideline-three.vercel.app";

describe("download attribution pageview", () => {
  it("folds UTM params into the page path and keeps the query string", () => {
    const input = `${ORIGIN}/download?utm_source=reddit&utm_medium=social&utm_campaign=beta`;
    expect(attributedDownloadUrl(input)).toBe(
      `${ORIGIN}/download/reddit/social/beta?utm_source=reddit&utm_medium=social&utm_campaign=beta`,
    );
  });

  it("uses a placeholder when a UTM value is missing", () => {
    expect(attributedDownloadUrl(`${ORIGIN}/download?utm_source=Reddit`)).toBe(
      `${ORIGIN}/download/reddit/_/_?utm_source=Reddit`,
    );
  });

  it("turns spaces and punctuation into hyphens", () => {
    expect(
      attributedDownloadUrl(`${ORIGIN}/download?utm_source=r%2Fnfl&utm_medium=social%20post&utm_campaign=week%201`),
    ).toBe(`${ORIGIN}/download/r-nfl/social-post/week-1?utm_source=r%2Fnfl&utm_medium=social%20post&utm_campaign=week%201`);
  });

  it("leaves visits without UTM params on /download", () => {
    expect(attributedDownloadUrl(`${ORIGIN}/download`)).toBe(`${ORIGIN}/download`);
    expect(attributedDownloadUrl(`${ORIGIN}/download?ref=nav`)).toBe(`${ORIGIN}/download?ref=nav`);
  });

  it("does not rewrite other pages", () => {
    const home = `${ORIGIN}/?utm_source=reddit&utm_medium=social&utm_campaign=beta`;
    expect(attributedDownloadUrl(home)).toBe(home);
  });

  it("returns malformed URLs unchanged", () => {
    expect(attributedDownloadUrl("not a url")).toBe("not a url");
    expect(isBareDownloadPage("not a url")).toBe(false);
  });

  it("recognizes the bare download page, including a trailing slash", () => {
    expect(isBareDownloadPage(`${ORIGIN}/download?utm_source=x`)).toBe(true);
    expect(isBareDownloadPage(`${ORIGIN}/download/`)).toBe(true);
    expect(isBareDownloadPage(`${ORIGIN}/docs`)).toBe(false);
  });
});
