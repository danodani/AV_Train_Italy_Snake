import { useState, useEffect, useCallback, useRef } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type Difficulty = 'easy' | 'medium' | 'hard';
type GameState = 'idle' | 'playing' | 'paused' | 'gameover';

const GRID_SIZE = 20;
const CELL_SIZE = 20;

const SPEED_MAP: Record<Difficulty, number> = {
  easy: 180,
  medium: 120,
  hard: 70,
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Facile',
  medium: 'Medio',
  hard: 'Difficile',
};

function getRandomPosition(snake: Position[]): Position {
  let pos: Position;
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  return pos;
}

export default function App() {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [gameState, setGameState] = useState<GameState>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [showControls, setShowControls] = useState(false);

  const directionRef = useRef<Direction>(direction);
  const gameStateRef = useRef<GameState>(gameState);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameLoopRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setShowControls(window.innerWidth < 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const resetGame = useCallback(() => {
    const initialSnake = [{ x: 10, y: 10 }];
    setSnake(initialSnake);
    setFood(getRandomPosition(initialSnake));
    setDirection('RIGHT');
    setScore(0);
    setGameState('idle');
  }, []);

  const startGame = useCallback(() => {
    if (gameState === 'gameover' || gameState === 'idle') {
      const initialSnake = [{ x: 10, y: 10 }];
      setSnake(initialSnake);
      setFood(getRandomPosition(initialSnake));
      setDirection('RIGHT');
      setScore(0);
    }
    setGameState('playing');
  }, [gameState]);

  const togglePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
    } else if (gameState === 'paused') {
      setGameState('playing');
    }
  }, [gameState]);

  const changeDirection = useCallback((newDir: Direction) => {
    const opposites: Record<Direction, Direction> = {
      UP: 'DOWN',
      DOWN: 'UP',
      LEFT: 'RIGHT',
      RIGHT: 'LEFT',
    };
    if (opposites[newDir] !== directionRef.current) {
      setDirection(newDir);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          changeDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          changeDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          changeDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          changeDirection('RIGHT');
          break;
        case ' ':
          e.preventDefault();
          if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
            startGame();
          } else {
            togglePause();
          }
          break;
        case 'Escape':
          e.preventDefault();
          togglePause();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, startGame, togglePause]);

  // Touch controls (swipe)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const minSwipe = 30;

      if (Math.abs(dx) < minSwipe && Math.abs(dy) < minSwipe) return;

      if (Math.abs(dx) > Math.abs(dy)) {
        changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        changeDirection(dy > 0 ? 'DOWN' : 'UP');
      }
      touchStartRef.current = null;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [changeDirection]);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }

    const speed = SPEED_MAP[difficulty];

    const gameLoop = (timestamp: number) => {
      if (timestamp - lastTimeRef.current >= speed) {
        lastTimeRef.current = timestamp;

        setSnake(prevSnake => {
          const head = { ...prevSnake[0] };
          const dir = directionRef.current;

          switch (dir) {
            case 'UP': head.y -= 1; break;
            case 'DOWN': head.y += 1; break;
            case 'LEFT': head.x -= 1; break;
            case 'RIGHT': head.x += 1; break;
          }

          // Wall collision
          if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
            setGameState('gameover');
            return prevSnake;
          }

          // Self collision
          if (prevSnake.some(s => s.x === head.x && s.y === head.y)) {
            setGameState('gameover');
            return prevSnake;
          }

          const newSnake = [head, ...prevSnake];

          // Food collision
          setFood(prevFood => {
            if (head.x === prevFood.x && head.y === prevFood.y) {
              setScore(s => {
                const newScore = s + 10;
                setHighScore(hs => {
                  const newHs = Math.max(hs, newScore);
                  localStorage.setItem('snake-highscore', newHs.toString());
                  return newHs;
                });
                return newScore;
              });
              return getRandomPosition(newSnake);
            }
            newSnake.pop();
            return prevFood;
          });

          return newSnake;
        });
      }

      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };

    gameLoopRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState, difficulty]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = GRID_SIZE * CELL_SIZE;
    canvas.width = size;
    canvas.height = size;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(size, i * CELL_SIZE);
      ctx.stroke();
    }

    // Food with glow
    ctx.shadowColor = '#ff6b6b';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      const progress = index / snake.length;

      if (isHead) {
        ctx.shadowColor = '#4ecdc4';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#4ecdc4';
      } else {
        ctx.shadowBlur = 0;
        const r = Math.round(78 - progress * 30);
        const g = Math.round(205 - progress * 60);
        const b = Math.round(196 - progress * 60);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      }

      const padding = isHead ? 1 : 2;
      const radius = isHead ? 5 : 3;

      // Rounded rect
      const x = segment.x * CELL_SIZE + padding;
      const y = segment.y * CELL_SIZE + padding;
      const w = CELL_SIZE - padding * 2;
      const h = CELL_SIZE - padding * 2;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      // Eyes on head
      if (isHead) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#1a1a2e';
        const eyeSize = 3;
        let eye1X = 0, eye1Y = 0, eye2X = 0, eye2Y = 0;
        const cx = segment.x * CELL_SIZE + CELL_SIZE / 2;
        const cy = segment.y * CELL_SIZE + CELL_SIZE / 2;

        switch (direction) {
          case 'RIGHT':
            eye1X = cx + 4; eye1Y = cy - 4;
            eye2X = cx + 4; eye2Y = cy + 4;
            break;
          case 'LEFT':
            eye1X = cx - 4; eye1Y = cy - 4;
            eye2X = cx - 4; eye2Y = cy + 4;
            break;
          case 'UP':
            eye1X = cx - 4; eye1Y = cy - 4;
            eye2X = cx + 4; eye2Y = cy - 4;
            break;
          case 'DOWN':
            eye1X = cx - 4; eye1Y = cy + 4;
            eye2X = cx + 4; eye2Y = cy + 4;
            break;
        }
        ctx.beginPath();
        ctx.arc(eye1X, eye1Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(eye2X, eye2Y, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Overlay for paused/gameover
    if (gameState === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', size / 2, size / 2 - 10);
      ctx.font = '14px sans-serif';
      ctx.fillText('Premi Spazio per continuare', size / 2, size / 2 + 20);
    }

    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', size / 2, size / 2 - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Punteggio: ${score}`, size / 2, size / 2 + 15);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Premi Spazio o tocca per ricominciare', size / 2, size / 2 + 45);
    }

    if (gameState === 'idle') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#4ecdc4';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐍 SNAKE', size / 2, size / 2 - 20);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Premi Spazio o tocca per iniziare', size / 2, size / 2 + 15);
    }
  }, [snake, food, direction, gameState, score]);

  const handleCanvasClick = () => {
    if (gameState === 'idle' || gameState === 'gameover') {
      startGame();
    } else if (gameState === 'playing' || gameState === 'paused') {
      togglePause();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 flex flex-col items-center justify-center p-4 select-none">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
          🐍 Snake Game
        </h1>

        {/* Score Board */}
        <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-sm rounded-xl px-4 py-3 border border-slate-700/50">
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Punteggio</div>
            <div className="text-2xl font-bold text-emerald-400">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Record</div>
            <div className="text-2xl font-bold text-amber-400">{highScore}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase tracking-wider">Difficoltà</div>
            <div className="text-lg font-bold text-cyan-400">{DIFFICULTY_LABELS[difficulty]}</div>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-emerald-500/10 border-2 border-slate-700/50">
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          className="block cursor-pointer"
          style={{ width: `min(${GRID_SIZE * CELL_SIZE}px, calc(100vw - 2rem))`, height: `min(${GRID_SIZE * CELL_SIZE}px, calc(100vw - 2rem))` }}
          onClick={handleCanvasClick}
        />
      </div>

      {/* Controls */}
      <div className="w-full max-w-lg mt-4 space-y-3">
        {/* Difficulty Selector */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-slate-400 mr-2">Difficoltà:</span>
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => {
                if (gameState !== 'playing') {
                  setDifficulty(d);
                }
              }}
              disabled={gameState === 'playing'}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                difficulty === d
                  ? d === 'easy'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                    : d === 'medium'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
              } ${gameState === 'playing' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-3">
          {gameState === 'idle' ? (
            <button
              onClick={startGame}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              ▶ Inizia
            </button>
          ) : (
            <>
              <button
                onClick={togglePause}
                className="px-5 py-2.5 bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-600 hover:bg-slate-600 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {gameState === 'paused' ? '▶ Riprendi' : '⏸ Pausa'}
              </button>
              <button
                onClick={resetGame}
                className="px-5 py-2.5 bg-slate-700 text-slate-200 font-medium rounded-xl border border-slate-600 hover:bg-slate-600 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                🔄 Reset
              </button>
            </>
          )}
        </div>

        {/* Touch D-Pad */}
        {showControls && gameState === 'playing' && (
          <div className="flex justify-center mt-4 animate-fade-in">
            <div className="grid grid-cols-3 gap-1.5 w-40">
              <div></div>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('UP'); }}
                className="aspect-square bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-slate-300 active:bg-slate-600 active:scale-95 transition-all border border-slate-600/50"
              >
                ↑
              </button>
              <div></div>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
                className="aspect-square bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-slate-300 active:bg-slate-600 active:scale-95 transition-all border border-slate-600/50"
              >
                ←
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); togglePause(); }}
                className="aspect-square bg-slate-700/50 rounded-xl flex items-center justify-center text-sm text-slate-400 active:bg-slate-600 active:scale-95 transition-all border border-slate-600/50"
              >
                ⏸
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
                className="aspect-square bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-slate-300 active:bg-slate-600 active:scale-95 transition-all border border-slate-600/50"
              >
                →
              </button>
              <div></div>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
                className="aspect-square bg-slate-700/80 rounded-xl flex items-center justify-center text-2xl text-slate-300 active:bg-slate-600 active:scale-95 transition-all border border-slate-600/50"
              >
                ↓
              </button>
              <div></div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-xs text-slate-500 mt-3 space-y-0.5">
          <p>🎮 Frecce / WASD per muoversi • Spazio per pausa/riprendi</p>
          <p>📱 Swipe sullo schermo o usa i pulsanti direzionali</p>
        </div>
      </div>
    </div>
  );
}
