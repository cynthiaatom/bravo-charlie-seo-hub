import {
  Bookmark,
  Bot,
  Building2,
  ClipboardCheck,
  Globe,
  LayoutDashboard,
  Link2,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { linkOptions } from "@tanstack/react-router";
import { GoogleGlyphMuted } from "@/client/features/gsc/GoogleGlyph";

const projectNavItems = [
  { to: "/p/$projectId" as const, label: "Dashboard", icon: LayoutDashboard, activeOptions: { exact: true, includeSearch: false } },
  { to: "/p/$projectId/keywords" as const, label: "Keyword Research", icon: Search },
  { to: "/p/$projectId/saved" as const, label: "Saved Keywords", icon: Bookmark },
  { to: "/p/$projectId/rank-tracking" as const, label: "Rank Tracking", icon: TrendingUp },
  { to: "/p/$projectId/search-performance" as const, label: "GSC Insights", icon: GoogleGlyphMuted },
  { to: "/p/$projectId/domain" as const, label: "Domain Overview", icon: Globe },
  { to: "/p/$projectId/backlinks" as const, label: "Backlinks", icon: Link2 },
  { to: "/p/$projectId/audit" as const, label: "Site Audit", icon: ClipboardCheck },
  { to: "/p/$projectId/brand-lookup" as const, label: "Brand Lookup", icon: Sparkles },
  { to: "/p/$projectId/prompt-explorer" as const, label: "Prompt Explorer", icon: MessageSquare },
] as const;

const clientsNavItem = linkOptions({
  to: "/clients" as const,
  label: "Clients",
  icon: Building2,
});

const aiNavItem = linkOptions({
  to: "/ai" as const,
  label: "AI & MCP",
  icon: Bot,
});

export const connectNavGroup = {
  label: "Bravo Charlie",
  items: [clientsNavItem, aiNavItem],
};

function getProjectNavItems(projectId: string) {
  return linkOptions(projectNavItems.map((item) => ({ ...item, params: { projectId }, search: {} })));
}

export function getProjectNavGroups(projectId: string) {
  const all = getProjectNavItems(projectId);
  const byPath = (path: (typeof projectNavItems)[number]["to"]) => all.find((i) => i.to === path)!;
  return [
    { label: "Overview", items: [byPath("/p/$projectId")] },
    { label: "Research", items: [byPath("/p/$projectId/keywords"), byPath("/p/$projectId/domain"), byPath("/p/$projectId/backlinks"), byPath("/p/$projectId/brand-lookup"), byPath("/p/$projectId/prompt-explorer")] },
    { label: "My Site", items: [byPath("/p/$projectId/search-performance"), byPath("/p/$projectId/rank-tracking"), byPath("/p/$projectId/saved"), byPath("/p/$projectId/audit")] },
  ];
}

export const dataforseoHelpLinkOptions = linkOptions({ to: "/help/dataforseo-api-key" });
