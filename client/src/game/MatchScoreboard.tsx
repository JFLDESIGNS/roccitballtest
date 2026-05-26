type MatchScoreboardProps = {
  red: number;
  blue: number;
  timeLabel: string;
};

/** Top-center match score + timer (Rocket League–style trapezoid bar, Rocccit team colors). */
export function MatchScoreboard({ red, blue, timeLabel }: MatchScoreboardProps) {
  return (
    <div className="rl-scoreboard" aria-label="Match score and time">
      <div className="rl-scoreboard-seg rl-scoreboard-seg--blue">
        <span className="rl-scoreboard-digit">{blue}</span>
      </div>
      <div className="rl-scoreboard-seg rl-scoreboard-seg--timer">
        <span className="rl-scoreboard-time">{timeLabel}</span>
      </div>
      <div className="rl-scoreboard-seg rl-scoreboard-seg--red">
        <span className="rl-scoreboard-digit">{red}</span>
      </div>
    </div>
  );
}
