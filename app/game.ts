export const WIDTH = 8;
export const HEIGHT = 14;
export const MATCH_SIZE = 6;

type Point = readonly [x: number, y: number];
export type Color = 1 | 2 | 3 | 4;
type Cell = 0 | Color;
export type Board = Cell[][];
type Shape = readonly Point[];
type Drop = { shape: Shape; color: Color };
type Piece = Drop & { x: number; y: number };

export type Game = {
  board: Board;
  piece: Piece;
  next: Drop;
  score: number;
  cleared: number;
  chain: number;
  status: "ready" | "playing" | "paused" | "over";
};

export type Action =
  | { type: "start"; first: Drop; next: Drop }
  | { type: "pause" | "resume" | "left" | "right" | "rotate" }
  | { type: "tick" | "down" | "drop"; next: Drop };

const SHAPES: Shape[] = [
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1], [1, 2]],
];

export function randomDrop(): Drop {
  return {
    shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    color: (1 + Math.floor(Math.random() * 4)) as Color,
  };
}

const emptyBoard = (): Board =>
  Array.from({ length: HEIGHT }, () => Array<Cell>(WIDTH).fill(0));

function spawn(drop: Drop): Piece {
  const width = Math.max(...drop.shape.map(([x]) => x)) + 1;
  return { ...drop, x: Math.floor((WIDTH - width) / 2), y: 0 };
}

const firstDrop: Drop = { shape: SHAPES[2], color: 1 };
const secondDrop: Drop = { shape: SHAPES[1], color: 1 };

export const initialGame: Game = {
  board: emptyBoard(),
  piece: spawn(firstDrop),
  next: secondDrop,
  score: 0,
  cleared: 0,
  chain: 0,
  status: "ready",
};

export function positions(piece: Piece): Point[] {
  return piece.shape.map(([x, y]) => [piece.x + x, piece.y + y]);
}

function fits(board: Board, piece: Piece): boolean {
  return positions(piece).every(
    ([x, y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && board[y][x] === 0,
  );
}

export function landing(board: Board, piece: Piece): Piece {
  let result = piece;
  while (fits(board, { ...result, y: result.y + 1 })) {
    result = { ...result, y: result.y + 1 };
  }
  return result;
}

function compact(board: Board) {
  for (let x = 0; x < WIDTH; x++) {
    let writeY = HEIGHT - 1;
    for (let y = HEIGHT - 1; y >= 0; y--) {
      if (board[y][x] !== 0) board[writeY--][x] = board[y][x];
    }
    while (writeY >= 0) board[writeY--][x] = 0;
  }
}

const neighbors: Point[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function matchedCells(board: Board): Point[] {
  const seen = new Set<number>();
  const matched: Point[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const color = board[y][x];
      if (!color || seen.has(y * WIDTH + x)) continue;

      const group: Point[] = [[x, y]];
      seen.add(y * WIDTH + x);
      for (const [cellX, cellY] of group) {
        for (const [dx, dy] of neighbors) {
          const nx = cellX + dx;
          const ny = cellY + dy;
          const index = ny * WIDTH + nx;
          if (board[ny]?.[nx] === color && !seen.has(index)) {
            seen.add(index);
            group.push([nx, ny]);
          }
        }
      }
      if (group.length >= MATCH_SIZE) matched.push(...group);
    }
  }
  return matched;
}

function settle(game: Game, piece: Piece, next: Drop, dropPoints = 0): Game {
  const board = game.board.map((row) => [...row]);
  for (const [x, y] of positions(piece)) board[y][x] = piece.color;
  compact(board);

  let chain = 0;
  let cleared = game.cleared;
  let score = game.score + dropPoints;
  let matches = matchedCells(board);
  while (matches.length) {
    chain++;
    cleared += matches.length;
    score += matches.length * 10 * chain;
    for (const [x, y] of matches) board[y][x] = 0;
    compact(board);
    matches = matchedCells(board);
  }

  const incoming = spawn(game.next);
  return {
    board, score, cleared, chain: chain || game.chain, next,
    piece: incoming,
    status: fits(board, incoming) ? "playing" : "over",
  };
}

export function updateGame(game: Game, action: Action): Game {
  switch (action.type) {
    case "start":
      return { ...initialGame, piece: spawn(action.first), next: action.next, status: "playing" };
    case "pause":
      return game.status === "playing" ? { ...game, status: "paused" } : game;
    case "resume":
      return game.status === "paused" ? { ...game, status: "playing" } : game;
  }

  if (game.status !== "playing") return game;

  const { board, piece } = game;
  switch (action.type) {
    case "left":
    case "right": {
      const moved = { ...piece, x: piece.x + (action.type === "left" ? -1 : 1) };
      return fits(board, moved) ? { ...game, piece: moved } : game;
    }
    case "rotate": {
      const height = Math.max(...piece.shape.map(([, y]) => y));
      const shape: Shape = piece.shape.map(([x, y]) => [height - y, x]);
      for (const dx of [0, -1, 1, -2, 2]) {
        const moved = { ...piece, shape, x: piece.x + dx };
        if (fits(board, moved)) return { ...game, piece: moved };
      }
      return game;
    }
    case "tick":
    case "down": {
      const moved = { ...piece, y: piece.y + 1 };
      return fits(board, moved) ? { ...game, piece: moved } : settle(game, piece, action.next);
    }
    case "drop": {
      const target = landing(board, piece);
      return settle(game, target, action.next, target.y - piece.y);
    }
  }
}
