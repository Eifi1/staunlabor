/**
 * The formula of every check case, as the case's source states it (or as the
 * case's step derives it), with the legend of its symbols: no formula stands
 * alone. The symbols' words are `experiments.checks.symbols.<key>`.
 */

export interface CheckSymbol {
  tex: string;
  key: string;
  unit?: string;
}

export interface CheckFormula {
  tex: string;
  symbols: CheckSymbol[];
}

const F0: CheckSymbol = { tex: "f_0", key: "f0", unit: "Hz" };
const G: CheckSymbol = { tex: "g", key: "g", unit: "m/s²" };
const K_BALL: CheckSymbol = { tex: "k", key: "k" };
const RHO: CheckSymbol = { tex: String.raw`\rho`, key: "rho", unit: "m" };
const THETA: CheckSymbol = { tex: String.raw`\theta`, key: "theta", unit: "°" };
const THETA0: CheckSymbol = { tex: String.raw`\theta_0`, key: "theta0", unit: "°" };
const G_SHARE: CheckSymbol = { tex: "g'", key: "gprime", unit: "m/s²" };
const OMEGA: CheckSymbol = { tex: String.raw`\Omega`, key: "Omega", unit: "1/s" };
const R_COIL: CheckSymbol = { tex: "R", key: "R", unit: "Ω" };
const L_COIL: CheckSymbol = { tex: "L", key: "L", unit: "H" };
const PSI: CheckSymbol = { tex: String.raw`\Psi`, key: "Psi", unit: "Wb" };
const D12: CheckSymbol = { tex: "d_1, d_2", key: "d12", unit: "m" };
const PHI: CheckSymbol = { tex: String.raw`\varphi`, key: "phi", unit: "°" };
const V_IN: CheckSymbol = { tex: "v", key: "v_in", unit: "m/s" };
const L_STRING: CheckSymbol = { tex: "L", key: "L_string", unit: "m" };
const K_HERTZ: CheckSymbol = { tex: "K", key: "K_hertz", unit: "N/m¹·⁵" };
const MU_RED: CheckSymbol = { tex: String.raw`\mu`, key: "mu_red", unit: "kg" };
const WHEEL_K: CheckSymbol = { tex: "K", key: "wheel_leak", unit: "1/s" };
const WHEEL_SIGMA: CheckSymbol = { tex: String.raw`\sigma`, key: "wheel_sigma" };
const WHEEL_RHO: CheckSymbol = { tex: String.raw`\rho`, key: "wheel_rho" };
const WHEEL_B: CheckSymbol = { tex: "b", key: "wheel_b" };
const L_PENDULUM: CheckSymbol = { tex: "L", key: "length", unit: "m" };
const CYCLE: CheckSymbol = { tex: String.raw`\Gamma`, key: "cycle", unit: "s" };
const SWINGS: CheckSymbol = { tex: "N", key: "swings" };
const INDEX: CheckSymbol = { tex: "n", key: "index" };
const K_INTEGRAL: CheckSymbol = { tex: "K", key: "K" };
const MISS: CheckSymbol = { tex: String.raw`\Delta`, key: "miss", unit: "°" };
const SPIN: CheckSymbol = { tex: String.raw`\Omega`, key: "platform_rate", unit: "rad/s" };
const THROW: CheckSymbol = { tex: "u", key: "throw", unit: "m/s" };
const BETA: CheckSymbol = { tex: String.raw`\beta`, key: "beta", unit: "1/m" };
const AIR_MASS: CheckSymbol = { tex: "m", key: "air_mass" };
const ZENITH: CheckSymbol = { tex: "z", key: "z_zenith", unit: "°" };
const HEIGHT: CheckSymbol = { tex: "h", key: "h_sun", unit: "°" };
const PLATE_LAMBDA: CheckSymbol = { tex: String.raw`\lambda`, key: "plate_lambda" };
const L_PEG: CheckSymbol = { tex: "L", key: "length", unit: "m" };
const R_SMALL: CheckSymbol = { tex: "r", key: "r_small", unit: "m" };
const H_START: CheckSymbol = { tex: "h", key: "h_start", unit: "m" };
const Z_BOB: CheckSymbol = { tex: "z", key: "h", unit: "m" };
const PHI_PEG: CheckSymbol = { tex: String.raw`\varphi`, key: "phi_peg", unit: "°" };
const V: CheckSymbol = { tex: "v", key: "v", unit: "m/s" };

