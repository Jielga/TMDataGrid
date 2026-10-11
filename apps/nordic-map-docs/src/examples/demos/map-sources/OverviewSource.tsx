import { NordicMap, swedenOverviewSource } from "@jielga/nordic-map";
import { cities } from "../../data/cities.ts";

export function OverviewSource() {
  return (
    <div style={{ height: "100%" }}>
      <NordicMap source={swedenOverviewSource} label="Cities" pins={cities} maxZoom={6} />
    </div>
  );
}
