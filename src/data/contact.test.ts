import { describe, expect, it } from "vitest";
import {
  WHATSAPP_E164_DIGITS,
  WHATSAPP_PREFILL_MESSAGE,
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedSrc,
  buildGoogleMapsSearchUrl,
  buildWhatsAppUrl,
  formatPakistanMobileDisplay,
  getConfiguredSocialLinks,
  getFollowUsSocialLinks,
  siteContact,
} from "./contact";

describe("site contact WhatsApp & maps helpers", () => {
  it("builds WhatsApp URL with PK country code and no leading zero or spaces", () => {
    const href = buildWhatsAppUrl();
    expect(href.startsWith("https://wa.me/923260505557?text=")).toBe(true);
    expect(href).not.toContain("0326");
    expect(href).not.toMatch(/wa\.me\/92\s/);
    expect(href).toContain(encodeURIComponent(WHATSAPP_PREFILL_MESSAGE));
    expect(WHATSAPP_E164_DIGITS).toBe("923260505557");
    expect(siteContact.whatsapp.placeholder).toBe(false);
    expect(siteContact.whatsapp.href).toBe(href);
  });

  it("formats display number for Pakistan mobile", () => {
    expect(formatPakistanMobileDisplay("923260505557")).toBe("+92 326 0505557");
  });

  it("builds maps embed and directions from the registered Faisalabad office", () => {
    expect(siteContact.location.fullDisplay).toMatch(/Saleemi Chowk, Faisalabad/);
    expect(buildGoogleMapsEmbedSrc()).toContain("output=embed");
    expect(buildGoogleMapsEmbedSrc()).toContain(encodeURIComponent("Global Roots Consultants"));
    expect(buildGoogleMapsDirectionsUrl()).toContain("destination=");
    expect(buildGoogleMapsSearchUrl()).toContain("query=");
    expect(siteContact.location.href).toBe(buildGoogleMapsSearchUrl());
  });

  it("does not invent social profile URLs or Google ratings", () => {
    expect(getFollowUsSocialLinks()).toEqual([]);
    expect(getConfiguredSocialLinks().every((l) => l.id === "whatsapp")).toBe(true);
    expect(siteContact.googleBusiness.placeId).toBeNull();
    expect(siteContact.googleBusiness.rating).toBeNull();
    expect(siteContact.googleBusiness.reviewCount).toBeNull();
    expect(siteContact.googleBusiness.writeReviewUrl).toBeNull();
  });
});
