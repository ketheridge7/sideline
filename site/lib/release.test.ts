import { describe, expect, it } from "vitest";
import { parseSha256Digest, releaseInfoFromPayload } from "./release";

const DIGEST = "sha256:f3d910d15d1215117c0381d9d439d1dd3f273ce65002afbce81519f565dd2595";

describe("release installer digest", () => {
  it("reads the lowercase sha256 hex from the installer asset", () => {
    expect(parseSha256Digest(DIGEST)).toBe(
      "f3d910d15d1215117c0381d9d439d1dd3f273ce65002afbce81519f565dd2595",
    );
    expect(parseSha256Digest(`  ${DIGEST.toUpperCase()}  `)).toBe(
      "f3d910d15d1215117c0381d9d439d1dd3f273ce65002afbce81519f565dd2595",
    );
  });

  it("ignores missing or non-sha256 digests", () => {
    expect(parseSha256Digest(undefined)).toBeNull();
    expect(parseSha256Digest("")).toBeNull();
    expect(parseSha256Digest("sha512:abcd")).toBeNull();
    expect(parseSha256Digest("f3d910d15d1215117c0381d9d439d1dd3f273ce65002afbce81519f565dd2595")).toBeNull();
  });

  it("returns version, size, and digest from the latest release payload", () => {
    expect(
      releaseInfoFromPayload({
        tag_name: "v1.0.3",
        assets: [
          { name: "latest.yml", size: 10, digest: "sha256:" + "ab".repeat(32) },
          { name: "Sideline-Setup.exe", size: 94341159, digest: DIGEST },
        ],
      }),
    ).toEqual({
      version: "1.0.3",
      installerBytes: 94341159,
      installerSha256: "f3d910d15d1215117c0381d9d439d1dd3f273ce65002afbce81519f565dd2595",
    });
  });

  it("keeps the release when the installer digest is missing", () => {
    expect(
      releaseInfoFromPayload({
        tag_name: "v1.0.3",
        assets: [{ name: "Sideline-Setup.exe", size: 100 }],
      }),
    ).toEqual({
      version: "1.0.3",
      installerBytes: 100,
      installerSha256: null,
    });
  });

  it("returns null without a version tag", () => {
    expect(releaseInfoFromPayload({ assets: [] })).toBeNull();
    expect(releaseInfoFromPayload({})).toBeNull();
  });
});
