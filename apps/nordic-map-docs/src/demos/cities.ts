export type City = {
  id: string;
  label: string;
  lat: number;
  lon: number;
};

/** Swedish cities, used as pins in the map demos */
export const cities: City[] = [
  { id: "kiruna", label: "Kiruna", lat: 67.8558, lon: 20.2253 },
  { id: "lulea", label: "Luleå", lat: 65.5848, lon: 22.1547 },
  { id: "umea", label: "Umeå", lat: 63.8258, lon: 20.263 },
  { id: "ostersund", label: "Östersund", lat: 63.1792, lon: 14.6357 },
  { id: "sundsvall", label: "Sundsvall", lat: 62.3908, lon: 17.3069 },
  { id: "gavle", label: "Gävle", lat: 60.6749, lon: 17.1413 },
  { id: "falun", label: "Falun", lat: 60.6065, lon: 15.6355 },
  { id: "uppsala", label: "Uppsala", lat: 59.8586, lon: 17.6389 },
  { id: "vasteras", label: "Västerås", lat: 59.6099, lon: 16.5448 },
  { id: "stockholm", label: "Stockholm", lat: 59.3293, lon: 18.0686 },
  { id: "tyreso", label: "Tyresö", lat: 59.2441, lon: 18.229 },
  { id: "karlstad", label: "Karlstad", lat: 59.3793, lon: 13.5036 },
  { id: "orebro", label: "Örebro", lat: 59.2753, lon: 15.2134 },
  { id: "norrkoping", label: "Norrköping", lat: 58.5877, lon: 16.1924 },
  { id: "linkoping", label: "Linköping", lat: 58.4108, lon: 15.6214 },
  { id: "jonkoping", label: "Jönköping", lat: 57.7826, lon: 14.1618 },
  { id: "goteborg", label: "Göteborg", lat: 57.7089, lon: 11.9746 },
  { id: "boras", label: "Borås", lat: 57.721, lon: 12.9401 },
  { id: "visby", label: "Visby", lat: 57.6348, lon: 18.2948 },
  { id: "vaxjo", label: "Växjö", lat: 56.8777, lon: 14.8091 },
  { id: "kalmar", label: "Kalmar", lat: 56.6634, lon: 16.3568 },
  { id: "halmstad", label: "Halmstad", lat: 56.6745, lon: 12.8578 },
  { id: "helsingborg", label: "Helsingborg", lat: 56.0465, lon: 12.6945 },
  { id: "lund", label: "Lund", lat: 55.7047, lon: 13.191 },
  { id: "malmo", label: "Malmö", lat: 55.605, lon: 13.0038 },
];
