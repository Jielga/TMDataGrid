import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

export type Demo = {
  /** Unique id, used as the URL hash, for example `#sweden-map` */
  id: string;
  /** Name shown in the sidebar and as the page title */
  label: string;
  /** Sidebar group. Groups are shown in the order they first appear in `demos` */
  group: string;
  /** One-line summary shown under the page title and in search */
  description: string;
  /** Lazy loaded, so each demo and the packages it uses get their own chunk */
  component: LazyExoticComponent<ComponentType>;
};

export const demos: Demo[] = [
  {
    id: "sweden-map",
    label: "Sweden map",
    group: "Maps",
    description: "Offline SVG map of Sweden with E-roads and GPS pins: drag to select pins, scroll or pinch to zoom.",
    component: lazy(async () => {
      const module = await import("./sweden-map/SwedenMapDemo.tsx");
      return { default: module.SwedenMapDemo };
    }),
  },
  {
    id: "nordic-map",
    label: "Nordic map",
    group: "Maps",
    description: "Canvas map with smooth zoom up to 50 times, gliding pan and tiled data, built to grow to more detail and more countries.",
    component: lazy(async () => {
      const module = await import("./nordic-map/NordicMapDemo.tsx");
      return { default: module.NordicMapDemo };
    }),
  },
];

export type DemoGroup = {
  name: string;
  demos: Demo[];
};

export function groupDemos(list: Demo[]): DemoGroup[] {
  const groups = new Map<string, Demo[]>();
  for (const demo of list) {
    const group = groups.get(demo.group) ?? [];
    group.push(demo);
    groups.set(demo.group, group);
  }
  return Array.from(groups, ([name, groupDemos]) => {
    return { name, demos: groupDemos };
  });
}

export function findDemo(id: string): Demo | undefined {
  return demos.find((demo) => {
    return demo.id === id;
  });
}
