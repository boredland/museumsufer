import { classifyEvent } from "./src/shared";

const tests = [
  "Offene Kinderwerkstatt",
  "Öffentliche Domturmführung",
  "Buchpräsentation: Rainer Rother",
  "Konzert im Park",
  "Vernissage: Neue Ausstellung",
  "VERHÄNGNIS (Film)",
];

for (const t of tests) {
  console.log(`${t} -> ${classifyEvent(t)}`);
}
