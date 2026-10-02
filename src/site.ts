export const SITE = {
  name: "Azure Lin",
  description: "Azure Lin — robotics, planning, and reliable embodied AI.",
  // Level-0 nodes of the constellation; id doubles as the URL segment and the content folder.
  sections: [
    { id: "blog", anchor: [0.24, 0.28] },
    { id: "about", anchor: [0.76, 0.3] },
    { id: "projects", anchor: [0.7, 0.73] }
  ] as const
};

export type Section = (typeof SITE.sections)[number]["id"];