export const CHECK_FORMULAS: Record<string, Record<string, CheckFormula>> = {
  sphere: {
    small_swing: {
      tex: String.raw`f_0 = \frac{1}{2\pi}\sqrt{\frac{g}{(1+k)\,\rho}}, \qquad k = \tfrac{2}{5}`,
      symbols: [F0, G, K_BALL, RHO],
    },
    hollow_ball: {
      tex: String.raw`f_0 = \frac{1}{2\pi}\sqrt{\frac{g}{(1+k)\,\rho}}, \qquad k = \tfrac{2}{3}`,
      symbols: [F0, G, K_BALL, RHO],
    },
    wide_swing: {
      tex: String.raw`f = f_0\,\frac{\pi}{2K\!\left(\sin\frac{\theta_0}{2}\right)}, \qquad K(k) = \int_0^{\pi/2} \frac{d\varphi}{\sqrt{1 - k^2 \sin^2\varphi}}`,
      symbols: [{ tex: "f", key: "f", unit: "Hz" }, F0, THETA0, { tex: "K", key: "K" }],
    },
    circle_any_size: {
      tex: String.raw`\rho\cos\theta = \frac{g'}{\Omega^2}, \qquad g' = \frac{g}{1+k}`,
      symbols: [RHO, THETA, G_SHARE, OMEGA, G, K_BALL],
    },
    wobble: {
      tex: String.raw`\omega = \Omega\sqrt{1 + 3\cos^2\theta}, \qquad \Omega^2 = \frac{g'}{\rho\cos\theta}`,
      symbols: [{ tex: String.raw`\omega`, key: "omega", unit: "1/s" }, OMEGA, THETA, G_SHARE, RHO],
    },
    energy: {
      tex: String.raw`E = \tfrac12\,(1+k)\,v^2 + g\,h`,
      symbols: [
        { tex: "E", key: "E", unit: "J/kg" },
        K_BALL,
        { tex: "v", key: "v", unit: "m/s" },
        G,
        { tex: "h", key: "h", unit: "m" },
      ],
    },
    grip: {
      tex: String.raw`\mu \ge \frac{\tan\theta}{1 + m r^2 / I} = \tfrac{2}{7}\tan\theta`,
      symbols: [
        { tex: String.raw`\mu`, key: "mu" },
        THETA,
        { tex: "m", key: "m", unit: "kg" },
        { tex: "r", key: "r", unit: "m" },
        { tex: "I", key: "inertia", unit: "kg·m²" },
      ],
    },
    leaves_wall: {
      tex: String.raw`\frac{N}{m} = g\cos\theta + 2g'(\cos\theta - \cos\theta_0) = 0 \;\Rightarrow\; \cos\theta = \frac{2\cos\theta_0}{3+k}`,
      symbols: [
        { tex: "N", key: "N", unit: "N" },
        { tex: "m", key: "m", unit: "kg" },
        G,
        THETA,
        G_SHARE,
        THETA0,
        K_BALL,
      ],
    },
  },
  coil: {
    rl_rise: {
      tex: String.raw`I(t) = \frac{U}{R}\left(1 - e^{-t/\tau}\right), \qquad \tau = \frac{L}{R}`,
      symbols: [
        { tex: "I", key: "current", unit: "A" },
        { tex: "U", key: "U", unit: "V" },
        R_COIL,
        { tex: "t", key: "t", unit: "s" },
        { tex: String.raw`\tau`, key: "tau", unit: "s" },
        L_COIL,
      ],
    },
    wheeler: {
      tex: String.raw`L = \frac{a^2 n^2}{9a + 10b}\ \mu\mathrm{H}`,
      symbols: [
        { tex: "L", key: "L", unit: "µH" },
        { tex: "a", key: "a_in", unit: "in" },
        { tex: "b", key: "b_in", unit: "in" },
        { tex: "n", key: "n" },
      ],
    },
    flux_centre: {
      tex: String.raw`\Psi = \sum_{j=1}^{n} \frac{\mu_0\, m\, a^2}{2\,(a^2 + z_j^2)^{3/2}}, \qquad m = \frac{B_r V}{\mu_0}`,
      symbols: [
        PSI,
        { tex: "n", key: "n" },
        { tex: String.raw`\mu_0`, key: "mu0", unit: "H/m" },
        { tex: "m", key: "dipole", unit: "A·m²" },
        { tex: "a", key: "a", unit: "m" },
        { tex: "z_j", key: "z", unit: "m" },
        { tex: "B_r", key: "Br", unit: "T" },
        { tex: "V", key: "V", unit: "m³" },
      ],
    },
    charge: {
      tex: String.raw`Q = \frac{\Delta\Psi}{R}`,
      symbols: [{ tex: "Q", key: "Q", unit: "C" }, PSI, R_COIL],
    },
    period: {
      tex: String.raw`T = 4\sqrt{\frac{R}{g}}\,K\!\left(\sin\frac{\theta_0}{2}\right) + \frac{2\,l}{v_0}, \qquad v_0 = \sqrt{2gR\,(1 - \cos\theta_0)}`,
      symbols: [
        { tex: "T", key: "T", unit: "s" },
        { tex: "R", key: "R_arc", unit: "m" },
        G,
        { tex: "K", key: "K" },
        THETA0,
        { tex: "l", key: "l", unit: "m" },
        { tex: "v_0", key: "v0", unit: "m/s" },
      ],
    },
    brake: {
      tex: String.raw`\Delta E = \frac{1}{R}\int k(x)^2\,v(x)\,dx, \qquad v(x) = \sqrt{2g\,\bigl(h_0 - h(x)\bigr)}, \qquad k = \frac{d\Psi}{dx}`,
      symbols: [
        { tex: String.raw`\Delta E`, key: "dE", unit: "J" },
        R_COIL,
        { tex: "k", key: "coupling", unit: "V·s/m" },
        { tex: "v", key: "v", unit: "m/s" },
        { tex: "x", key: "x", unit: "m" },
        G,
        { tex: "h_0", key: "h0", unit: "m" },
        { tex: "h(x)", key: "hx", unit: "m" },
        PSI,
      ],
    },
    energy_account: {
      tex: String.raw`\int U\,i\,dt = \int R\,i^2\,dt + W + \Delta E_{\mathrm{mech}} + \Delta\!\left(\tfrac12 L\, i^2\right)`,
      symbols: [
        { tex: "U", key: "U", unit: "V" },
        { tex: "i", key: "current", unit: "A" },
        R_COIL,
        { tex: "W", key: "W", unit: "J" },
        { tex: String.raw`E_{\mathrm{mech}}`, key: "Emech", unit: "J" },
        L_COIL,
      ],
    },
  },
  chair: {
    one_picture: {
      tex: String.raw`(x,\ y) = \left(\frac{f X}{Z},\ \frac{f Y}{Z}\right)`,
      symbols: [
        { tex: "x, y", key: "xy", unit: "m" },
        { tex: "X, Y, Z", key: "XYZ", unit: "m" },
        { tex: "f", key: "focal", unit: "m" },
      ],
    },
    straight_rods: {
      tex: String.raw`P' = E + \frac{P - E}{1 + w\cdot(P - E)}`,
      symbols: [
        { tex: "P", key: "P", unit: "m" },
        { tex: "E", key: "eye", unit: "m" },
        { tex: "w", key: "w", unit: "1/m" },
      ],
    },
    parallax: {
      tex: String.raw`\delta = \frac{\alpha}{\sin\varphi\,\left|\frac{1}{d_1} - \frac{1}{d_2}\right|}, \qquad \alpha = 1'`,
      symbols: [
        { tex: String.raw`\delta`, key: "delta", unit: "m" },
        { tex: String.raw`\alpha`, key: "alpha", unit: "rad" },
        PHI,
        D12,
      ],
    },
    second_eye: {
      tex: String.raw`\eta \approx b\,\sin\varphi\,\left|\frac{1}{d_1} - \frac{1}{d_2}\right|`,
      symbols: [{ tex: String.raw`\eta`, key: "eta", unit: "rad" }, { tex: "b", key: "b", unit: "m" }, PHI, D12],
    },
  },
  cradle: {
    one_out: {
      tex: String.raw`v_5' = v = \sqrt{2gL\,(1 - \cos\theta_0)}`,
      symbols: [{ tex: "v_5'", key: "v_last", unit: "m/s" }, V_IN, G, L_STRING, THETA0],
    },
    momentum: {
      tex: String.raw`\sum_{i=1}^{5} v_i' = v = \sqrt{2gL\,(1 - \cos\theta_0)}`,
      symbols: [{ tex: "v_i'", key: "v_after", unit: "m/s" }, V_IN, G, L_STRING, THETA0],
    },
    energy: {
      tex: String.raw`E = \sum_{i=1}^{5} \left(\tfrac12\,v_i^2 + gL\,(1 - \cos\theta_i)\right) = gL\,(1 - \cos\theta_0)`,
      symbols: [
        { tex: "E", key: "E", unit: "J/kg" },
        { tex: "v_i", key: "v_i", unit: "m/s" },
        G,
        L_STRING,
        { tex: String.raw`\theta_i`, key: "theta_i", unit: "°" },
        THETA0,
      ],
    },
    peak: {
      tex: String.raw`F_{\max} = K\,h_M^{3/2}, \qquad h_M = \left(\frac{5\mu}{4K}\right)^{2/5} v^{4/5}, \qquad K = \tfrac43\,E^*\sqrt{R}`,
      symbols: [
        { tex: String.raw`F_{\max}`, key: "F_peak", unit: "N" },
        K_HERTZ,
        { tex: "h_M", key: "hM", unit: "m" },
        MU_RED,
        V_IN,
        { tex: "E^*", key: "E_star", unit: "Pa" },
        { tex: "R", key: "R_eff", unit: "m" },
      ],
    },
    duration: {
      tex: String.raw`T = 3\left(\frac{\tau}{2} + \frac{s}{v}\right) + \tau, \qquad \tau = 2\left(\frac{25\,\mu^2}{16\,K^2 v}\right)^{1/5} \int_0^1 \frac{dx}{\sqrt{1 - x^{5/2}}}`,
      symbols: [
        { tex: "T", key: "T_impact", unit: "s" },
        { tex: String.raw`\tau`, key: "tau_contact", unit: "s" },
        { tex: "s", key: "gap", unit: "m" },
        V_IN,
        MU_RED,
        K_HERTZ,
      ],
    },
  },
  waterwheel: {
    start: {
      tex: String.raw`\lambda = \frac{K}{2}\left(-1 - \sigma + \sqrt{(1 - \sigma)^2 + 4\rho\sigma}\right)`,
      symbols: [{ tex: String.raw`\lambda`, key: "wheel_growth", unit: "1/s" }, WHEEL_K, WHEEL_SIGMA, WHEEL_RHO],
    },
    steady: {
      tex: String.raw`n = \frac{60}{2\pi}\,K\sqrt{b\,(\rho - 1)}, \qquad b = 1`,
      symbols: [{ tex: "n", key: "wheel_rpm", unit: "1/min" }, WHEEL_K, WHEEL_B, WHEEL_RHO],
    },
    threshold: {
      tex: String.raw`\rho_H = \frac{\sigma\,(\sigma + b + 3)}{\sigma - b - 1}, \qquad b = 1`,
      symbols: [{ tex: String.raw`\rho_H`, key: "wheel_rhoH" }, WHEEL_SIGMA, WHEEL_B],
    },
    volume: {
      tex: String.raw`\frac{V(t)}{V(0)} = e^{-(\sigma + 1 + b)\,K t}, \qquad b = 1`,
      symbols: [{ tex: "V", key: "wheel_volume" }, { tex: "t", key: "t", unit: "s" }, WHEEL_SIGMA, WHEEL_B, WHEEL_K],
    },
    wheel: {
      tex: String.raw`\dot A = \Omega B - K A, \quad \dot B = -\Omega A + q - K B, \quad I\,\dot\Omega = -\nu\,\Omega + \pi g r A`,
      symbols: [
        { tex: "A, B", key: "wheel_ab", unit: "kg/rad" },
        { tex: String.raw`\Omega`, key: "wheel_rate", unit: "1/s" },
        WHEEL_K,
        { tex: "q", key: "wheel_inflow", unit: "kg/(rad·s)" },
        { tex: "I", key: "inertia", unit: "kg·m²" },
        { tex: String.raw`\nu`, key: "wheel_nu", unit: "N·m·s" },
        G,
        { tex: "r", key: "wheel_radius", unit: "m" },
      ],
    },
  },
  wave: {
    textbook_lengths: {
      tex: String.raw`L = g\left(\frac{\Gamma}{2\pi\,(N + n)}\right)^2`,
      symbols: [L_PENDULUM, G, CYCLE, SWINGS, INDEX],
    },
    tuned_lengths: {
      tex: String.raw`L = g\left(\frac{T_0}{2\pi}\right)^2, \qquad T_0 = \frac{\Gamma}{N + n}\cdot\frac{\pi}{2K\!\left(\sin\frac{\theta_0}{2}\right)}, \qquad K(k) = \int_0^{\pi/2} \frac{d\varphi}{\sqrt{1 - k^2 \sin^2\varphi}}`,
      symbols: [L_PENDULUM, G, { tex: "T_0", key: "T0", unit: "s" }, CYCLE, SWINGS, INDEX, K_INTEGRAL, THETA0],
    },
    together: {
      tex: String.raw`\theta_n(\Gamma) = \theta_0, \qquad \Gamma = (N + n)\cdot 4K\!\left(\sin\frac{\theta_0}{2}\right)\sqrt{\frac{L}{g}}`,
      symbols: [
        { tex: String.raw`\theta_n`, key: "theta_n", unit: "°" },
        CYCLE,
        THETA0,
        SWINGS,
        INDEX,
        K_INTEGRAL,
        L_PENDULUM,
        G,
      ],
    },
    third: {
      tex: String.raw`\sin\frac{\theta}{2} = \sin\frac{\theta_0}{2}\;\mathrm{sn}\!\left(\omega_0 t + K,\ \sin\frac{\theta_0}{2}\right), \qquad \omega_0 t = (N + n)\,\frac{4K}{3} \ \text{at}\ t = \frac{\Gamma}{3}`,
      symbols: [
        THETA,
        THETA0,
        { tex: String.raw`\mathrm{sn}`, key: "sn" },
        { tex: String.raw`\omega_0`, key: "omega0", unit: "1/s" },
        { tex: "t", key: "t", unit: "s" },
        K_INTEGRAL,
        SWINGS,
        INDEX,
        CYCLE,
      ],
    },
    textbook_skew: {
      tex: String.raw`\Delta = 360^\circ\cdot(c - 1)\left(1 - \frac{\pi}{2K\!\left(\sin\frac{\theta_0}{2}\right)}\right)`,
      symbols: [{ tex: String.raw`\Delta`, key: "skew", unit: "°" }, { tex: "c", key: "count" }, K_INTEGRAL, THETA0],
    },
  },
  coriolis: {
    at_rest: {
      tex: String.raw`\Delta = 2\,\alpha`,
      symbols: [MISS, { tex: String.raw`\alpha`, key: "aim", unit: "°" }],
    },
    straight_puck: {
      tex: String.raw`\Delta = -\left(2\delta + \Omega\,t\right), \qquad \tan\delta = \frac{\Omega R}{u}, \qquad t = \frac{2R\cos\delta}{\sqrt{u^2 + \Omega^2 R^2}}`,
      symbols: [
        MISS,
        { tex: String.raw`\delta`, key: "lean", unit: "°" },
        SPIN,
        { tex: "t", key: "flight", unit: "s" },
        { tex: "R", key: "platform_radius", unit: "m" },
        THROW,
      ],
    },
    coriolis_push: {
      tex: String.raw`\vec a' = 2\,\vec v' \times \vec\Omega + \left(\vec\Omega \times \vec r'\right) \times \vec\Omega, \qquad a'_\perp = 2\,\Omega\,u`,
      symbols: [
        { tex: String.raw`\vec a', \vec v', \vec r'`, key: "primed" },
        { tex: String.raw`\vec\Omega`, key: "platform_rate", unit: "rad/s" },
        { tex: String.raw`a'_\perp`, key: "a_across", unit: "m/s²" },
        THROW,
      ],
    },
    ball_turn: {
      tex: String.raw`\frac{d\vec v}{dt} = \frac{\Omega}{1 + m r^2 / I}\;\hat n \times \vec v, \qquad \omega_v = \frac{\Omega}{1 + m r^2 / I} = \tfrac{2}{7}\,\Omega`,
      symbols: [
        { tex: String.raw`\vec v`, key: "v", unit: "m/s" },
        { tex: "t", key: "t", unit: "s" },
        { tex: String.raw`\Omega`, key: "platform_rate", unit: "°/s" },
        { tex: "m", key: "m", unit: "kg" },
        { tex: "r", key: "r", unit: "m" },
        { tex: "I", key: "inertia", unit: "kg·m²" },
        { tex: String.raw`\hat n`, key: "n_up" },
        { tex: String.raw`\omega_v`, key: "heading_rate", unit: "°/s" },
      ],
    },
  },
  sky: {
    rayleigh: {
      tex: String.raw`\frac{\beta(450\,\mathrm{nm})}{\beta(650\,\mathrm{nm})} = \left(\frac{650}{450}\right)^4, \qquad \beta(\lambda) = \beta_{550}\left(\frac{550\,\mathrm{nm}}{\lambda}\right)^4`,
      symbols: [
        BETA,
        { tex: String.raw`\lambda`, key: "lambda", unit: "nm" },
        { tex: String.raw`\beta_{550}`, key: "beta550", unit: "1/m" },
      ],
    },
    light_kept: {
      tex: String.raw`\int_0^L \beta\,e^{-\beta x}\,dx + e^{-\beta L} = 1`,
      symbols: [BETA, { tex: "x", key: "x_tube", unit: "m" }, { tex: "L", key: "L_tube", unit: "m" }],
    },
    high_sun: {
      tex: String.raw`m = \sec z = \frac{1}{\sin h}, \qquad z = 90^\circ - h`,
      symbols: [AIR_MASS, ZENITH, HEIGHT],
    },
    sky_noon: {
      tex: String.raw`\frac{e^{-\tau} - e^{-m\tau}}{m - 1} \;\longrightarrow\; \tau\,e^{-\tau} \quad (m \to 1)`,
      symbols: [{ tex: String.raw`\tau`, key: "tau_air" }, AIR_MASS],
    },
    ozone_horizon: {
      tex: String.raw`m_3 = \frac{R + H}{\sqrt{R^2 \cos^2 z + 2RH + H^2}}, \qquad z = 90^\circ - h`,
      symbols: [
        { tex: "m_3", key: "m3" },
        { tex: "R", key: "R_earth", unit: "km" },
        { tex: "H", key: "H_ozone", unit: "km" },
        ZENITH,
        HEIGHT,
      ],
    },
  },
  chladni: {
    lowest_tone: {
      tex: String.raw`f = \frac{\lambda}{2\pi a^2}\sqrt{\frac{D}{\rho h}}, \qquad D = \frac{E h^3}{12\,(1 - \nu^2)}, \qquad \lambda = 24.2702`,
      symbols: [
        { tex: "f", key: "f", unit: "Hz" },
        PLATE_LAMBDA,
        { tex: "a", key: "plate_side", unit: "m" },
        { tex: "D", key: "plate_D", unit: "N·m" },
        { tex: String.raw`\rho`, key: "plate_rho", unit: "kg/m³" },
        { tex: "h", key: "plate_h", unit: "m" },
        { tex: "E", key: "plate_E", unit: "Pa" },
        { tex: String.raw`\nu`, key: "plate_nu" },
      ],
    },
    second_tone: {
      tex: String.raw`\frac{f_2}{f_1} = \frac{\lambda_2}{\lambda_1} = \frac{63.6870}{24.2702}`,
      symbols: [{ tex: "f_1, f_2", key: "plate_f12", unit: "Hz" }, PLATE_LAMBDA],
    },
    sharpness: {
      tex: String.raw`Q = \frac{f_1}{\Delta f} = \frac{1}{2\zeta}`,
      symbols: [
        { tex: "Q", key: "plate_Q" },
        { tex: "f_1", key: "plate_f1", unit: "Hz" },
        { tex: String.raw`\Delta f`, key: "plate_df", unit: "Hz" },
        { tex: String.raw`\zeta`, key: "plate_zeta" },
      ],
    },
    fourth_tone: {
      tex: String.raw`\frac{w_4(0)}{w_1(0)} = \frac{\varphi_4(0)^2 / (\mu_4\,\omega_4^2)}{\varphi_1(0)^2 / (\mu_1\,\omega_1^2)}, \qquad \mu_k = \iint \varphi_k^2\,d\xi\,d\eta`,
      symbols: [
        { tex: "w_k(0)", key: "plate_w0" },
        { tex: String.raw`\varphi_k(0)`, key: "plate_phi0" },
        { tex: String.raw`\mu_k`, key: "plate_mu" },
        { tex: String.raw`\omega_k`, key: "plate_omega", unit: "1/s" },
        { tex: String.raw`\xi, \eta`, key: "plate_xi" },
      ],
    },
  },
  peg: {
    same_height: {
      tex: String.raw`\tfrac12 v^2 = g\,L\,(\cos\theta - \cos\theta_0) \;\Rightarrow\; h = L\,(1 - \cos\theta_0)`,
      symbols: [V, G, L_PEG, THETA, THETA0, H_START],
    },
    period: {
      tex: String.raw`T = 2\sqrt{\frac{L}{g}}\,K\!\left(\sin\frac{\theta_0}{2}\right) + 2\sqrt{\frac{r}{g}}\,K\!\left(\sin\frac{\varphi_0}{2}\right), \qquad r\,(1 - \cos\varphi_0) = L\,(1 - \cos\theta_0)`,
      symbols: [
        { tex: "T", key: "T", unit: "s" },
        L_PEG,
        G,
        { tex: "K", key: "K" },
        THETA0,
        R_SMALL,
        { tex: String.raw`\varphi_0`, key: "phi0_peg", unit: "°" },
      ],
    },
    loop: {
      tex: String.raw`\frac{F}{m} = \frac{v^2}{r} + g\cos\varphi, \quad v^2 = 2g\,(h - z) \;\xrightarrow{\ \varphi = \pi,\ z = 2r\ }\; \frac{F}{m} = g\left(\frac{2h}{r} - 5\right) \ge 0, \qquad d = L - \tfrac25\,h`,
      symbols: [
        { tex: "F", key: "pull", unit: "N" },
        { tex: "m", key: "m", unit: "kg" },
        V,
        R_SMALL,
        G,
        PHI_PEG,
        H_START,
        Z_BOB,
        { tex: "d", key: "depth", unit: "m" },
        L_PEG,
      ],
    },
    slack: {
      tex: String.raw`\frac{v^2}{r} + g\cos\varphi = 0, \quad v^2 = 2g\,(h - z), \quad z = r\,(1 - \cos\varphi) \;\Rightarrow\; z = \frac{r + 2h}{3}`,
      symbols: [V, R_SMALL, G, PHI_PEG, H_START, Z_BOB],
    },
  },
};
