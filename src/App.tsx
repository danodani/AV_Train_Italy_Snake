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
    const saved = localStorage.getItem('duck-highscore');
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
                  localStorage.setItem('duck-highscore', newHs.toString());
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

    // Background - green meadow
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#2d5a27');
    bgGrad.addColorStop(0.5, '#3a6b34');
    bgGrad.addColorStop(1, '#2d5a27');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // Subtle grid (grass texture)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
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

    // Small grass dots for texture
    ctx.fillStyle = 'rgba(100, 200, 80, 0.15)';
    for (let i = 0; i < 60; i++) {
      const gx = Math.random() * size;
      const gy = Math.random() * size;
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Food - grain disc / bread
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 12;
    const foodCx = food.x * CELL_SIZE + CELL_SIZE / 2;
    const foodCy = food.y * CELL_SIZE + CELL_SIZE / 2;

    // Outer glow ring
    ctx.fillStyle = 'rgba(255, 200, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(foodCx, foodCy, CELL_SIZE / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    // Main disc
    const foodGrad = ctx.createRadialGradient(foodCx - 2, foodCy - 2, 1, foodCx, foodCy, CELL_SIZE / 2 - 1);
    foodGrad.addColorStop(0, '#ffe066');
    foodGrad.addColorStop(0.7, '#f5a623');
    foodGrad.addColorStop(1, '#d4880f');
    ctx.fillStyle = foodGrad;
    ctx.beginPath();
    ctx.arc(foodCx, foodCy, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // Highlight on disc
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(foodCx - 2, foodCy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw ducklings (body) - from tail to head so head is on top
    for (let i = snake.length - 1; i >= 1; i--) {
      const segment = snake[i];
      const cx = segment.x * CELL_SIZE + CELL_SIZE / 2;
      const cy = segment.y * CELL_SIZE + CELL_SIZE / 2;
      const progress = i / snake.length;

      // Chick body
      const chickSize = CELL_SIZE / 2 - 1;

      // Body shadow
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.arc(cx + 1, cy + 1, chickSize, 0, Math.PI * 2);
      ctx.fill();

      // Body
      const chickGrad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, chickSize);
      chickGrad.addColorStop(0, '#fff176');
      chickGrad.addColorStop(0.6, '#ffeb3b');
      chickGrad.addColorStop(1, '#f9a825');
      ctx.fillStyle = chickGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, chickSize, 0, Math.PI * 2);
      ctx.fill();

      // Tiny eyes
      ctx.fillStyle = '#333';
      const eyeOff = 2.5;
      // Determine eye position based on direction of the segment ahead
      const prevSeg = snake[i - 1];
      const ddx = prevSeg.x - segment.x;
      const ddy = prevSeg.y - segment.y;

      let e1x = cx, e1y = cy, e2x = cx, e2y = cy;
      if (ddx > 0) { // moving right
        e1x = cx + eyeOff; e1y = cy - 2;
        e2x = cx + eyeOff; e2y = cy + 2;
      } else if (ddx < 0) { // moving left
        e1x = cx - eyeOff; e1y = cy - 2;
        e2x = cx - eyeOff; e2y = cy + 2;
      } else if (ddy < 0) { // moving up
        e1x = cx - 2; e1y = cy - eyeOff;
        e2x = cx + 2; e2y = cy - eyeOff;
      } else { // moving down
        e1x = cx - 2; e1y = cy + eyeOff;
        e2x = cx + 2; e2y = cy + eyeOff;
      }

      ctx.beginPath();
      ctx.arc(e1x, e1y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(e2x, e2y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Tiny beak
      ctx.fillStyle = '#ff8f00';
      let beakX = cx, beakY = cy;
      if (ddx > 0) { beakX = cx + chickSize; beakY = cy; }
      else if (ddx < 0) { beakX = cx - chickSize; beakY = cy; }
      else if (ddy < 0) { beakX = cx; beakY = cy - chickSize; }
      else { beakX = cx; beakY = cy + chickSize; }

      ctx.beginPath();
      ctx.arc(beakX, beakY, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Slight opacity for older chicks
      if (progress > 0.7) {
        ctx.fillStyle = `rgba(45, 90, 39, ${(progress - 0.7) * 0.3})`;
        ctx.beginPath();
        ctx.arc(cx, cy, chickSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw duck head (first segment)
    const head = snake[0];
    const hx = head.x * CELL_SIZE + CELL_SIZE / 2;
    const hy = head.y * CELL_SIZE + CELL_SIZE / 2;

    // Head shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(hx + 1, hy + 1, CELL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Duck body (white/cream)
    const duckGrad = ctx.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, CELL_SIZE / 2);
    duckGrad.addColorStop(0, '#ffffff');
    duckGrad.addColorStop(0.5, '#f5f5f5');
    duckGrad.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = duckGrad;
    ctx.beginPath();
    ctx.arc(hx, hy, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    // Duck outline
    ctx.strokeStyle = '#bdbdbd';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(hx, hy, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();

    // Duck eyes
    ctx.fillStyle = '#1a1a1a';
    let duckEye1X = hx, duckEye1Y = hy, duckEye2X = hx, duckEye2Y = hy;
    const eyeDist = 3;

    switch (direction) {
      case 'RIGHT':
        duckEye1X = hx + 3; duckEye1Y = hy - 3;
        duckEye2X = hx + 3; duckEye2Y = hy + 3;
        break;
      case 'LEFT':
        duckEye1X = hx - 3; duckEye1Y = hy - 3;
        duckEye2X = hx - 3; duckEye2Y = hy + 3;
        break;
      case 'UP':
        duckEye1X = hx - 3; duckEye1Y = hy - 3;
        duckEye2X = hx + 3; duckEye2Y = hy - 3;
        break;
      case 'DOWN':
        duckEye1X = hx - 3; duckEye1Y = hy + 3;
        duckEye2X = hx + 3; duckEye2Y = hy + 3;
        break;
    }

    ctx.beginPath();
    ctx.arc(duckEye1X, duckEye1Y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(duckEye2X, duckEye2Y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(duckEye1X + 0.5, duckEye1Y - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(duckEye2X + 0.5, duckEye2Y - 0.5, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Duck beak (orange)
    ctx.fillStyle = '#ff8f00';
    let beakTipX = hx, beakTipY = hy;
    switch (direction) {
      case 'RIGHT': beakTipX = hx + CELL_SIZE / 2 + 2; beakTipY = hy; break;
      case 'LEFT': beakTipX = hx - CELL_SIZE / 2 - 2; beakTipY = hy; break;
      case 'UP': beakTipX = hx; beakTipY = hy - CELL_SIZE / 2 - 2; break;
      case 'DOWN': beakTipX = hx; beakTipY = hy + CELL_SIZE / 2 + 2; break;
    }

    ctx.beginPath();
    if (direction === 'RIGHT' || direction === 'LEFT') {
      ctx.ellipse(beakTipX, beakTipY, 4, 2.5, 0, 0, Math.PI * 2);
    } else {
      ctx.ellipse(beakTipX, beakTipY, 2.5, 4, 0, 0, Math.PI * 2);
    }
    ctx.fill();

    // Beak detail
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    if (direction === 'RIGHT' || direction === 'LEFT') {
      ctx.moveTo(beakTipX - 2, beakTipY);
      ctx.lineTo(beakTipX + 2, beakTipY);
    } else {
      ctx.moveTo(beakTipX, beakTipY - 2);
      ctx.lineTo(beakTipX, beakTipY + 2);
    }
    ctx.stroke();

    // Overlay for paused/gameover
    if (gameState === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⏸ PAUSA', size / 2, size / 2 - 10);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#cccccc';
      ctx.fillText('Premi Spazio per continuare', size / 2, size / 2 + 18);
    }

    if (gameState === 'gameover') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥 GAME OVER', size / 2, size / 2 - 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = '15px sans-serif';
      ctx.fillText(`Punteggio: ${score}`, size / 2, size / 2 + 5);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#aaaaaa';
      ctx.fillText('Spazio o tocca per ricominciare', size / 2, size / 2 + 30);
    }

    if (gameState === 'idle') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦆 Duck Snake', size / 2, size / 2 - 20);
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '13px sans-serif';
      ctx.fillText('Spazio o tocca per iniziare', size / 2, size / 2 + 12);
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
    <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-950 to-green-950 flex flex-col items-center justify-center p-4 select-none">
      {/* Header */}
      <div className="w-full max-w-lg mb-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 mb-2">
          🦆 Duck Snake
        </h1>

        {/* Score Board */}
        <div className="flex justify-between items-center bg-green-900/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-green-700/40">
          <div className="text-center">
            <div className="text-xs text-green-400/70 uppercase tracking-wider">Punteggio</div>
            <div className="text-2xl font-bold text-yellow-300">{score}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-green-400/70 uppercase tracking-wider">Record</div>
            <div className="text-2xl font-bold text-amber-400">🏆 {highScore}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-green-400/70 uppercase tracking-wider">Difficoltà</div>
            <div className="text-lg font-bold text-orange-300">{DIFFICULTY_LABELS[difficulty]}</div>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative rounded-xl overflow-hidden shadow-2xl shadow-green-500/10 border-2 border-green-700/40">
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
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-sm text-green-400/70 mr-2">Difficoltà:</span>
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
                    ? 'bg-green-500/20 text-green-300 border border-green-500/50'
                    : d === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
                    : 'bg-red-500/20 text-red-300 border border-red-500/50'
                  : 'bg-green-900/50 text-green-400/60 border border-green-700/40 hover:border-green-500/50'
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
              className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              ▶ Inizia
            </button>
          ) : (
            <>
              <button
                onClick={togglePause}
                className="px-5 py-2.5 bg-green-800/60 text-green-200 font-medium rounded-xl border border-green-600/40 hover:bg-green-700/60 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {gameState === 'paused' ? '▶ Riprendi' : '⏸ Pausa'}
              </button>
              <button
                onClick={resetGame}
                className="px-5 py-2.5 bg-green-800/60 text-green-200 font-medium rounded-xl border border-green-600/40 hover:bg-green-700/60 transition-all duration-200 hover:scale-105 active:scale-95"
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
                className="aspect-square bg-green-800/60 rounded-xl flex items-center justify-center text-2xl text-green-200 active:bg-green-700 active:scale-95 transition-all border border-green-600/40"
              >
                ↑
              </button>
              <div></div>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('LEFT'); }}
                className="aspect-square bg-green-800/60 rounded-xl flex items-center justify-center text-2xl text-green-200 active:bg-green-700 active:scale-95 transition-all border border-green-600/40"
              >
                ←
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); togglePause(); }}
                className="aspect-square bg-green-800/40 rounded-xl flex items-center justify-center text-sm text-green-300 active:bg-green-700 active:scale-95 transition-all border border-green-600/40"
              >
                ⏸
              </button>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}
                className="aspect-square bg-green-800/60 rounded-xl flex items-center justify-center text-2xl text-green-200 active:bg-green-700 active:scale-95 transition-all border border-green-600/40"
              >
                →
              </button>
              <div></div>
              <button
                onTouchStart={(e) => { e.preventDefault(); changeDirection('DOWN'); }}
                className="aspect-square bg-green-800/60 rounded-xl flex items-center justify-center text-2xl text-green-200 active:bg-green-700 active:scale-95 transition-all border border-green-600/40"
              >
                ↓
              </button>
              <div></div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-center text-xs text-green-500/60 mt-3 space-y-0.5">
          <p>🎮 Frecce / WASD per muoversi • Spazio per pausa/riprendi</p>
          <p>📱 Swipe sullo schermo o usa i pulsanti direzionali</p>
          <p className="pt-1 text-green-400/50">Guida l'anatra 🦆 e raccogli i suoi pulcini 🐥 mangiando i dischetti!</p>
        </div>
      </div>
    </div>
  );
}
