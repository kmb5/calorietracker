import { formatRelative } from "./dateUtils";

function isoSecondsAgo(s: number) {
  return new Date(Date.now() - s * 1000).toISOString();
}

describe("formatRelative", () => {
  it("returns 'just now' for < 60 seconds ago", () => {
    expect(formatRelative(isoSecondsAgo(30))).toBe("just now");
  });

  it("returns minutes ago", () => {
    expect(formatRelative(isoSecondsAgo(90))).toBe("1 min ago");
    expect(formatRelative(isoSecondsAgo(3540))).toBe("59 min ago");
  });

  it("returns hours ago", () => {
    expect(formatRelative(isoSecondsAgo(3600))).toBe("1 hour ago");
    expect(formatRelative(isoSecondsAgo(7200))).toBe("2 hours ago");
  });

  it("returns 'yesterday' for ~24h ago", () => {
    expect(formatRelative(isoSecondsAgo(86400 + 60))).toBe("yesterday");
  });

  it("returns days ago for 2-6 days", () => {
    expect(formatRelative(isoSecondsAgo(2 * 86400 + 60))).toBe("2 days ago");
    expect(formatRelative(isoSecondsAgo(6 * 86400 + 60))).toBe("6 days ago");
  });

  it("returns weeks ago for 7-27 days", () => {
    expect(formatRelative(isoSecondsAgo(7 * 86400 + 60))).toBe("1 week ago");
    expect(formatRelative(isoSecondsAgo(14 * 86400 + 60))).toBe("2 weeks ago");
  });
});
