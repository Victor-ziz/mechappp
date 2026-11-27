export type StoreContact = {
  whatsappNumber: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  xUrl: string;
};

export const defaultStoreContact: StoreContact = {
  whatsappNumber: "2349069245835",
  instagramUrl: "",
  facebookUrl: "",
  tiktokUrl: "",
  xUrl: "",
};

const socialHosts = {
  instagramUrl: ["instagram.com"],
  facebookUrl: ["facebook.com", "fb.com"],
  tiktokUrl: ["tiktok.com"],
  xUrl: ["x.com", "twitter.com"],
} as const;

export function whatsappDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 15);
}

export function whatsappLabel(digits: string) {
  if (digits.startsWith("234") && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return `+${digits}`;
}

export function cleanSocialUrl(value: string, hosts: readonly string[]) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (url.protocol !== "https:" || !hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null;
  return url.toString();
}

export function cleanStoreContact(input: StoreContact): { contact: StoreContact } | { error: string } {
  const whatsappNumber = whatsappDigits(input.whatsappNumber);
  if (whatsappNumber.length < 10) return { error: "Enter a WhatsApp number with at least 10 digits." };
  const next: StoreContact = { ...defaultStoreContact, whatsappNumber };
  for (const key of Object.keys(socialHosts) as Array<keyof typeof socialHosts>) {
    const cleaned = cleanSocialUrl(input[key], socialHosts[key]);
    if (cleaned === null) return { error: "Use a full link for each social page, such as https://instagram.com/fran6." };
    next[key] = cleaned;
  }
  return { contact: next };
}
