import { describe, expect, it } from "vitest";
import { resolveVideoSource } from "./video-url";

const VK_EMBED = "https://vkvideo.ru/video_ext.php?oid=-12345&id=67890&hd=2";
const RUTUBE_ID = "0123456789abcdef0123456789abcdef";

describe("resolveVideoSource — VK", () => {
  it.each([
    "https://vk.ru/video-12345_67890",
    "https://vk.com/video-12345_67890",
    "https://vkvideo.ru/video-12345_67890",
    "https://www.vk.com/video-12345_67890",
    "https://m.vk.com/video-12345_67890",
  ])("%s", (url) => {
    expect(resolveVideoSource(url)).toEqual({ kind: "iframe", provider: "vk", src: VK_EMBED });
  });

  it("готовый video_ext.php", () => {
    expect(resolveVideoSource("https://vk.com/video_ext.php?oid=-12345&id=67890&hd=1")).toEqual({
      kind: "iframe",
      provider: "vk",
      src: VK_EMBED,
    });
  });

  it("положительный oid", () => {
    expect(resolveVideoSource("https://vk.com/video12345_67890")?.src).toBe(
      "https://vkvideo.ru/video_ext.php?oid=12345&id=67890&hd=2"
    );
  });

  it("hash переносится, только если он hex", () => {
    expect(resolveVideoSource("https://vkvideo.ru/video-12345_67890?hash=abc123")?.src).toBe(
      `${VK_EMBED}&hash=abc123`
    );
    expect(resolveVideoSource("https://vkvideo.ru/video-12345_67890?hash=a%22b")?.src).toBe(
      VK_EMBED
    );
  });

  it("без id видео → null", () => {
    expect(resolveVideoSource("https://vk.com/club12345")).toBeNull();
    expect(resolveVideoSource("https://vk.com/video_ext.php?oid=abc&id=1")).toBeNull();
  });
});

describe("resolveVideoSource — Rutube", () => {
  it.each([
    `https://rutube.ru/video/${RUTUBE_ID}/`,
    `https://rutube.ru/play/embed/${RUTUBE_ID}`,
    `https://www.rutube.ru/shorts/${RUTUBE_ID}/`,
  ])("%s", (url) => {
    expect(resolveVideoSource(url)).toEqual({
      kind: "iframe",
      provider: "rutube",
      src: `https://rutube.ru/play/embed/${RUTUBE_ID}`,
    });
  });

  it("неверный путь → null", () => {
    expect(resolveVideoSource("https://rutube.ru/channel/123/")).toBeNull();
    expect(resolveVideoSource("https://rutube.ru/video/xyz/")).toBeNull();
  });
});

describe("resolveVideoSource — собственные файлы", () => {
  it("/media/*.mp4|webm → file", () => {
    expect(resolveVideoSource("/media/video/clip.mp4")).toEqual({
      kind: "file",
      src: "/media/video/clip.mp4",
    });
    expect(resolveVideoSource("/media/video/clip.WEBM")?.kind).toBe("file");
  });

  it("прочие пути → null", () => {
    expect(resolveVideoSource("/media/../secret.mp4")).toBeNull();
    expect(resolveVideoSource("/media/clip.exe")).toBeNull();
    expect(resolveVideoSource("/uploads/clip.mp4")).toBeNull();
  });
});

describe("resolveVideoSource — отказ", () => {
  it.each([
    "http://vk.com/video-1_2",
    "https://evil.com/video-1_2",
    "https://vk.com.evil.com/video-1_2",
    "https://evilvk.com/video-1_2",
    "https://user:pass@vk.com/video-1_2",
    "https://youtu.be/abcdef",
    "javascript:alert(1)",
    "//evil.com/video-1_2",
    "data:video/mp4;base64,AAAA",
    "",
    "not a url",
  ])("%s → null", (url) => {
    expect(resolveVideoSource(url)).toBeNull();
  });
});
