export type NavigationItemDefinition = {
  labelKey?: string;
  label: string;
  url: string;
  sortOrder: number;
  roleVisibility: string[];
};

export type NavigationDefinition = {
  key: string;
  label: string;
  items: NavigationItemDefinition[];
};

export const navigationDefaults: NavigationDefinition[] = [
  {
    key: "header",
    label: "Public header",
    items: [
      {
        labelKey: "nav.howItWorks",
        label: "How it works",
        url: "#how-it-works",
        sortOrder: 10,
        roleVisibility: ["guest"],
      },
      {
        labelKey: "nav.features",
        label: "Why Denobelpro",
        url: "#features",
        sortOrder: 20,
        roleVisibility: ["guest"],
      },
      { labelKey: "nav.faq", label: "FAQ", url: "#faq", sortOrder: 30, roleVisibility: ["guest"] },
      {
        labelKey: "nav.signIn",
        label: "Sign in",
        url: "/login",
        sortOrder: 40,
        roleVisibility: ["guest"],
      },
      {
        labelKey: "nav.workspace",
        label: "My workspace",
        url: "/account",
        sortOrder: 50,
        roleVisibility: ["admin", "staff", "client"],
      },
    ],
  },
  {
    key: "footer",
    label: "Public footer",
    items: [
      {
        labelKey: "footer.help",
        label: "Help centre",
        url: "/help",
        sortOrder: 10,
        roleVisibility: ["guest", "admin", "staff", "client"],
      },
      {
        labelKey: "footer.privacy",
        label: "Privacy",
        url: "/privacy",
        sortOrder: 20,
        roleVisibility: ["guest", "admin", "staff", "client"],
      },
      {
        labelKey: "footer.terms",
        label: "Terms",
        url: "/terms",
        sortOrder: 30,
        roleVisibility: ["guest", "admin", "staff", "client"],
      },
      {
        labelKey: "nav.signIn",
        label: "Sign in",
        url: "/login",
        sortOrder: 40,
        roleVisibility: ["guest"],
      },
    ],
  },
];
