/**
 * Public, no-account informational routes.
 *
 * M16 found nine of these around the reference home page. The reference's own long-form prose
 * is protected, so every sentence here is original SpectreMail text that preserves the role the
 * reference gives each page. Nothing here promises a capability the product does not have: where
 * the reference offers an API, a contact form or a fixed ten-minute lifetime, this record says
 * plainly what SpectreMail actually does instead.
 *
 * @module
 */

export interface PublicRoute {
  readonly path: string;
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly {
    readonly heading: string;
    readonly paragraphs: readonly string[];
  }[];
}

export const PUBLIC_ROUTES: readonly PublicRoute[] = [
  {
    path: "/faq",
    title: "Common questions",
    intro: "Short answers about temporary addresses and what this page does with them.",
    sections: [
      {
        heading: "What is a temporary address?",
        paragraphs: [
          "An address you can use for one signup or one verification without handing over the address you use for everything else. Mail sent to it is readable here while the page is open.",
        ],
      },
      {
        heading: "Do I need an account?",
        paragraphs: [
          "No. SpectreMail asks a provider for an address and keeps this device's note of it in browser storage. There is no account, no login and no SpectreMail-operated mailbox server.",
        ],
      },
      {
        heading: "How long does mail stay?",
        paragraphs: [
          "That is the provider's decision, not a countdown SpectreMail invents. When a provider reports an expiry the page shows it; when it does not, the page says nothing about a lifetime.",
        ],
      },
      {
        heading: "Can I pick a domain?",
        paragraphs: [
          "Change offers the domains a reachable provider reports as active. When no provider exposes a domain list from a browser page, the page says so and offers automatic creation instead.",
        ],
      },
    ],
  },
  {
    path: "/api",
    title: "Developer access",
    intro: "What this product does and does not expose to other applications.",
    sections: [
      {
        heading: "No public API",
        paragraphs: [
          "SpectreMail does not publish an API, an API key or a hosted mailbox endpoint. The providers it reaches are used through their own documented interfaces from the browser or the extension.",
        ],
      },
      {
        heading: "No proxy service",
        paragraphs: [
          "This product does not relay a provider through a SpectreMail server to work around an origin restriction. A provider that a browser page cannot reach is reported as unavailable on the website rather than proxied.",
        ],
      },
    ],
  },
  {
    path: "/10minutemail",
    title: "Ten-minute mail",
    intro: "A short-lived address for a task you will finish in one sitting.",
    sections: [
      {
        heading: "How it works here",
        paragraphs: [
          "SpectreMail does not impose a ten-minute countdown. It keeps the page's inbox available while you are looking at it and uses the provider's own signals to decide when an address has expired.",
        ],
      },
      {
        heading: "When to use one",
        paragraphs: [
          "Use a short-lived address for a trial, a forum signup or a download you will not revisit. Anything you need to keep, keep in your own mailbox.",
        ],
      },
    ],
  },
  {
    path: "/email-generator",
    title: "Email generator",
    intro: "Get a usable address without filling in a form.",
    sections: [
      {
        heading: "Automatic creation",
        paragraphs: [
          "The page asks a provider for an address as soon as it boots, and shows it only after the provider confirms it. Change asks for another; Delete makes this device forget the one it holds.",
        ],
      },
      {
        heading: "Copy and read",
        paragraphs: [
          "The address stays selectable text. Copy puts that exact value on the clipboard, and the inbox below lists what arrived at it.",
        ],
      },
    ],
  },
  {
    path: "/privacy-policy",
    title: "Privacy",
    intro: "The short version; the full record lives in the repository's privacy document.",
    sections: [
      {
        heading: "What stays on this device",
        paragraphs: [
          "The address this browser holds, a map of sites where it was inserted, and the seen-message record used for notifications. No account and no SpectreMail-operated server are involved.",
        ],
      },
      {
        heading: "What goes to a provider",
        paragraphs: [
          "Provider requests go only to the provider that issued the mailbox. Codes and links are read from message content on this page and are never submitted anywhere by SpectreMail.",
        ],
      },
    ],
  },
  {
    path: "/terms-of-service",
    title: "Terms",
    intro: "The conditions this product actually operates under.",
    sections: [
      {
        heading: "No service contract",
        paragraphs: [
          "SpectreMail is provided as-is. It does not sell a mailbox service, does not promise delivery, and does not claim ownership of a provider's domains or messages.",
        ],
      },
      {
        heading: "Provider conditions",
        paragraphs: [
          "Each provider's own conditions still apply to the mailbox it issues. Where this repository could not establish a provider's terms, it says so rather than guessing at an obligation.",
        ],
      },
    ],
  },
  {
    path: "/contact",
    title: "Contact",
    intro: "There is no contact form on this build; here is what that means.",
    sections: [
      {
        heading: "No send endpoint",
        paragraphs: [
          "SpectreMail operates no mail server and no support inbox, so this page does not render a form that would go nowhere. The source repository is the place to report a defect or ask a question.",
        ],
      },
    ],
  },
  {
    path: "/blog",
    title: "Reading list",
    intro: "Short notes about disposable addresses, written for this product.",
    sections: [
      {
        heading: "Why a short-lived address helps",
        paragraphs: [
          "It keeps one-off signups away from the inbox you read every day, and it gives you a place to collect a code or a verification link without another service learning your real address.",
        ],
      },
      {
        heading: "Choosing a domain that works",
        paragraphs: [
          "A fresh domain is not automatically an unblocked one. SpectreMail only offers domains a provider reports as active, and says plainly when no list is available from the current client.",
        ],
      },
      {
        heading: "Reading mail safely",
        paragraphs: [
          "Message bodies are shown as text, never as markup. A detected code is copied only when you press a control, and a detected link opens only when you choose to open it.",
        ],
      },
    ],
  },
  {
    path: "/change",
    title: "Change address",
    intro: "How this product replaces the address it holds.",
    sections: [
      {
        heading: "One change, one new mailbox",
        paragraphs: [
          "Change keeps the old address on screen until the provider confirms a new one. Repeated presses are coalesced, and a slower answer from an earlier request cannot overwrite the newer mailbox.",
        ],
      },
      {
        heading: "Choosing a domain",
        paragraphs: [
          "Where a reachable provider reports active domains, Change offers them before creating. A chosen domain stays with its owning provider; the page never falls back to a different one for that address.",
        ],
      },
    ],
  },
];
