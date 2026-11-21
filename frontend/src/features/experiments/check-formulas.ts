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
const PLANE_RATE: CheckSymbol = { tex: String.raw`\omega_F`, key: "plane_rate", unit: "°/h" };
const EARTH_RATE: CheckSymbol = { tex: String.raw`\Omega`, key: "earth_rate", unit: "rad/s" };
const LATITUDE: CheckSymbol = { tex: String.raw`\varphi`, key: "latitude", unit: "°" };
const STELLAR_DAY: CheckSymbol = { tex: String.raw`T_\star`, key: "stellar_day", unit: "h" };
const TIME: CheckSymbol = { tex: "t", key: "t", unit: "s" };
const DROP: CheckSymbol = { tex: "s", key: "drop", unit: "m" };
const V_E: CheckSymbol = { tex: "v_E", key: "vE", unit: "m/s" };
const C_BAR: CheckSymbol = { tex: String.raw`\bar c`, key: "cbar", unit: "N·s/m" };
const TAU: CheckSymbol = { tex: String.raw`\tau`, key: "tau", unit: "s" };
const MASS: CheckSymbol = { tex: "m", key: "m", unit: "kg" };
const SIGMA: CheckSymbol = { tex: String.raw`\sigma`, key: "sigma", unit: "S/m" };
const SHARE: CheckSymbol = { tex: String.raw`\eta`, key: "sheet_share" };
const MASS_WHEEL: CheckSymbol = { tex: "M", key: "m", unit: "kg" };
const AXLE: CheckSymbol = { tex: "r", key: "r_axle", unit: "m" };
const WHEEL: CheckSymbol = { tex: "R", key: "R_wheel", unit: "m" };
const BANDS: CheckSymbol = { tex: "L", key: "L_band", unit: "m" };
const INERTIA: CheckSymbol = { tex: "I", key: "inertia", unit: "kg·m²" };
const STIFF: CheckSymbol = { tex: "s", key: "s_band", unit: "N/m" };
const V_BOTTOM: CheckSymbol = { tex: "v", key: "v_bottom", unit: "m/s" };
const THICKNESS: CheckSymbol = { tex: "t", key: "arch_thickness", unit: "m" };
const ARCH_RADIUS: CheckSymbol = { tex: "R", key: "arch_radius", unit: "m" };
const ROD_EI: CheckSymbol = { tex: "EI", key: "rod_EI", unit: "N·m²" };
const ROD_B: CheckSymbol = { tex: "B", key: "rod_B" };
const ROD_OMEGA: CheckSymbol = { tex: String.raw`\omega`, key: "rod_omega", unit: "1/s" };
const ROD_ZETA: CheckSymbol = { tex: String.raw`\zeta`, key: "rod_zeta" };
const R_WELL: CheckSymbol = { tex: "r", key: "r_well", unit: "m" };
const K_FUNNEL: CheckSymbol = { tex: "k", key: "k_funnel", unit: "m²" };
const LAMBDA: CheckSymbol = { tex: String.raw`\lambda`, key: "lambda", unit: "nm" };
const D_WALL: CheckSymbol = { tex: "D", key: "D_wall", unit: "m" };
const D_SLITS: CheckSymbol = { tex: "d", key: "d_slits", unit: "m" };
const A_SLIT: CheckSymbol = { tex: "a", key: "a_slit", unit: "m" };
const THETA_BEAM: CheckSymbol = { tex: String.raw`\theta`, key: "theta_beam", unit: "°" };
const ORDER: CheckSymbol = { tex: "m", key: "m_order" };
const D_RHO: CheckSymbol = { tex: String.raw`\rho`, key: "diver_rho", unit: "kg/m³" };
const D_VG: CheckSymbol = { tex: "V_g", key: "diver_Vg", unit: "m³" };
const D_V0: CheckSymbol = { tex: "V_0", key: "diver_V0", unit: "m³" };
const D_M: CheckSymbol = { tex: "m", key: "diver_m", unit: "kg" };
const D_P0: CheckSymbol = { tex: "p_0", key: "diver_p0", unit: "Pa" };
const D_DP: CheckSymbol = { tex: String.raw`\Delta p`, key: "diver_dp", unit: "Pa" };
const D_VSTAR: CheckSymbol = { tex: "V^*", key: "diver_Vstar", unit: "m³" };
const D_G: CheckSymbol = { tex: "g", key: "g", unit: "m/s²" };
const DELTA: CheckSymbol = { tex: String.raw`\delta`, key: "delta_cone", unit: "°" };
const ALPHA_CONE: CheckSymbol = { tex: String.raw`\alpha`, key: "alpha_cone", unit: "°" };
const BETA_RAIL: CheckSymbol = { tex: String.raw`\beta`, key: "beta_rail", unit: "°" };
const GAMMA_RAIL: CheckSymbol = { tex: String.raw`\gamma`, key: "gamma_rail", unit: "°" };
const DZ_AXIS: CheckSymbol = { tex: String.raw`\Delta z`, key: "dz_axis", unit: "m" };
const F_FORK: CheckSymbol = { tex: "f_0", key: "f_fork", unit: "Hz" };
const F_RIDER: CheckSymbol = { tex: "f", key: "f_rider", unit: "Hz" };
const M_FELT: CheckSymbol = { tex: "M^*", key: "m_felt", unit: "kg" };
const M_PRONG: CheckSymbol = { tex: "M", key: "m_prong", unit: "kg" };
const M_RIDER: CheckSymbol = { tex: "m", key: "m_rider", unit: "kg" };
const MODE: CheckSymbol = { tex: String.raw`\varphi`, key: "mode" };
const S_RIDER: CheckSymbol = { tex: "s", key: "s_rider" };
const XI: CheckSymbol = { tex: String.raw`\xi`, key: "xi" };
const FILL: CheckSymbol = { tex: "h", key: "fill_depth", unit: "m" };
const VESSEL_R: CheckSymbol = { tex: "R", key: "vessel_radius", unit: "m" };
const RATE: CheckSymbol = { tex: String.raw`\omega`, key: "vessel_rate", unit: "1/s" };
const ALPHA: CheckSymbol = { tex: String.raw`\alpha`, key: "steepness", unit: "1/m" };

