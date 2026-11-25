"use client";

import { useEffect, useReducer, useRef } from "react";
import {
  initialGame, landing, positions, randomDrop, updateGame,
  type Action, type Color,
} from "./game";

const controls = [
  { keys: ["←", "→"], text: "Posun" },
  { keys: ["↑"], text: "Otočenie" },
  { keys: ["↓"], text: "Zrýchlenie" },
  { keys: ["Medzerník"], text: "Okamžitý pád" },
  { keys: ["P"], text: "Pauza" },
];

const colors: Record<Color, string> = { 1: "tyrkysový", 2: "fialový", 3: "oranžový", 4: "zelený" };

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

export default function Home() {
  const [game, dispatch] = useReducer(updateGame, initialGame);
  const fieldRef = useRef<HTMLDivElement>(null);
  const { board, piece, next, score, cleared, chain, status } = game;
  const level = Math.floor(cleared / 30) + 1;

  function start() {
    dispatch({
      type: "start",
      first: status === "ready" ? initialGame.piece : randomDrop(),
      next: status === "ready" ? initialGame.next : randomDrop(),
    });
  }

  useEffect(() => {
    if (status !== "playing") return;
    const interval = window.setInterval(
      () => dispatch({ type: "tick", next: randomDrop() }),
      Math.max(180, 850 - (level - 1) * 90),
    );
    return () => window.clearInterval(interval);
  }, [status, level]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.target instanceof HTMLButtonElement && event.key === " ") return;
      if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        if (!event.repeat) dispatch({ type: status === "paused" ? "resume" : "pause" });
        return;
      }
      if (status !== "playing") return;
      const actions: Record<string, Action["type"]> = {
        ArrowLeft: "left", ArrowRight: "right", ArrowUp: "rotate", ArrowDown: "down", " ": "drop",
      };
      const type = actions[event.key];
      if (!type) return;
      event.preventDefault();
      if (type === "drop" || type === "down") {
        if (type === "down" || !event.repeat) dispatch({ type, next: randomDrop() });
      } else if (type === "left" || type === "right" || type === "rotate") {
        dispatch({ type });
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [status]);

  const visiblePiece = status !== "over";
  const active = new Set(visiblePiece ? positions(piece).map(([x, y]) => cellKey(x, y)) : []);
  const ghost = new Set(visiblePiece ? positions(landing(board, piece)).map(([x, y]) => cellKey(x, y)) : []);
  const preview = new Set(next.shape.map(([x, y]) => cellKey(x, y)));
  const nextWidth = Math.max(...next.shape.map(([x]) => x)) + 1;
  const nextHeight = Math.max(...next.shape.map(([, y]) => y)) + 1;

  return (
    <main className="shell">
      <header className="heading">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true"><i /><i /><i /><i /></span>
          <h1>Ion<span>Stack</span></h1>
        </div>
        <p>Spoj aspoň šesť susediacich buniek rovnakej farby a spusti reakciu.</p>
      </header>

      <div className="game-layout">
        <section className="panel board-panel" aria-label="Hra">
          <div className="board-header">
            <span className="status"><i data-active={status === "playing"} />{{
              ready: "Pripravené", playing: "Hra prebieha", paused: "Pauza", over: "Koniec hry",
            }[status]}</span>
            <button className="text-button" type="button" disabled={status !== "playing" && status !== "paused"} onClick={() => {
              dispatch({ type: status === "paused" ? "resume" : "pause" });
              fieldRef.current?.focus({ preventScroll: true });
            }}>
              {status === "paused" ? "Pokračovať" : "Pauza"}
            </button>
          </div>

          <div className="field" ref={fieldRef} tabIndex={-1} role="group" aria-label="Hracia plocha">
            <div className="board" aria-hidden="true">
              {board.map((row, y) => row.map((cell, x) => {
                const key = cellKey(x, y);
                const color = active.has(key) ? piece.color : cell;
                return <div key={key} className="cell" data-color={color || undefined} data-ghost={!color && ghost.has(key) ? piece.color : undefined} />;
              }))}
            </div>

            {status !== "playing" && (
              <div className="overlay">
                <div className="prompt">
                  <span className="prompt-symbol" aria-hidden="true">✳</span>
                  <h2>{{ ready: "Prvá reakcia", paused: "Hra pozastavená", over: "Koniec hry" }[status]}</h2>
                  {status === "over" && <p>Výsledok · {score} bodov</p>}
                  <button className="primary" type="button" onClick={() => {
                    if (status === "paused") dispatch({ type: "resume" });
                    else start();
                    fieldRef.current?.focus({ preventScroll: true });
                  }}>
                    {{ ready: "Spustiť hru", paused: "Pokračovať", over: "Hrať znova" }[status]}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="touch-controls" aria-label="Dotykové ovládanie">
            <button type="button" disabled={status !== "playing"} aria-label="Doľava" onClick={() => dispatch({ type: "left" })}>←</button>
            <button type="button" disabled={status !== "playing"} aria-label="Doprava" onClick={() => dispatch({ type: "right" })}>→</button>
            <button type="button" disabled={status !== "playing"} aria-label="Otočiť" onClick={() => dispatch({ type: "rotate" })}>↻</button>
            <button type="button" disabled={status !== "playing"} aria-label="Položiť" onClick={() => dispatch({ type: "drop", next: randomDrop() })}>↓</button>
          </div>
        </section>

        <aside className="side">
          <section className="panel stats" aria-label="Štatistiky">
            <div className="score">
              <span>SKÓRE</span><strong>{score.toLocaleString("sk-SK")}</strong>
            </div>
            <dl>
              <div><dt>Úroveň</dt><dd>{level}</dd></div>
              <div><dt>Odstránené</dt><dd>{cleared}</dd></div>
              <div><dt>Posledná reakcia</dt><dd>{chain ? `×${chain}` : "–"}</dd></div>
            </dl>
          </section>

          <section className="panel next-panel">
            <h2>Na rade</h2>
            <div className="next-well">
              <div className="next-piece" role="img" aria-label={`Nasledujúci dielik je ${colors[next.color]}`} style={{ gridTemplateColumns: `repeat(${nextWidth}, 19px)` }}>
                {Array.from({ length: nextWidth * nextHeight }, (_, i) => {
                  const key = cellKey(i % nextWidth, Math.floor(i / nextWidth));
                  return <div key={key} className="cell" data-color={preview.has(key) ? next.color : undefined} />;
                })}
              </div>
            </div>
          </section>

          <section className="panel help">
            <h2>Ovládanie</h2>
            <ul>
              {controls.map(({ keys, text }) => (
                <li key={text}><span>{text}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
