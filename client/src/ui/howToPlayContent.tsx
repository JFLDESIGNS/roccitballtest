/** Main-menu copy for controls and match basics */
export function HowToPlayContent() {
  return (
    <div className="how-to-play-text">
      <section>
        <h3>Goal</h3>
        <p>
          Score in the opposing team&apos;s rings. You play on the blue side; red bots defend
          their goals on the left. Your blue teammate helps when practice bots are enabled.
        </p>
      </section>

      <section>
        <h3>Movement</h3>
        <ul>
          <li>
            <strong>W A S D</strong> — Move (camera-relative)
          </li>
          <li>
            <strong>Mouse</strong> — Look around (click the arena after menu or alt-tab)
          </li>
          <li>
            <strong>Space</strong> — Jump (triple jump in the air)
          </li>
          <li>
            <strong>Shift</strong> — Sprint (uses energy)
          </li>
          <li>
            <strong>W W</strong> — Quick dash forward (short cooldown)
          </li>
        </ul>
      </section>

      <section>
        <h3>Ball &amp; beam</h3>
        <ul>
          <li>
            <strong>Hold RMB</strong> — Magnetic beam: pull the ball, capture, and hold
          </li>
          <li>
            <strong>LMB (while holding ball)</strong> — Launch / shoot the ball toward your aim
          </li>
          <li>
            <strong>E</strong> — Throw the ball if you are carrying it
          </li>
          <li>
            <strong>F</strong> — Kickoff ball drop (when available)
          </li>
          <li>Fast shots are hard to re-grab until the ball slows down.</li>
        </ul>
      </section>

      <section>
        <h3>Rockets</h3>
        <ul>
          <li>
            <strong>LMB</strong> — Fire rockets (unlimited in practice)
          </li>
          <li>Explosions knock players and the ball; aim at glass for crowd reactions.</li>
          <li>Hit enemy bots or players to trigger return fire.</li>
        </ul>
      </section>

      <section>
        <h3>Scoring</h3>
        <ul>
          <li>Red rings on the left and blue rings on the right — score on the far side.</li>
          <li>Ring sizes award different points (small / medium / large).</li>
          <li>Match timer and score show at the top of the HUD.</li>
        </ul>
      </section>

      <section>
        <h3>Energy</h3>
        <p>
          Sprinting, beaming, and holding the ball drain energy. It regenerates when you ease
          off. Watch the crosshair ring around the center of the screen.
        </p>
      </section>

      <section>
        <h3>Menus &amp; misc</h3>
        <ul>
          <li>
            <strong>Tab</strong> — Scoreboard (hold)
          </li>
          <li>
            <strong>1</strong> — Tuning menu (opens <strong>Brightness</strong> — exposure,
            arena light)
          </li>
          <li>
            <strong>Esc</strong> — Leave match back to this menu
          </li>
        </ul>
      </section>
    </div>
  );
}