const ROD_STEADY: CheckFormula = {
  tex: String.raw`w = \frac{\Gamma\,\Omega^2 Y}{\sqrt{(\omega^2 - \Omega^2)^2 + (2\zeta\omega\Omega)^2}}, \qquad \Gamma = \frac{\int_0^1 \varphi\,d\xi}{\int_0^1 \varphi^2\,d\xi}`,
  symbols: [
    { tex: "w", key: "rod_w", unit: "m" },
    { tex: String.raw`\Gamma`, key: "rod_Gamma" },
    { tex: String.raw`\Omega`, key: "rod_Omega", unit: "1/s" },
    { tex: "Y", key: "rod_Y", unit: "m" },
    ROD_OMEGA,
    ROD_ZETA,
    { tex: String.raw`\varphi`, key: "rod_phi" },
    { tex: String.raw`\xi`, key: "rod_xi" },
  ],
};

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
  foucault: {
    winterthur: {
      tex: String.raw`\omega_F = \Omega\,\sin\varphi = \frac{360^\circ\,\sin\varphi}{T_\star}`,
      symbols: [PLANE_RATE, EARTH_RATE, LATITUDE, STELLAR_DAY],
    },
    pole: {
      tex: String.raw`T_{360} = \frac{2\pi}{\Omega\,\sin 90^\circ} = T_\star`,
      symbols: [{ tex: String.raw`T_{360}`, key: "full_turn", unit: "h" }, EARTH_RATE, STELLAR_DAY],
    },
    south: {
      tex: String.raw`\omega_F = \frac{360^\circ\,\sin\varphi}{T_\star} < 0 \quad \text{for} \quad \varphi < 0`,
      symbols: [PLANE_RATE, LATITUDE, STELLAR_DAY],
    },
    period: {
      tex: String.raw`T = 2\pi\sqrt{\frac{L}{g}}`,
      symbols: [
        { tex: "T", key: "T", unit: "s" },
        { tex: "L", key: "foucault_length", unit: "m" },
        { tex: "g", key: "g", unit: "m/s²" },
      ],
    },
  },
  plates: {
    free_fall: {
      tex: String.raw`s = \tfrac12\,g\,t^2 \;\Rightarrow\; t = \sqrt{\frac{2s}{g}}`,
      symbols: [DROP, G, TIME],
    },
    late_start: {
      tex: String.raw`t = \frac{s}{v_E} + \tau, \qquad v_E = \frac{m\,g}{\bar c}, \qquad \tau = \frac{m}{\bar c}`,
      symbols: [TIME, DROP, V_E, TAU, MASS, G, C_BAR],
    },
    thickness: {
      tex: String.raw`v_E = \frac{m\,g}{\bar c} = \frac{\varrho\,d\,A\,g}{\sigma\,d\,A\,\frac{B_0^2}{2}\,\eta}, \qquad \tau = \frac{m}{\bar c}`,
      symbols: [
        V_E,
        MASS,
        G,
        C_BAR,
        { tex: String.raw`\varrho`, key: "density", unit: "kg/m³" },
        { tex: "d", key: "thickness", unit: "m" },
        { tex: "A", key: "area", unit: "m²" },
        SIGMA,
        { tex: "B_0", key: "B0", unit: "T" },
        SHARE,
        TAU,
      ],
    },
    metals: {
      tex: String.raw`\frac{v_{E,\mathrm{Al}}}{v_{E,\mathrm{Cu}}} = \frac{\rho_\mathrm{Al}\,\varrho_\mathrm{Al}}{\rho_\mathrm{Cu}\,\varrho_\mathrm{Cu}}, \qquad \rho = \frac{1}{\sigma}`,
      symbols: [
        V_E,
        { tex: String.raw`\rho`, key: "resistivity", unit: "nΩ·m" },
        { tex: String.raw`\varrho`, key: "density", unit: "g/cm³" },
        SIGMA,
      ],
    },
    strip: {
      tex: String.raw`\eta = 1 - \left(\frac{\sin(k h/2)}{k h/2}\right)^2, \qquad k = \frac{2\pi}{\lambda}`,
      symbols: [
        SHARE,
        { tex: "k", key: "field_k", unit: "1/m" },
        { tex: "h", key: "tooth", unit: "m" },
        { tex: String.raw`\lambda`, key: "field_period", unit: "m" },
      ],
    },
  },
  maxwell: {
    fall_time: {
      tex: String.raw`t = \frac{1}{r}\sqrt{\frac{L\,(2r^2 + R^2)}{g}}`,
      symbols: [{ tex: "t", key: "t", unit: "s" }, AXLE, BANDS, WHEEL, G],
    },
    pull: {
      tex: String.raw`T = \frac{I\,M g}{M r^2 + I}, \qquad I = \tfrac12 M R^2`,
      symbols: [{ tex: "T", key: "T_pull", unit: "N" }, INERTIA, MASS_WHEEL, G, AXLE, WHEEL],
    },
    back_up: {
      tex: String.raw`M g L = \tfrac12 M v^2 + \tfrac12 I \omega^2 \;\Rightarrow\; h_{\max} = L`,
      symbols: [
        MASS_WHEEL,
        G,
        BANDS,
        V_BOTTOM,
        INERTIA,
        { tex: String.raw`\omega`, key: "omega_spin", unit: "1/s" },
        { tex: String.raw`h_{\max}`, key: "h_top", unit: "m" },
      ],
    },
    jerk_time: {
      tex: String.raw`\Delta t = \frac{T}{2} = \pi\sqrt{\frac{M}{s}}`,
      symbols: [{ tex: String.raw`\Delta t`, key: "dt_jerk", unit: "s" }, MASS_WHEEL, STIFF],
    },
    peak: {
      tex: String.raw`F = M g + s A, \qquad \tfrac12 s A^2 = \tfrac12 M v^2, \qquad v = \sqrt{\frac{2 g L}{1 + I/(M r^2)}}`,
      symbols: [
        { tex: "F", key: "F_band", unit: "N" },
        MASS_WHEEL,
        G,
        STIFF,
        { tex: "A", key: "A_stretch", unit: "m" },
        V_BOTTOM,
        BANDS,
        INERTIA,
        AXLE,
      ],
    },
  },
  arch: {
    milankovitch: {
      tex: String.raw`\frac{t}{R} \ge 0.1075`,
      symbols: [THICKNESS, ARCH_RADIUS],
    },
    chain_push: {
      tex: String.raw`\frac{H}{W} = \frac{T_0}{2\,w\,a\sinh(c/a)} = \frac{1}{2\sinh(c/a)}, \qquad T_0 = w\,a, \qquad a\left(\cosh\frac{c}{a} - 1\right) = h`,
      symbols: [
        { tex: "H", key: "push", unit: "N" },
        { tex: "W", key: "arch_weight", unit: "N" },
        { tex: "T_0", key: "arch_T0", unit: "N" },
        { tex: "w", key: "w_length", unit: "N/m" },
        { tex: "a", key: "a_chain", unit: "m" },
        { tex: "c", key: "half_span", unit: "m" },
        { tex: "h", key: "rise", unit: "m" },
      ],
    },
    weight: {
      tex: String.raw`m = \rho\,d\,N\cdot\tfrac12\left(R_+^2 - R_-^2\right)\sin\frac{\pi}{N}, \qquad R_\pm = R \pm \frac{t}{2}`,
      symbols: [
        { tex: "m", key: "m", unit: "kg" },
        { tex: String.raw`\rho`, key: "arch_density", unit: "kg/m³" },
        { tex: "d", key: "arch_depth", unit: "m" },
        { tex: "N", key: "stones" },
        { tex: String.raw`R_\pm`, key: "R_pm", unit: "m" },
        ARCH_RADIUS,
        THICKNESS,
      ],
    },
  },
  resonance: {
    tone: {
      tex: String.raw`f = \frac{1}{2\pi}\,\frac{(\beta_1 L)^2}{L^2}\sqrt{\frac{EI}{\mu}}\,\sqrt{1 - \frac{q}{q_c}}, \qquad q = \frac{\mu g L^3}{EI}, \qquad q_c = \frac{9B^2}{4}`,
      symbols: [
        { tex: "f", key: "f", unit: "Hz" },
        { tex: String.raw`\beta_1 L`, key: "rod_beta" },
        { tex: "L", key: "rod_L", unit: "m" },
        ROD_EI,
        { tex: String.raw`\mu`, key: "rod_mu", unit: "kg/m" },
        { tex: "q", key: "rod_load" },
        { tex: "g", key: "g", unit: "m/s²" },
        { tex: "q_c", key: "rod_qc" },
        ROD_B,
      ],
    },
    buckling: {
      tex: String.raw`h_c = \left(\frac{9B^2}{4}\,\frac{EI}{\rho g A}\right)^{1/3}`,
      symbols: [
        { tex: "h_c", key: "rod_hc", unit: "m" },
        ROD_B,
        ROD_EI,
        { tex: String.raw`\rho`, key: "rod_rho", unit: "kg/m³" },
        { tex: "g", key: "g", unit: "m/s²" },
        { tex: "A", key: "rod_A", unit: "m²" },
      ],
    },
    in_step: ROD_STEADY,
    neighbour: ROD_STEADY,
    growth: {
      tex: String.raw`q = X\left[-\cos\omega t + e^{-\zeta\omega t}\left(\cos\omega_1 t + \frac{\zeta\omega}{\omega_1}\sin\omega_1 t\right)\right], \qquad \omega_1 = \omega\sqrt{1 - \zeta^2}, \qquad \sqrt{q^2 + (\dot q/\omega)^2} = \left(1 - e^{-1}\right) X`,
      symbols: [
        { tex: "q", key: "rod_tip", unit: "m" },
        { tex: "X", key: "rod_X", unit: "m" },
        ROD_OMEGA,
        { tex: "t", key: "t", unit: "s" },
        ROD_ZETA,
        { tex: String.raw`\omega_1`, key: "rod_omega1", unit: "1/s" },
      ],
    },
  },
  well: {
    kepler_period: {
      tex: String.raw`T^2 = \frac{4\pi^2}{GM}\,r^3, \qquad GM \;\to\; \tfrac57\,g\,k`,
      symbols: [{ tex: "T", key: "T_lap", unit: "s" }, { tex: "GM", key: "GM", unit: "m³/s²" }, R_WELL, G, K_FUNNEL],
    },
    equal_areas: {
      tex: String.raw`r^2\,\dot\varphi = r_0\,v_0`,
      symbols: [
        R_WELL,
        { tex: String.raw`\dot\varphi`, key: "phidot", unit: "1/s" },
        { tex: "r_0", key: "r0_well", unit: "m" },
        { tex: "v_0", key: "v0_push", unit: "m/s" },
      ],
    },
    energy: {
      tex: String.raw`E = \tfrac12\left(1 + \tfrac25\right)v^2 - \frac{g\,k}{r}`,
      symbols: [{ tex: "E", key: "E", unit: "J/kg" }, V, G, K_FUNNEL, R_WELL],
    },
    brake: {
      tex: String.raw`P = C\,N\,v, \qquad \frac{N}{m} = g\cos\alpha + \frac{v^2}{r}\sin\alpha, \qquad \tan\alpha = \frac{k}{r^2}`,
      symbols: [
        { tex: "P", key: "P_loss", unit: "W" },
        { tex: "C", key: "C_rr" },
        { tex: "N", key: "N", unit: "N" },
        V,
        { tex: "m", key: "m", unit: "kg" },
        G,
        { tex: String.raw`\alpha`, key: "alpha_wall", unit: "°" },
        R_WELL,
        K_FUNNEL,
      ],
    },
  },
  slits: {
    spacing: {
      tex: String.raw`\Delta y = \frac{\lambda D}{d}, \qquad d \sin\theta = \left(m + \tfrac12\right)\lambda`,
      symbols: [
        { tex: String.raw`\Delta y`, key: "dy_stripes", unit: "m" },
        LAMBDA,
        D_WALL,
        D_SLITS,
        THETA_BEAM,
        ORDER,
      ],
    },
    one_slit_dark: {
      tex: String.raw`a \sin\theta = \lambda, \qquad y = D \tan\theta`,
      symbols: [A_SLIT, THETA_BEAM, LAMBDA, { tex: "y", key: "y_wall", unit: "m" }, D_WALL],
    },
    quarter: {
      tex: String.raw`\frac{I_1}{I_2} = \frac{E^2}{(2E)^2} = \frac14`,
      symbols: [
        { tex: "I_1", key: "I_one" },
        { tex: "I_2", key: "I_two" },
        { tex: "E", key: "E_amp" },
      ],
    },
    first_bright: {
      tex: String.raw`\frac{I}{I_0} = \left(\frac{\sin\beta}{\beta}\right)^2, \qquad \beta = \frac{m \pi a}{d}, \quad m = 1`,
      symbols: [
        { tex: String.raw`I/I_0`, key: "I_rel" },
        { tex: String.raw`\beta`, key: "beta_slit", unit: "rad" },
        ORDER,
        A_SLIT,
        D_SLITS,
      ],
    },
    missing: {
      tex: String.raw`d \sin\theta = 5\lambda \quad\text{and}\quad a \sin\theta = \lambda \qquad (d = 5a)`,
      symbols: [D_SLITS, A_SLIT, THETA_BEAM, LAMBDA],
    },
  },
  diver: {
    reserve: {
      tex: String.raw`\Delta m = \rho\,(V_g + V_0) - m`,
      symbols: [{ tex: String.raw`\Delta m`, key: "diver_reserve", unit: "kg" }, D_RHO, D_VG, D_V0, D_M],
    },
    sinks_from_top: {
      tex: String.raw`p_0 V_0 = (p_0 + \Delta p)\,V^*, \qquad \rho\,(V_g + V^*) = m \;\Rightarrow\; \Delta p = \frac{p_0 V_0}{m/\rho - V_g} - p_0`,
      symbols: [D_P0, D_V0, D_DP, D_VSTAR, D_RHO, D_VG, D_M],
    },
    rises_from_bottom: {
      tex: String.raw`p_0 V_0 = (p_0 + \Delta p + \rho g H)\,V^* \;\Rightarrow\; \Delta p = \frac{p_0 V_0}{m/\rho - V_g} - p_0 - \rho g H`,
      symbols: [D_P0, D_V0, D_DP, D_RHO, D_G, { tex: "H", key: "diver_H", unit: "m" }, D_VSTAR, D_M, D_VG],
    },
    leaves_hover: {
      tex: String.raw`\delta z = \delta z_0 \cosh\!\left(\sqrt{k}\,t\right), \qquad k = \frac{\rho^2 g^2 V^*}{p^*\left(m + \tfrac12\rho\,(V_g + V^*)\right)}, \qquad p^* = p_0 + \Delta p + \rho g z^*`,
      symbols: [
        { tex: String.raw`\delta z`, key: "diver_dz", unit: "m" },
        { tex: "t", key: "t", unit: "s" },
        { tex: "k", key: "diver_k", unit: "1/s²" },
        D_RHO,
        D_G,
        D_VSTAR,
        { tex: "p^*", key: "diver_pstar", unit: "Pa" },
        D_M,
        D_VG,
        D_P0,
        D_DP,
        { tex: "z^*", key: "diver_zstar", unit: "m" },
      ],
    },
  },
  cone: {
    axis_path: {
      tex: String.raw`\sin\delta = \tan\beta\,\cos\gamma\,\tan\alpha, \qquad \Delta z = l\,\tan(\delta - \gamma)`,
      symbols: [DELTA, BETA_RAIL, GAMMA_RAIL, ALPHA_CONE, DZ_AXIS, { tex: "l", key: "l_rails", unit: "m" }],
    },
    threshold: {
      tex: String.raw`\sin(\delta - \gamma) = 0 \;\Rightarrow\; \tan\gamma^* = \tan\alpha\,\tan\beta`,
      symbols: [DELTA, GAMMA_RAIL, { tex: String.raw`\gamma^*`, key: "gamma_star", unit: "°" }, ALPHA_CONE, BETA_RAIL],
    },
    speed: {
      tex: String.raw`\tfrac12\left(1 + \frac{I}{M a^2}\right)v^2 = g\,\Delta z, \qquad I = \tfrac{3}{10}\,M R^2`,
      symbols: [
        { tex: "I", key: "inertia", unit: "kg·m²" },
        { tex: "M", key: "m", unit: "kg" },
        { tex: "a", key: "a_roll", unit: "m" },
        { tex: "v", key: "v", unit: "m/s" },
        G,
        DZ_AXIS,
        { tex: "R", key: "radius_cone", unit: "m" },
      ],
    },
  },
  beats: {
    beat_rate: {
      tex: String.raw`y(t) = 2A\cos(2\pi f_{\mathrm{avg}}\,t)\,\cos\!\left(2\pi\,\frac{|f_2 - f_1|}{2}\,t\right), \qquad f_{\mathrm{beat}} = |f_2 - f_1|`,
      symbols: [
        { tex: "y", key: "y_sum" },
        { tex: "A", key: "amp" },
        { tex: String.raw`f_{\mathrm{avg}}`, key: "f_avg", unit: "Hz" },
        { tex: "f_1, f_2", key: "f12", unit: "Hz" },
        { tex: "t", key: "t", unit: "s" },
        { tex: String.raw`f_{\mathrm{beat}}`, key: "f_beat", unit: "Hz" },
      ],
    },
    tip_rider: {
      tex: String.raw`f = f_0\sqrt{\frac{M^*}{M^* + m\,\varphi(s)^2}}, \qquad M^* = M\int_0^1 \varphi(\xi)^2\,d\xi = \tfrac14\,M, \qquad \varphi(1) = 1`,
      symbols: [F_RIDER, F_FORK, M_FELT, M_RIDER, MODE, S_RIDER, M_PRONG, XI],
    },
    rider_on_prong: {
      tex: String.raw`f = f_0\sqrt{\frac{M^*}{M^* + m\,\varphi(s)^2}}, \qquad \varphi(\xi) \propto (\cosh\beta\xi - \cos\beta\xi) + \frac{\cos\beta + \cosh\beta}{\sin\beta + \sinh\beta}\,(\sin\beta\xi - \sinh\beta\xi), \qquad \cosh\beta\cos\beta + 1 = 0`,
      symbols: [F_RIDER, F_FORK, M_FELT, M_RIDER, MODE, S_RIDER, XI, { tex: String.raw`\beta`, key: "beta_L" }],
    },
  },
  parabola: {
    centre: {
      tex: String.raw`z(r) = \alpha\,r^2 + d, \qquad \alpha = \frac{\omega^2}{2g}, \qquad d = h - \frac{\omega^2 R^2}{4g}`,
      symbols: [
        { tex: "z(r)", key: "surface_height", unit: "m" },
        { tex: "r", key: "axis_distance", unit: "m" },
        ALPHA,
        { tex: "d", key: "centre_depth", unit: "m" },
        RATE,
        G,
        FILL,
        VESSEL_R,
      ],
    },
    dry_rate: {
      tex: String.raw`\omega_1 = \frac{2}{R}\sqrt{h\,g}`,
      symbols: [{ tex: String.raw`\omega_1`, key: "dry_rate", unit: "1/s" }, VESSEL_R, FILL, G],
    },
    dry_rim: {
      tex: String.raw`z(R) = \alpha\,\left(R^2 - \delta^2\right), \qquad \delta = R\sqrt{1 - \frac{2\sqrt{h\,g}}{R\,\omega}}, \qquad \alpha = \frac{\omega^2}{2g}`,
      symbols: [
        { tex: "z(R)", key: "rim_height", unit: "m" },
        ALPHA,
        VESSEL_R,
        { tex: String.raw`\delta`, key: "dry_radius", unit: "m" },
        FILL,
        G,
        RATE,
      ],
    },
    mirror: {
      tex: String.raw`f = \frac{r^2}{4D} = \frac{1}{4\alpha} = \frac{g}{2\,\omega^2}, \qquad D = \alpha\,r^2`,
      symbols: [
        { tex: "f", key: "focus", unit: "m" },
        { tex: "r", key: "axis_distance", unit: "m" },
        { tex: "D", key: "dish_depth", unit: "m" },
        ALPHA,
        G,
        RATE,
      ],
    },
    spin_up: {
      tex: String.raw`\frac{\omega(t)}{\omega_v} = 1 - e^{-t/\tau}, \qquad \tau = \frac{h}{\sqrt{\nu\,\omega_v}}`,
      symbols: [
        { tex: String.raw`\omega(t)`, key: "water_rate", unit: "1/s" },
        { tex: String.raw`\omega_v`, key: "vessel_rate", unit: "1/s" },
        { tex: "t", key: "t", unit: "s" },
        { tex: String.raw`\tau`, key: "tau", unit: "s" },
        FILL,
        { tex: String.raw`\nu`, key: "nu", unit: "m²/s" },
      ],
    },
  },
};
