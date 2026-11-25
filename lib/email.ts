import "server-only";

const site = "https://www.fran6autopart.com";
const from = "FRAN6 <noreply@fran6autopart.com>";

const formatNaira = (value: number) => `₦${value.toLocaleString("en-NG")}`;

function letter(title: string, paragraphs: string[], action?: { href: string; label: string }) {
  const body = paragraphs.map((paragraph) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#242720;">${paragraph}</p>`).join("");
  const button = action
    ? `<p style="margin:24px 0;"><a href="${action.href}" style="display:inline-block;padding:12px 18px;background:#737D6C;color:#ffffff;text-decoration:none;font-weight:700;">${action.label}</a></p>`
    : "";
  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F3F1EB;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F1EB;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;padding:32px 28px;">
        <tr><td>
          <img src="${site}/fran6-header-logo.png" alt="FRAN6" width="168" style="display:block;width:168px;height:auto;margin:0 0 28px;" />
          <h1 style="margin:0 0 18px;font-family:Arial, Helvetica, sans-serif;font-size:28px;font-weight:600;line-height:1.2;color:#242720;">${title}</h1>
          <div style="font-family:Arial, Helvetica, sans-serif;">${body}${button}</div>
          <p style="margin:28px 0 0;font-family:Arial, Helvetica, sans-serif;font-size:13px;line-height:1.5;color:#697267;">FRAN6 motor spare parts<br /><a href="${site}" style="color:#737D6C;">fran6autopart.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [title, "", ...paragraphs.map((paragraph) => paragraph.replace(/<[^>]+>/g, "")), action ? `${action.label}: ${action.href}` : "", "FRAN6 motor spare parts", site]
    .filter(Boolean)
    .join("\n");
  return { html, text };
}

export async function sendFran6Email(input: { to: string; subject: string; html: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false as const, reason: "RESEND_API_KEY is not set on the server." };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
  });
  if (!response.ok) return { sent: false as const, reason: "The email service did not accept the message." };
  return { sent: true as const };
}

export function welcomeLetter(name: string) {
  const greeting = name ? `Hello ${name},` : "Hello,";
  return letter(
    "Welcome to FRAN6",
    [
      greeting,
      "Your FRAN6 account is ready. You can sign in with this email, or with the phone number you added, and order parts for your car.",
      "If a confirmation message arrives as well, open it and confirm the address so card checkout stays available on your account.",
      "We are glad you are here.",
    ],
    { href: site, label: "Visit the shop" },
  );
}

const orderMessages: Record<string, { subject: string; title: string; detail: string }> = {
  awaiting_payment: {
    subject: "Your FRAN6 order is waiting for payment",
    title: "Waiting for payment",
    detail: "This order is saved, and FRAN6 is waiting for the Paystack payment.",
  },
  paid: {
    subject: "We received your FRAN6 order",
    title: "Order received",
    detail: "Your payment was received. FRAN6 will confirm the order and email you when it moves ahead.",
  },
  whatsapp_requested: {
    subject: "FRAN6 received your order request",
    title: "Order request received",
    detail: "FRAN6 has your WhatsApp order request and will confirm availability and delivery.",
  },
  processing: {
    subject: "FRAN6 confirmed your order",
    title: "Order confirmed",
    detail: "FRAN6 confirmed this order and is preparing it.",
  },
  completed: {
    subject: "Your FRAN6 order is complete",
    title: "Order complete",
    detail: "This order is complete. Thank you for shopping with FRAN6.",
  },
  cancelled: {
    subject: "Your FRAN6 order was cancelled",
    title: "Order cancelled",
    detail: "FRAN6 cancelled this order. Sign in to view the details, or contact the shop if you still need the parts.",
  },
};

export function orderUpdateLetter(input: { name: string; reference: string; total: number; status: string; items: { name: string; quantity: number }[] }) {
  const message = orderMessages[input.status] ?? orderMessages.paid;
  const greeting = input.name ? `Hello ${input.name},` : "Hello,";
  const parts = input.items.length
    ? input.items.map((item) => `${item.name} × ${item.quantity}`).join(", ")
    : "the parts on your order";
  return {
    subject: message.subject,
    ...letter(
      message.title,
      [
        greeting,
        message.detail,
        `Order ${input.reference}: ${parts}.`,
        `Order total: ${formatNaira(input.total)}.`,
        "Sign in with the same account to open the order.",
      ],
      { href: `${site}/orders/${input.reference}`, label: "View order details" },
    ),
  };
}
