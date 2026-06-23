import { SpikeHero, type HeroDirection, type HeroMood } from "./SpikeHero";
import { SCENARIOS } from "./mock";
import "./spike.css";

const DIRECTIONS: { key: HeroDirection; label: string; note: string }[] = [
  { key: "serif", label: "A · Refined Serif", note: "Fraunces display · Martian Mono data — editorial, warm, authoritative" },
  { key: "grotesque", label: "B · Grotesque Editorial", note: "Geist display · Geist Mono data — precise, modern, Linear/Arc calm" },
];

const MOODS: { key: HeroMood; label: string }[] = [
  { key: "bullish", label: "Green day — cool / calm" },
  { key: "bearish", label: "Red day — warm / tense" },
];

export function SpikeGallery() {
  return (
    <div className="sx-page">
      <header className="sx-masthead">
        <span className="sx-brand">MERIDIAN</span>
        <span className="sx-tag">concept spike — hero + mood · pick one direction to lock</span>
      </header>

      <div className="sx-gallery">
        {DIRECTIONS.map((dir) =>
          MOODS.map((mood) => {
            const scenario = SCENARIOS[mood.key];
            return (
              <div className="sx-cell" key={`${dir.key}-${mood.key}`}>
                <div className="sx-cell-head">
                  <span className="sx-cell-label">{dir.label}</span>
                  <span className="sx-cell-mood">{mood.label}</span>
                </div>
                <SpikeHero
                  direction={dir.key}
                  mood={mood.key}
                  prevClose={scenario.prevClose}
                  points={scenario.points}
                  eyebrow={scenario.eyebrow}
                  narrative={scenario.narrative}
                />
                <p className="sx-cell-note">{dir.note}</p>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
