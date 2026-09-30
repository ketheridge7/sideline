import { describe, expect, it } from "vitest";
import { SUPPORT_URL, supportHref } from "./constants";

describe("site support URL", () => {
  it("ships empty so Support controls stay hidden", () => {
    expect(SUPPORT_URL).toBe("");
    expect(supportHref("")).toBeNull();
    expect(supportHref("   ")).toBeNull();
  });

  it("allows Stripe Payment Links and rejects other URLs", () => {
    expect(supportHref("https://buy.stripe.com/test_example")).toBe("https://buy.stripe.com/test_example");
    expect(supportHref("https://donate.stripe.com/example")).toBe("https://donate.stripe.com/example");
    expect(supportHref("https://buy.stripe.com/")).toBeNull();
    expect(supportHref("https://buy.stripe.com")).toBeNull();
    expect(supportHref("http://buy.stripe.com/test_example")).toBeNull();
    expect(supportHref("https://example.com/pay")).toBeNull();
    expect(supportHref("https://buy.stripe.com.evil.test/test_example")).toBeNull();
    expect(supportHref("not a url")).toBeNull();
  });
});
