export default function manifest() {
  return {
    id: "/",
    name: "NFL Vegas Tracker",
    short_name: "NFL Vegas",
    description: "NFL game results, betting lines, and historical analytics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone","minimal-ui"],
    orientation: "any",
    background_color: "#0c1420",
    theme_color: "#0c1420",
    categories: ["sports","finance","utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
