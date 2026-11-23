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
const LENGTH: CheckSymbol = { tex: "L", key: "length", unit: "m" };
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
const POL_I: CheckSymbol = { tex: "I", key: "pol_I", unit: "W/m²" };
const POL_I0: CheckSymbol = { tex: "I_0", key: "pol_I0", unit: "W/m²" };
const POL_I1: CheckSymbol = { tex: "I_1", key: "pol_I1", unit: "W/m²" };
const POL_I3: CheckSymbol = { tex: "I_3", key: "pol_I3", unit: "W/m²" };
const POL_IL: CheckSymbol = { tex: "I_L", key: "pol_IL", unit: "W/m²" };
const POL_THETA: CheckSymbol = { tex: String.raw`\theta`, key: "pol_theta", unit: "°" };
const POL_K1: CheckSymbol = { tex: "k_1", key: "pol_k1" };
const POL_K2: CheckSymbol = { tex: "k_2", key: "pol_k2" };
const THETA_BEAM: CheckSymbol = { tex: String.raw`\theta`, key: "theta_beam", unit: "°" };
const ORDER: CheckSymbol = { tex: "m", key: "m_order" };
const D_RHO: CheckSymbol = { tex: String.raw`\rho`, key: "diver_rho", unit: "kg/m³" };
const D_VG: CheckSymbol = { tex: "V_g", key: "diver_Vg", unit: "m³" };
const D_V0: CheckSymbol = { tex: "V_0", key: "diver_V0", unit: "m³" };
const D_M: CheckSymbol = { tex: "m", key: "diver_m", unit: "kg" };
const D_P0: CheckSymbol = { tex: "p_0", key: "diver_p0", unit: "Pa" };
const D_DP: CheckSymbol = { tex: String.raw`\Delta p`, key: "diver_dp", unit: "Pa" };
const D_VSTAR: CheckSymbol = { tex: "V^*", key: "diver_Vstar", unit: "m³" };
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
const MU_TOP: CheckSymbol = { tex: String.raw`\mu`, key: "mu_top", unit: "A·m²" };
const B_AXIS: CheckSymbol = { tex: "B", key: "B_axis", unit: "T" };
const B1: CheckSymbol = { tex: "B'", key: "B1", unit: "T/m" };
const B2: CheckSymbol = { tex: "B''", key: "B2", unit: "T/m²" };
const FREQ: CheckSymbol = { tex: "f", key: "f", unit: "Hz" };
const T_PERIOD: CheckSymbol = { tex: "T", key: "T", unit: "s" };
const LC_C: CheckSymbol = { tex: "C", key: "lc_C", unit: "F" };
const LC_R: CheckSymbol = { tex: "R", key: "lc_R", unit: "Ω" };
const LC_Q: CheckSymbol = { tex: "q", key: "lc_q", unit: "C" };
const LC_I: CheckSymbol = { tex: "i", key: "current", unit: "A" };
const LC_U0: CheckSymbol = { tex: "U_0", key: "U", unit: "V" };
const T_RACE: CheckSymbol = { tex: "T", key: "T_race", unit: "s" };
const T_BOTTOM: CheckSymbol = { tex: "T", key: "T_bottom", unit: "s" };
const D_RUN: CheckSymbol = { tex: "D", key: "D_run", unit: "m" };
const H_DROP: CheckSymbol = { tex: "H", key: "H_drop", unit: "m" };
const R_CYCLOID: CheckSymbol = { tex: "r", key: "r_cycloid", unit: "m" };
const OMEGA_SLOW: CheckSymbol = { tex: String.raw`\omega_1`, key: "omega_slow", unit: "1/s" };
const THETA12: CheckSymbol = { tex: String.raw`\theta_1, \theta_2`, key: "theta12", unit: "rad" };
const V_INF: CheckSymbol = { tex: String.raw`v_\infty`, key: "v_inf", unit: "m/s" };
const E_REST: CheckSymbol = { tex: "e", key: "e_rest" };
const U_UP: CheckSymbol = { tex: "u", key: "u_up", unit: "m/s" };
const Y_PEAK: CheckSymbol = { tex: String.raw`y_{\mathrm{peak}}`, key: "y_peak", unit: "m" };
const H_DROP_BOUNCE: CheckSymbol = { tex: "h", key: "h_drop", unit: "m" };
const SPIN_D: CheckSymbol = { tex: "d", key: "spin_d", unit: "m" };
const SPIN_MT: CheckSymbol = { tex: "m_t", key: "spin_mt", unit: "kg" };
const SPIN_MA: CheckSymbol = { tex: "m_a", key: "spin_ma", unit: "kg" };
const SPIN_OMEGA: CheckSymbol = { tex: String.raw`\omega`, key: "spin_omega", unit: "1/s" };
const KAPPA: CheckSymbol = { tex: String.raw`\kappa`, key: "kappa", unit: "1/s²" };
const K_SPRING: CheckSymbol = { tex: "k", key: "k_spring", unit: "N/m" };
const A_SPRING: CheckSymbol = { tex: "a", key: "a_spring", unit: "m" };
const A_EFF: CheckSymbol = { tex: String.raw`A_{\mathrm{eff}}`, key: "a_eff", unit: "m²" };
const A_HOLE: CheckSymbol = { tex: String.raw`A_{\mathrm{hole}}`, key: "a_hole", unit: "m²" };
const HOLE_D: CheckSymbol = { tex: "D", key: "hole_d", unit: "m" };
const RING: CheckSymbol = { tex: String.raw`2\varphi`, key: "ring_angle", unit: "°" };
const BETA_RAINBOW: CheckSymbol = { tex: String.raw`\beta`, key: "refraction_angle", unit: "°" };
const INCIDENCE: CheckSymbol = { tex: "i", key: "incidence_angle", unit: "°" };
const INDEX_RAINBOW: CheckSymbol = { tex: "n", key: "rainbow_index" };
const V_IMPACT: CheckSymbol = { tex: "v", key: "v_impact", unit: "m/s" };
const V_INF_CANNON: CheckSymbol = { tex: String.raw`v_\infty`, key: "cannon_v_inf", unit: "m/s" };
const K_FLOOR: CheckSymbol = { tex: "K", key: "K_floor", unit: "N/m¹·⁵" };
const TAU_CANNON: CheckSymbol = { tex: String.raw`\tau`, key: "tau_contact", unit: "s" };
const H_L: CheckSymbol = { tex: "L", key: "harm_L", unit: "m" };
const D_OVER: CheckSymbol = { tex: "d", key: "d_over", unit: "m" };
const N_BLOCKS: CheckSymbol = { tex: "n", key: "n_blocks" };
const L_BLOCK: CheckSymbol = { tex: String.raw`\ell`, key: "l_block", unit: "m" };
const RHO_AIR: CheckSymbol = { tex: String.raw`\rho`, key: "elephant_rho_air", unit: "kg/m³" };
const U0_JET: CheckSymbol = { tex: "U_0", key: "U0_jet", unit: "m/s" };
const OPENING: CheckSymbol = { tex: "D", key: "opening_d", unit: "m" };
const UC_JET: CheckSymbol = { tex: "u_c", key: "uc_jet", unit: "m/s" };
const B_JET: CheckSymbol = { tex: "b", key: "b_jet", unit: "m" };
const CD: CheckSymbol = { tex: "c_d", key: "cd" };
const A_BALL: CheckSymbol = { tex: "A", key: "A_ball", unit: "m²" };
const M_BALL: CheckSymbol = { tex: "m", key: "m_ball", unit: "kg" };
const V_BALL: CheckSymbol = { tex: "V", key: "V_ball", unit: "m³" };
const AXLE_GYROSCOPE: CheckSymbol = { tex: "d", key: "axle_length", unit: "m" };
const HOOP_R: CheckSymbol = { tex: "r", key: "hoop_radius", unit: "m" };
const L3: CheckSymbol = { tex: "L_3", key: "spin_momentum", unit: "kg·m²/s" };
const SPIN_GYROSCOPE: CheckSymbol = { tex: String.raw`\omega_3`, key: "spin_rate", unit: "1/s" };
const I1: CheckSymbol = { tex: "I_1", key: "i1_pivot", unit: "kg·m²" };
const ALPHA_GYROSCOPE: CheckSymbol = { tex: String.raw`\alpha`, key: "tilt_start", unit: "°" };

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

/** The Galton board's: a bin's share, the rows, the bin, the share to the right, the middle. */
const GALTON_SHARE: CheckSymbol = { tex: "P(k)", key: "galton_share" };
const GALTON_ROWS: CheckSymbol = { tex: "n", key: "galton_rows" };
const GALTON_BIN: CheckSymbol = { tex: "k", key: "galton_bin" };
const GALTON_P: CheckSymbol = { tex: "p", key: "galton_p" };
const GALTON_MEAN: CheckSymbol = { tex: String.raw`\mu`, key: "galton_mean" };

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
      symbols: [FREQ, F0, THETA0, K_INTEGRAL],
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
      symbols: [{ tex: "E", key: "E", unit: "J/kg" }, K_BALL, V, G, { tex: "h", key: "h", unit: "m" }],
    },
    grip: {
      tex: String.raw`\mu \ge \frac{\tan\theta}{1 + m r^2 / I} = \tfrac{2}{7}\tan\theta`,
      symbols: [{ tex: String.raw`\mu`, key: "mu" }, THETA, MASS, { tex: "r", key: "r", unit: "m" }, INERTIA],
    },
    leaves_wall: {
      tex: String.raw`\frac{N}{m} = g\cos\theta + 2g'(\cos\theta - \cos\theta_0) = 0 \;\Rightarrow\; \cos\theta = \frac{2\cos\theta_0}{3+k}`,
      symbols: [{ tex: "N", key: "N", unit: "N" }, MASS, G, THETA, G_SHARE, THETA0, K_BALL],
    },
  },
  coil: {
    rl_rise: {
      tex: String.raw`I(t) = \frac{U}{R}\left(1 - e^{-t/\tau}\right), \qquad \tau = \frac{L}{R}`,
      symbols: [{ tex: "I", key: "current", unit: "A" }, { tex: "U", key: "U", unit: "V" }, R_COIL, TIME, TAU, L_COIL],
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
        T_PERIOD,
        { tex: "R", key: "R_arc", unit: "m" },
        G,
        K_INTEGRAL,
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
        V,
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
        LC_I,
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
        TAU_CANNON,
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
      symbols: [{ tex: "V", key: "wheel_volume" }, TIME, WHEEL_SIGMA, WHEEL_B, WHEEL_K],
    },
    wheel: {
      tex: String.raw`\dot A = \Omega B - K A, \quad \dot B = -\Omega A + q - K B, \quad I\,\dot\Omega = -\nu\,\Omega + \pi g r A`,
      symbols: [
        { tex: "A, B", key: "wheel_ab", unit: "kg/rad" },
        { tex: String.raw`\Omega`, key: "wheel_rate", unit: "1/s" },
        WHEEL_K,
        { tex: "q", key: "wheel_inflow", unit: "kg/(rad·s)" },
        INERTIA,
        { tex: String.raw`\nu`, key: "wheel_nu", unit: "N·m·s" },
        G,
        { tex: "r", key: "wheel_radius", unit: "m" },
      ],
    },
  },
  wave: {
    textbook_lengths: {
      tex: String.raw`L = g\left(\frac{\Gamma}{2\pi\,(N + n)}\right)^2`,
      symbols: [LENGTH, G, CYCLE, SWINGS, INDEX],
    },
    tuned_lengths: {
      tex: String.raw`L = g\left(\frac{T_0}{2\pi}\right)^2, \qquad T_0 = \frac{\Gamma}{N + n}\cdot\frac{\pi}{2K\!\left(\sin\frac{\theta_0}{2}\right)}, \qquad K(k) = \int_0^{\pi/2} \frac{d\varphi}{\sqrt{1 - k^2 \sin^2\varphi}}`,
      symbols: [LENGTH, G, { tex: "T_0", key: "T0", unit: "s" }, CYCLE, SWINGS, INDEX, K_INTEGRAL, THETA0],
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
        LENGTH,
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
        TIME,
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
        TIME,
        { tex: String.raw`\Omega`, key: "platform_rate", unit: "°/s" },
        MASS,
        { tex: "r", key: "r", unit: "m" },
        INERTIA,
        { tex: String.raw`\hat n`, key: "n_up" },
        { tex: String.raw`\omega_v`, key: "heading_rate", unit: "°/s" },
      ],
    },
  },
  sky: {
    rayleigh: {
      tex: String.raw`\frac{\beta(450\,\mathrm{nm})}{\beta(650\,\mathrm{nm})} = \left(\frac{650}{450}\right)^4, \qquad \beta(\lambda) = \beta_{550}\left(\frac{550\,\mathrm{nm}}{\lambda}\right)^4`,
      symbols: [BETA, LAMBDA, { tex: String.raw`\beta_{550}`, key: "beta550", unit: "1/m" }],
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
        FREQ,
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
      symbols: [V, G, LENGTH, THETA, THETA0, H_START],
    },
    period: {
      tex: String.raw`T = 2\sqrt{\frac{L}{g}}\,K\!\left(\sin\frac{\theta_0}{2}\right) + 2\sqrt{\frac{r}{g}}\,K\!\left(\sin\frac{\varphi_0}{2}\right), \qquad r\,(1 - \cos\varphi_0) = L\,(1 - \cos\theta_0)`,
      symbols: [
        T_PERIOD,
        LENGTH,
        G,
        K_INTEGRAL,
        THETA0,
        R_SMALL,
        { tex: String.raw`\varphi_0`, key: "phi0_peg", unit: "°" },
      ],
    },
    loop: {
      tex: String.raw`\frac{F}{m} = \frac{v^2}{r} + g\cos\varphi, \quad v^2 = 2g\,(h - z) \;\xrightarrow{\ \varphi = \pi,\ z = 2r\ }\; \frac{F}{m} = g\left(\frac{2h}{r} - 5\right) \ge 0, \qquad d = L - \tfrac25\,h`,
      symbols: [
        { tex: "F", key: "pull", unit: "N" },
        MASS,
        V,
        R_SMALL,
        G,
        PHI_PEG,
        H_START,
        Z_BOB,
        { tex: "d", key: "depth", unit: "m" },
        LENGTH,
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
      symbols: [T_PERIOD, { tex: "L", key: "foucault_length", unit: "m" }, G],
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
      symbols: [TIME, AXLE, BANDS, WHEEL, G],
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
        MASS,
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
        FREQ,
        { tex: String.raw`\beta_1 L`, key: "rod_beta" },
        { tex: "L", key: "rod_L", unit: "m" },
        ROD_EI,
        { tex: String.raw`\mu`, key: "rod_mu", unit: "kg/m" },
        { tex: "q", key: "rod_load" },
        G,
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
        G,
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
        TIME,
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
        MASS,
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
  polarizer: {
    half: {
      tex: String.raw`\frac{I_1}{I_L} = \frac12`,
      symbols: [POL_I1, POL_IL],
    },
    malus: {
      tex: String.raw`I = I_0\,\cos^2\theta, \qquad \theta = 30^\circ`,
      symbols: [POL_I, POL_I0, POL_THETA],
    },
    crossed: {
      tex: String.raw`I = I_0\,\cos^2 90^\circ = 0`,
      symbols: [POL_I, POL_I0],
    },
    third: {
      tex: String.raw`I_3 = \tfrac12\cdot\tfrac12\cdot\tfrac12\,I_L = \tfrac18\,I_L`,
      symbols: [POL_I3, POL_IL],
    },
    slanted: {
      tex: String.raw`I_3 = \tfrac12\,I_L\,\cos^2 30^\circ\,\cos^2 60^\circ = \tfrac{3}{32}\,I_L`,
      symbols: [POL_I3, POL_IL],
    },
    many: {
      tex: String.raw`I = \tfrac12\,I_L\left(\cos^2\frac{90^\circ}{n+1}\right)^{n+1}, \qquad n = 10`,
      symbols: [POL_I, POL_IL, { tex: "n", key: "pol_n" }],
    },
    polaroid_one: {
      tex: String.raw`\frac{I_1}{I_L} = \tfrac12\,(k_1 + k_2) \approx 0.38, \qquad \frac{k_2}{k_1} = \frac{1}{500}`,
      symbols: [POL_I1, POL_IL, POL_K1, POL_K2],
    },
    polaroid_crossed: {
      tex: String.raw`\frac{I}{I_L} = \tfrac12\,(k_1 k_2 + k_2 k_1) = k_1^2\,\varepsilon, \qquad \varepsilon = \frac{k_2}{k_1} = \frac{1}{500}`,
      symbols: [POL_I, POL_IL, POL_K1, POL_K2, { tex: String.raw`\varepsilon`, key: "pol_eps" }],
    },
  },
  jet: {
    critical: {
      tex: String.raw`\theta_c = \arcsin\frac{n_2}{n_1}`,
      symbols: [
        { tex: String.raw`\theta_c`, key: "jet_critical", unit: "°" },
        { tex: "n_1", key: "jet_n1" },
        { tex: "n_2", key: "jet_n2" },
      ],
    },
    snell: {
      tex: String.raw`\frac{\sin\theta_1}{\sin\theta_2} = \frac{n_2}{n_1}`,
      symbols: [
        { tex: String.raw`\theta_1`, key: "jet_incidence", unit: "°" },
        { tex: String.raw`\theta_2`, key: "jet_refraction", unit: "°" },
        { tex: "n_1", key: "jet_n1" },
        { tex: "n_2", key: "jet_n2" },
      ],
    },
    fresnel: {
      tex: String.raw`T = 1 - \tfrac12\,(R_s + R_p), \qquad R_s = \left(\frac{n_1\cos\theta_1 - n_2\cos\theta_2}{n_1\cos\theta_1 + n_2\cos\theta_2}\right)^2, \qquad R_p = \left(\frac{n_1\cos\theta_2 - n_2\cos\theta_1}{n_1\cos\theta_2 + n_2\cos\theta_1}\right)^2`,
      symbols: [
        { tex: "T", key: "jet_let_out" },
        { tex: "R_s, R_p", key: "reflectance" },
        { tex: String.raw`\theta_1`, key: "jet_incidence", unit: "°" },
        { tex: String.raw`\theta_2`, key: "jet_refraction", unit: "°" },
        { tex: "n_1", key: "jet_n1" },
        { tex: "n_2", key: "jet_n2" },
      ],
    },
    landing: {
      tex: String.raw`x = v\,t, \qquad v = \sqrt{2 g h}, \qquad t = \sqrt{\frac{2H}{g}}`,
      symbols: [
        { tex: "x", key: "jet_landing", unit: "m" },
        { tex: "v", key: "jet_speed", unit: "m/s" },
        { tex: "t", key: "jet_fall", unit: "s" },
        G,
        { tex: "h", key: "jet_level", unit: "m" },
        { tex: "H", key: "jet_drop", unit: "m" },
      ],
    },
  },
  ship: {
    metacentric_height: {
      tex: String.raw`GM = KB + \frac{I_t}{\nabla} - KG, \qquad KB = \frac{d}{2}, \qquad I_t = \frac{L\,b^3}{12}, \qquad \nabla = L\,b\,d = \frac{m}{\rho}`,
      symbols: [
        { tex: "GM", key: "ship_GM", unit: "m" },
        { tex: "KB", key: "ship_KB", unit: "m" },
        { tex: "I_t", key: "ship_It", unit: "m⁴" },
        { tex: String.raw`\nabla`, key: "ship_volume", unit: "m³" },
        { tex: "KG", key: "ship_KG", unit: "m" },
        { tex: "d", key: "ship_d", unit: "m" },
        { tex: "L", key: "ship_L", unit: "m" },
        { tex: "b", key: "ship_b", unit: "m" },
        { tex: "m", key: "ship_m", unit: "kg" },
        { tex: String.raw`\rho`, key: "ship_rho", unit: "kg/m³" },
      ],
    },
    wall_sided: {
      tex: String.raw`GZ_\varphi = GN_\varphi\,\sin\varphi, \qquad GN_\varphi = KB + \frac{I_t}{\nabla}\left(1 + \tfrac12\tan^2\varphi\right) - KG`,
      symbols: [
        { tex: String.raw`GZ_\varphi`, key: "ship_GZ", unit: "m" },
        { tex: String.raw`GN_\varphi`, key: "ship_GN", unit: "m" },
        { tex: String.raw`\varphi`, key: "ship_phi", unit: "°" },
        { tex: "KB", key: "ship_KB", unit: "m" },
        { tex: "I_t", key: "ship_It", unit: "m⁴" },
        { tex: String.raw`\nabla`, key: "ship_volume", unit: "m³" },
        { tex: "KG", key: "ship_KG", unit: "m" },
      ],
    },
    on_its_side: {
      tex: String.raw`GZ(90^\circ) = KB_{90} - KG = \tfrac12\,H - KG`,
      symbols: [
        { tex: "GZ", key: "ship_GZ", unit: "m" },
        { tex: "KB_{90}", key: "ship_KB90", unit: "m" },
        { tex: "H", key: "ship_H", unit: "m" },
        { tex: "KG", key: "ship_KG", unit: "m" },
      ],
    },
    roll_period: {
      tex: String.raw`T = 2\pi\sqrt{\frac{a_{44}^2 + k^2}{g\,GM}}, \qquad a_{44} = 0, \qquad k^2 = \frac{I}{m}`,
      symbols: [
        T_PERIOD,
        { tex: "a_{44}", key: "ship_a44", unit: "m" },
        { tex: "k", key: "ship_k", unit: "m" },
        G,
        { tex: "GM", key: "ship_GM", unit: "m" },
        { tex: "I", key: "ship_I", unit: "kg·m²" },
        { tex: "m", key: "ship_m", unit: "kg" },
      ],
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
      symbols: [D_P0, D_V0, D_DP, D_RHO, G, { tex: "H", key: "diver_H", unit: "m" }, D_VSTAR, D_M, D_VG],
    },
    leaves_hover: {
      tex: String.raw`\delta z = \delta z_0 \cosh\!\left(\sqrt{k}\,t\right), \qquad k = \frac{\rho^2 g^2 V^*}{p^*\left(m + \tfrac12\rho\,(V_g + V^*)\right)}, \qquad p^* = p_0 + \Delta p + \rho g z^*`,
      symbols: [
        { tex: String.raw`\delta z`, key: "diver_dz", unit: "m" },
        TIME,
        { tex: "k", key: "diver_k", unit: "1/s²" },
        D_RHO,
        G,
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
        INERTIA,
        MASS_WHEEL,
        { tex: "a", key: "a_roll", unit: "m" },
        V,
        G,
        DZ_AXIS,
        { tex: "R", key: "radius_cone", unit: "m" },
      ],
    },
  },
  string: {
    fundamental: {
      tex: String.raw`f = \frac{v}{2L} = \frac{1}{2L}\sqrt{\frac{T}{\mu}}, \qquad v = \sqrt{\frac{T}{\mu}}`,
      symbols: [
        { tex: "f", key: "string_f", unit: "Hz" },
        { tex: "v", key: "string_v", unit: "m/s" },
        { tex: "L", key: "string_L", unit: "m" },
        { tex: "T", key: "string_T", unit: "N" },
        { tex: String.raw`\mu`, key: "string_mu", unit: "kg/m" },
      ],
    },
    third: {
      tex: String.raw`f_n = \frac{n}{2L}\sqrt{\frac{T}{\mu}}`,
      symbols: [
        { tex: "f_n", key: "string_fn", unit: "Hz" },
        { tex: "n", key: "string_n" },
        { tex: "L", key: "string_L", unit: "m" },
        { tex: "T", key: "string_T", unit: "N" },
        { tex: String.raw`\mu`, key: "string_mu", unit: "kg/m" },
      ],
    },
    pull: {
      tex: String.raw`T = \mu\left(\frac{2Lf}{n}\right)^2`,
      symbols: [
        { tex: "T", key: "string_T", unit: "N" },
        { tex: String.raw`\mu`, key: "string_mu", unit: "kg/m" },
        { tex: "L", key: "string_L", unit: "m" },
        { tex: "f", key: "string_drive", unit: "Hz" },
        { tex: "n", key: "string_n" },
      ],
    },
    loops: {
      tex: String.raw`N_{\text{nodes}} = n + 1, \qquad N_{\text{loops}} = n`,
      symbols: [
        { tex: String.raw`N_{\text{nodes}}`, key: "string_nodes" },
        { tex: String.raw`N_{\text{loops}}`, key: "string_loops" },
        { tex: "n", key: "string_n" },
      ],
    },
    speed: {
      tex: String.raw`v = \lambda f = 2\,d\,f, \qquad d = \frac{\lambda}{2}, \qquad v = \sqrt{\frac{T}{\mu}}`,
      symbols: [
        { tex: "v", key: "string_v", unit: "m/s" },
        { tex: String.raw`\lambda`, key: "string_lambda", unit: "m" },
        { tex: "f", key: "string_drive", unit: "Hz" },
        { tex: "d", key: "string_d", unit: "m" },
        { tex: "T", key: "string_T", unit: "N" },
        { tex: String.raw`\mu`, key: "string_mu", unit: "kg/m" },
      ],
    },
    settled: {
      tex: String.raw`Y(x) = A\,\frac{\sin\big(\kappa\,(L - x)\big)}{\sin(\kappa L)}, \qquad \kappa^2 = \left(\Omega^2 - i\gamma\Omega\right)\frac{\mu}{T}`,
      symbols: [
        { tex: "Y(x)", key: "string_Y", unit: "m" },
        { tex: "x", key: "string_x", unit: "m" },
        { tex: "A", key: "string_A", unit: "m" },
        { tex: String.raw`\kappa`, key: "string_kappa", unit: "1/m" },
        { tex: "L", key: "string_L", unit: "m" },
        { tex: String.raw`\Omega`, key: "string_Omega", unit: "1/s" },
        { tex: String.raw`\gamma`, key: "string_gamma", unit: "1/s" },
        { tex: String.raw`\mu`, key: "string_mu", unit: "kg/m" },
        { tex: "T", key: "string_T", unit: "N" },
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
        TIME,
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
        TIME,
        TAU,
        FILL,
        { tex: String.raw`\nu`, key: "nu", unit: "m²/s" },
      ],
    },
  },
  levitation: {
    lift: {
      tex: String.raw`m_{\mathrm{L}} = -\frac{\mu\,B'(z)}{g}, \qquad B(z) = \frac{\mu_0 M}{2}\int_0^t \left[\frac{R_2^2}{\left((z+s)^2 + R_2^2\right)^{3/2}} - \frac{R_1^2}{\left((z+s)^2 + R_1^2\right)^{3/2}}\right] ds`,
      symbols: [
        { tex: String.raw`m_{\mathrm{L}}`, key: "m_lift", unit: "kg" },
        MU_TOP,
        B1,
        G,
        B_AXIS,
        { tex: String.raw`\mu_0`, key: "mu0", unit: "H/m" },
        { tex: "M", key: "M_mag", unit: "A/m" },
        { tex: "t", key: "t_ring", unit: "m" },
        { tex: "z", key: "z_height", unit: "m" },
        { tex: "s", key: "s_depth", unit: "m" },
        { tex: "R_1", key: "R1_hole", unit: "m" },
        { tex: "R_2", key: "R2_ring", unit: "m" },
      ],
    },
    window_foot: {
      tex: String.raw`B''(z_i) = 0`,
      symbols: [B2, { tex: "z_i", key: "z_foot", unit: "m" }],
    },
    window_head: {
      tex: String.raw`B'(z_2)^2 = 2\,B(z_2)\,B''(z_2)`,
      symbols: [B_AXIS, B1, B2, { tex: "z_2", key: "z_head", unit: "m" }],
    },
    bob: {
      tex: String.raw`f = \frac{1}{2\pi}\sqrt{\frac{\mu\,B''}{m}}, \qquad m g = -\mu\,B'`,
      symbols: [FREQ, MU_TOP, B2, MASS, G, B1],
    },
    drift: {
      tex: String.raw`f = \frac{1}{2\pi}\sqrt{\frac{\mu\,(B'^2 - 2BB'')}{4Bm}}, \qquad |B|(r) \approx B + \frac{r^2\,(B'^2 - 2BB'')}{8B}`,
      symbols: [FREQ, MU_TOP, B_AXIS, B1, B2, MASS, { tex: "r", key: "r_axis", unit: "m" }],
    },
  },
  circuit: {
    period: {
      tex: String.raw`T = \frac{2\pi}{\omega'}, \qquad \omega' = \sqrt{\frac{1}{LC} - \left(\frac{R}{2L}\right)^2}`,
      symbols: [T_PERIOD, { tex: String.raw`\omega'`, key: "lc_omega", unit: "1/s" }, L_COIL, LC_C, LC_R],
    },
    energy_kept: {
      tex: String.raw`\frac{E(T)}{E(0)} = e^{-RT/L}, \qquad E = \frac{q^2}{2C} + \frac{L\,i^2}{2}`,
      symbols: [{ tex: "E", key: "lc_E", unit: "J" }, T_PERIOD, LC_R, L_COIL, LC_Q, LC_C, LC_I],
    },
    energy_account: {
      tex: String.raw`\frac{q^2}{2C} + \frac{L\,i^2}{2} + \int_0^t R\,i^2\,dt' = \frac{C\,U_0^2}{2}`,
      symbols: [LC_Q, LC_C, L_COIL, LC_I, LC_R, TIME, LC_U0],
    },
    edge: {
      tex: String.raw`R = 2\sqrt{\frac{L}{C}}: \qquad i = q_0\,\omega_0^2\,t\,e^{-\omega_0 t}, \qquad i_{\max} = \frac{q_0\,\omega_0}{e}\ \text{at}\ t = \frac{1}{\omega_0}, \qquad q_0 = C\,U_0`,
      symbols: [
        LC_R,
        L_COIL,
        LC_C,
        LC_I,
        { tex: "q_0", key: "lc_q0", unit: "C" },
        { tex: String.raw`\omega_0`, key: "lc_omega0", unit: "1/s" },
        TIME,
        LC_U0,
      ],
    },
  },
  vessel: {
    flow: {
      tex: String.raw`\dot V = \mu\,A_A\,v_A, \qquad v_A = \sqrt{2\,g\,H}`,
      symbols: [
        { tex: String.raw`\dot V`, key: "vessel_flow", unit: "l/min" },
        { tex: String.raw`\mu`, key: "vessel_mu" },
        { tex: "A_A", key: "vessel_hole", unit: "m²" },
        { tex: "v_A", key: "vessel_speed", unit: "m/s" },
        G,
        { tex: "H", key: "vessel_head", unit: "m" },
      ],
    },
    drain_time: {
      tex: String.raw`T = \frac{A}{\mu\,A_A}\,\sqrt{\frac{2H}{g}}`,
      symbols: [
        { tex: "T", key: "vessel_T", unit: "s" },
        { tex: "A", key: "vessel_area", unit: "m²" },
        { tex: String.raw`\mu`, key: "vessel_mu" },
        { tex: "A_A", key: "vessel_hole", unit: "m²" },
        { tex: "H", key: "vessel_head", unit: "m" },
        G,
      ],
    },
    half: {
      tex: String.raw`h(t) = H\left(1 - \frac{t}{T}\right)^2 = \frac{H}{2} \quad\Longleftrightarrow\quad t = \left(1 - \frac{1}{\sqrt{2}}\right) T`,
      symbols: [
        { tex: "h", key: "vessel_depth", unit: "m" },
        { tex: "H", key: "vessel_head", unit: "m" },
        TIME,
        { tex: "T", key: "vessel_T", unit: "s" },
      ],
    },
    farthest: {
      tex: String.raw`D = 2\sqrt{h\,(H - h)}, \qquad h^* = \frac{H}{2}, \qquad D_{\max} = H`,
      symbols: [
        { tex: "D", key: "vessel_D", unit: "m" },
        { tex: "h", key: "vessel_orifice", unit: "m" },
        { tex: "H", key: "vessel_surface", unit: "m" },
      ],
    },
  },
  race: {
    line: {
      tex: String.raw`T = \sqrt{\frac{2\,(D^2 + H^2)}{g'\,H}}, \qquad g' = \tfrac57\,g`,
      symbols: [T_RACE, D_RUN, H_DROP, G_SHARE, G],
    },
    cycloid: {
      tex: String.raw`T = \varphi_B\sqrt{\frac{r}{g'}}, \qquad \frac{\varphi_B - \sin\varphi_B}{1 - \cos\varphi_B} = \frac{D}{H}, \qquad r = \frac{H}{1 - \cos\varphi_B}`,
      symbols: [T_RACE, { tex: String.raw`\varphi_B`, key: "phi_B" }, R_CYCLOID, G_SHARE, D_RUN, H_DROP],
    },
    tautochrone: {
      tex: String.raw`T = \pi\sqrt{\frac{r}{g'}}`,
      symbols: [T_BOTTOM, R_CYCLOID, G_SHARE],
    },
    bowl: {
      tex: String.raw`T = \sqrt{\frac{R}{g'}}\;K\!\left(\sin\frac{\varphi_0}{2}\right), \qquad R = 4r, \qquad \cos\varphi_0 = 1 - \frac{h}{R}`,
      symbols: [
        T_BOTTOM,
        { tex: "R", key: "R_bowl", unit: "m" },
        G_SHARE,
        K_INTEGRAL,
        { tex: String.raw`\varphi_0`, key: "phi0_bowl", unit: "°" },
        R_CYCLOID,
        H_START,
      ],
    },
  },
  kapitza: {
    bound: {
      tex: String.raw`a\,\omega > \sqrt{2\,g\,l} \;\Rightarrow\; f = \frac{\omega}{2\pi} = \frac{\sqrt{2\,g\,l}}{2\pi\,a}`,
      symbols: [
        { tex: "a", key: "kap_a", unit: "m" },
        { tex: String.raw`\omega`, key: "kap_omega", unit: "1/s" },
        G,
        { tex: "l", key: "kap_l", unit: "m" },
        { tex: "f", key: "kap_f", unit: "Hz" },
      ],
    },
    mathieu: {
      tex: String.raw`w'' + (\lambda - 2q\cos 2z)\,w = 0, \quad \lambda = a_0(q) = -\tfrac12 q^2 + \tfrac{7}{128}q^4 - \tfrac{29}{2304}q^6 + \tfrac{68687}{18874368}q^8, \quad \lambda = -\frac{4g}{l\,\omega^2}, \quad q = \frac{2a}{l}`,
      symbols: [
        { tex: "w", key: "kap_w", unit: "rad" },
        { tex: String.raw`\lambda`, key: "kap_lambda" },
        { tex: "q", key: "kap_q" },
        { tex: "z", key: "kap_z", unit: "rad" },
        { tex: "a_0", key: "kap_a0" },
        G,
        { tex: "l", key: "kap_l", unit: "m" },
        { tex: String.raw`\omega`, key: "kap_omega", unit: "1/s" },
        { tex: "a", key: "kap_a", unit: "m" },
      ],
    },
    wobble: {
      tex: String.raw`T = \frac{2\pi}{\Omega}, \qquad \Omega^2 = \frac{a^2\omega^2}{2\,l^2} - \frac{g}{l}`,
      symbols: [
        { tex: "T", key: "kap_period", unit: "s" },
        { tex: String.raw`\Omega`, key: "kap_Omega", unit: "1/s" },
        { tex: "a", key: "kap_a", unit: "m" },
        { tex: String.raw`\omega`, key: "kap_omega", unit: "1/s" },
        { tex: "l", key: "kap_l", unit: "m" },
        G,
      ],
    },
    swing_up: {
      tex: String.raw`\Delta f = \frac{1}{2\pi}\left(\sqrt{\frac{4g}{l\,b_1(q)}} - \sqrt{\frac{4g}{l\,a_1(q)}}\right), \quad a_1, b_1 = 1 \pm q - \tfrac18 q^2 \mp \tfrac{1}{64}q^3 - \tfrac{1}{1536}q^4 \pm \dots, \quad q = \frac{2a}{l}`,
      symbols: [
        { tex: String.raw`\Delta f`, key: "kap_band", unit: "Hz" },
        G,
        { tex: "l", key: "kap_l", unit: "m" },
        { tex: "a_1, b_1", key: "kap_a1b1" },
        { tex: "q", key: "kap_q" },
        { tex: "a", key: "kap_a", unit: "m" },
      ],
    },
  },
  chaos: {
    slow_mode: {
      tex: String.raw`T = \frac{2\pi}{\omega_1}, \qquad \omega_1 = \omega_0\sqrt{2 - \sqrt{2}}, \qquad \omega_0^2 = \frac{g}{L}, \qquad \theta_2 : \theta_1 = \sqrt{2}`,
      symbols: [
        T_PERIOD,
        OMEGA_SLOW,
        { tex: String.raw`\omega_0`, key: "omega0_pend", unit: "1/s" },
        G,
        { tex: "L", key: "length_rod", unit: "m" },
        THETA12,
      ],
    },
    energy: {
      tex: String.raw`E = \tfrac12 m_1 v_1^2 + \tfrac12 m_2 v_2^2 + m_1 g\,y_1 + m_2 g\,y_2, \qquad y_1 = -L_1\cos\theta_1, \quad y_2 = y_1 - L_2\cos\theta_2`,
      symbols: [
        { tex: "E", key: "E_pend", unit: "J" },
        { tex: "m_1, m_2", key: "m12", unit: "kg" },
        { tex: "v_1, v_2", key: "v12", unit: "m/s" },
        G,
        { tex: "y_1, y_2", key: "y12", unit: "m" },
        { tex: "L_1, L_2", key: "L12", unit: "m" },
        THETA12,
      ],
    },
    damping: {
      tex: String.raw`\ddot\theta + c\,\dot\theta + \omega_1^2\,\theta = 0 \;\Rightarrow\; \theta(t) = \theta_0\,e^{-ct/2}\cos(\omega t), \qquad \alpha = \frac{c}{2}`,
      symbols: [
        { tex: String.raw`\theta`, key: "theta_mode", unit: "rad" },
        { tex: "c", key: "c_damp", unit: "1/s" },
        OMEGA_SLOW,
        { tex: String.raw`\theta_0`, key: "theta0", unit: "rad" },
        { tex: String.raw`\omega`, key: "omega_d", unit: "1/s" },
        { tex: String.raw`\alpha`, key: "alpha_decay", unit: "1/s" },
      ],
    },
  },
  bounce: {
    landing: {
      tex: String.raw`t = \frac{v_\infty}{g}\,\operatorname{arcosh}\!\left(e^{g h / v_\infty^2}\right), \qquad v_\infty = \sqrt{\frac{2 m g}{\rho\, C_D A}}`,
      symbols: [
        TIME,
        V_INF,
        G,
        H_DROP_BOUNCE,
        MASS,
        { tex: String.raw`\rho`, key: "rho_air", unit: "kg/m³" },
        { tex: "C_D", key: "c_drag" },
        { tex: "A", key: "A_cross", unit: "m²" },
      ],
    },
    apex: {
      tex: String.raw`y_{\mathrm{peak}} = \frac{v_\infty^2}{2g}\,\ln\!\left(1 + \frac{u^2}{v_\infty^2}\right), \qquad u = e\,v_\infty \tanh\frac{g\,t_1}{v_\infty}`,
      symbols: [Y_PEAK, V_INF, G, U_UP, E_REST, { tex: "t_1", key: "t_land", unit: "s" }],
    },
    flight: {
      tex: String.raw`T = t_f \arctan\frac{u}{v_\infty} + t_f \operatorname{arcosh}\!\left(e^{g\,y_{\mathrm{peak}}/v_\infty^2}\right), \qquad t_f = \frac{v_\infty}{g}`,
      symbols: [
        { tex: "T", key: "T_flight", unit: "s" },
        { tex: "t_f", key: "t_f", unit: "s" },
        U_UP,
        V_INF,
        Y_PEAK,
        G,
      ],
    },
    still: {
      tex: String.raw`T_{\mathrm{still}} = \sqrt{\frac{2h}{g}} \cdot \frac{1 + e}{1 - e}`,
      symbols: [{ tex: String.raw`T_{\mathrm{still}}`, key: "T_still", unit: "s" }, H_DROP_BOUNCE, G, E_REST],
    },
  },
  platform: {
    leaning_inertia: {
      tex: String.raw`I = \tfrac12 M R^2 + m_l k_l^2 + m_t\,(k_t^2 + d^2) + 2\,m_a\left(\tfrac{1}{12}\,d^2 + s^2 + \tfrac14\,d^2\right)`,
      symbols: [
        INERTIA,
        { tex: "M", key: "spin_M", unit: "kg" },
        { tex: "R", key: "spin_R", unit: "m" },
        { tex: "m_l", key: "spin_ml", unit: "kg" },
        { tex: "k_l", key: "spin_kl", unit: "m" },
        SPIN_MT,
        { tex: "k_t", key: "spin_kt", unit: "m" },
        SPIN_D,
        SPIN_MA,
        { tex: "s", key: "spin_s", unit: "m" },
      ],
    },
    faster_upright: {
      tex: String.raw`I_\text{up}\,\omega_\text{up} = I_\text{lean}\,\omega_\text{lean} \;\Rightarrow\; \frac{\omega_\text{up}}{\omega_\text{lean}} = \frac{I_\text{lean}}{I_\text{up}}`,
      symbols: [INERTIA, SPIN_OMEGA],
    },
    pull: {
      tex: String.raw`F = \omega^2\left(m_t\,d + 2\,m_a\,\frac{d}{2}\right), \qquad \omega = \pi\ \mathrm{s^{-1}}`,
      symbols: [{ tex: "F", key: "spin_F", unit: "N" }, SPIN_OMEGA, SPIN_MT, SPIN_D, SPIN_MA],
    },
    bearing_stops: {
      tex: String.raw`\frac{dL}{dt} = -\tau_f \;\Rightarrow\; t = \frac{L_0}{\tau_f}`,
      symbols: [
        { tex: "L, L_0", key: "spin_L", unit: "kg·m²/s" },
        TIME,
        { tex: String.raw`\tau_f`, key: "spin_tau", unit: "N·m" },
      ],
    },
  },
  coupled: {
    together: {
      tex: String.raw`T = 4\sqrt{\frac{L}{g}}\;K\!\left(\sin\frac{\theta_0}{2}\right)`,
      symbols: [T_PERIOD, LENGTH, G, K_INTEGRAL, THETA0],
    },
    against: {
      tex: String.raw`T = 4\int_0^{\theta_0}\frac{d\theta}{\sqrt{2\,\bigl(V(\theta_0) - V(\theta)\bigr)}}, \qquad V(\theta) = -\frac{g}{L}\cos\theta + \kappa\sin^2\theta, \qquad \kappa = \frac{k\,a^2}{m\,L^2}`,
      symbols: [
        T_PERIOD,
        THETA0,
        THETA,
        { tex: "V", key: "V_pot", unit: "1/s²" },
        G,
        LENGTH,
        KAPPA,
        K_SPRING,
        A_SPRING,
        MASS,
      ],
    },
    beat: {
      tex: String.raw`T_{\text{beat}} = \frac{2\pi}{\omega_+ - \omega_-}, \qquad \omega_-^2 = \frac{g}{L}, \qquad \omega_+^2 = \frac{g}{L} + 2\kappa`,
      symbols: [
        { tex: String.raw`T_{\text{beat}}`, key: "T_beat", unit: "s" },
        { tex: String.raw`\omega_-`, key: "omega_minus", unit: "1/s" },
        { tex: String.raw`\omega_+`, key: "omega_plus", unit: "1/s" },
        G,
        LENGTH,
        KAPPA,
      ],
    },
    energy: {
      tex: String.raw`E = \sum_{i=1,2}\Bigl(\tfrac12\,m L^2\dot\theta_i^2 + m g L\,(1 - \cos\theta_i)\Bigr) + \tfrac12\,k\,a^2\,(\sin\theta_2 - \sin\theta_1)^2`,
      symbols: [
        { tex: "E", key: "E_pair", unit: "J" },
        MASS,
        LENGTH,
        { tex: String.raw`\dot\theta_i`, key: "thetadot_i", unit: "1/s" },
        G,
        { tex: String.raw`\theta_i`, key: "coupled_theta_i", unit: "°" },
        K_SPRING,
        A_SPRING,
      ],
    },
  },
  smoke: {
    membrane_area: {
      tex: String.raw`A_{\mathrm{eff}} = \pi\left(a^2 - r_h^2\right) + \int_a^R 2\pi r\,\frac{\ln(R/r)}{\ln(R/a)}\,dr, \qquad \frac{\partial^2 u}{\partial r^2} + \frac{1}{r}\frac{\partial u}{\partial r} = 0 \;\Rightarrow\; u = A + B\ln r`,
      symbols: [
        A_EFF,
        { tex: "a", key: "ring_radius", unit: "m" },
        { tex: "r_h", key: "hole_radius", unit: "m" },
        { tex: "R", key: "drum_radius", unit: "m" },
        { tex: "r", key: "r_skin", unit: "m" },
        { tex: "u", key: "u_skin", unit: "m" },
        { tex: "A, B", key: "AB_const" },
      ],
    },
    slug_length: {
      tex: String.raw`\frac{L}{D} = \left(\frac{A_{\mathrm{eff}}}{A_{\mathrm{hole}}} + 1\right)\frac{d}{D}`,
      symbols: [
        { tex: "L", key: "slug", unit: "m" },
        HOLE_D,
        A_EFF,
        A_HOLE,
        { tex: "d", key: "press_depth", unit: "m" },
      ],
    },
    ring_speed: {
      tex: String.raw`U = \frac{\Gamma}{4\pi R}\left(\ln\frac{8R}{a} - \frac14\right), \qquad R = 0.6\,D, \quad a = 0.35\,R`,
      symbols: [
        { tex: "U", key: "ring_u", unit: "m/s" },
        { tex: String.raw`\Gamma`, key: "circulation", unit: "m²/s" },
        { tex: "R", key: "ring_r", unit: "m" },
        { tex: "a", key: "core_a", unit: "m" },
        HOLE_D,
      ],
    },
  },
  rainbow: {
    water: {
      tex: String.raw`\varphi = 2\beta - \arcsin(n\sin\beta), \qquad \beta_{\max} = \arccos\frac{2\sqrt{n^2 - 1}}{\sqrt{3}\,n}`,
      symbols: [RING, BETA_RAINBOW, INDEX_RAINBOW],
    },
    colours: {
      tex: String.raw`\Delta = 2\varphi_{\max}\bigl(n(700\,\mathrm{nm})\bigr) - 2\varphi_{\max}\bigl(n(400\,\mathrm{nm})\bigr), \qquad n(\lambda) = A + \frac{B}{\lambda^2}, \qquad A = n_D - \frac{B}{\lambda_D^2}`,
      symbols: [
        { tex: String.raw`\Delta`, key: "ring_width", unit: "°" },
        RING,
        INDEX_RAINBOW,
        { tex: String.raw`\lambda`, key: "wavelength", unit: "nm" },
        { tex: "A", key: "cauchy_a" },
        { tex: "B", key: "cauchy_b", unit: "nm²" },
        { tex: "n_D", key: "index_d" },
        { tex: String.raw`\lambda_D`, key: "sodium", unit: "nm" },
      ],
    },
    drawn_ray: {
      tex: String.raw`\theta = 2\varphi = 2\,(2\beta - i), \qquad \sin i = b, \qquad \sin\beta = \frac{b}{n}`,
      symbols: [
        { tex: String.raw`\theta`, key: "exit_angle", unit: "°" },
        BETA_RAINBOW,
        INCIDENCE,
        { tex: "b", key: "impact" },
        INDEX_RAINBOW,
      ],
    },
    reflected: {
      tex: String.raw`S = \int_0^1 \tfrac12\left[(1 - R_s)^2 R_s + (1 - R_p)^2 R_p\right] 2b\,db, \qquad R_s = \left(\frac{\cos i - n\cos\beta}{\cos i + n\cos\beta}\right)^2, \qquad R_p = \left(\frac{\cos\beta - n\cos i}{\cos\beta + n\cos i}\right)^2`,
      symbols: [
        { tex: "S", key: "back_share" },
        { tex: "R_s, R_p", key: "reflectance" },
        { tex: "b", key: "impact" },
        INCIDENCE,
        BETA_RAINBOW,
        INDEX_RAINBOW,
      ],
    },
  },
  cannon: {
    impact: {
      tex: String.raw`v = v_\infty \tanh\frac{g t}{v_\infty}, \qquad h = \frac{v_\infty^2}{g}\,\ln\cosh\frac{g t}{v_\infty}, \qquad v_\infty = \sqrt{\frac{2 m g}{\rho\, C_D A}}`,
      symbols: [
        V_IMPACT,
        V_INF_CANNON,
        G,
        TIME,
        { tex: "h", key: "cannon_h_drop", unit: "m" },
        MASS,
        { tex: String.raw`\rho`, key: "cannon_rho_air", unit: "kg/m³" },
        { tex: "C_D", key: "cannon_c_drag" },
        { tex: "A", key: "cannon_A_cross", unit: "m²" },
      ],
    },
    floor_peak: {
      tex: String.raw`F_{\max} = K\,\delta^{3/2}, \qquad \tfrac25\,K\,\delta^{5/2} = \tfrac12\,m v^2 + m g\,\delta, \qquad K = \tfrac43\,\frac{E}{1 - \nu^2}\sqrt{R}`,
      symbols: [
        { tex: String.raw`F_{\max}`, key: "F_floor", unit: "N" },
        K_FLOOR,
        { tex: String.raw`\delta`, key: "hM", unit: "m" },
        MASS,
        V_IMPACT,
        G,
        { tex: "E", key: "youngs", unit: "Pa" },
        { tex: String.raw`\nu`, key: "nu_poisson" },
        { tex: "R", key: "r", unit: "m" },
      ],
    },
    floor_time: {
      tex: String.raw`\tau = 2\left(\frac{25\,m^2}{16\,K^2 v}\right)^{1/5} \int_0^1 \frac{dx}{\sqrt{1 - x^{5/2}}}`,
      symbols: [TAU_CANNON, MASS, K_FLOOR, V_IMPACT],
    },
    floor_impulse: {
      tex: String.raw`J = 2\,m v + m g\,\tau`,
      symbols: [{ tex: "J", key: "J_impulse", unit: "N·s" }, MASS, V_IMPACT, G, TAU_CANNON],
    },
  },
  harmonograph: {
    wide_slower: {
      tex: String.raw`T = 4\sqrt{\frac{L}{g}}\;K\!\left(\sin\frac{\theta_0}{2}\right), \qquad K(k) = \int_0^{\pi/2} \frac{d\varphi}{\sqrt{1 - k^2 \sin^2\varphi}}`,
      symbols: [T_PERIOD, H_L, G, K_INTEGRAL, THETA0],
    },
    closes: {
      tex: String.raw`\frac{T_1}{T_2} = \sqrt{\frac{L_1}{L_2}} = \frac{3}{2} \;\Rightarrow\; (x, y)(2T_1) = (x, y)(0)`,
      symbols: [
        { tex: "T_1, T_2", key: "harm_T12", unit: "s" },
        { tex: "L_1, L_2", key: "harm_L12", unit: "m" },
        { tex: "x, y", key: "harm_xy", unit: "m" },
      ],
    },
    turns: {
      tex: String.raw`t_\text{turn} = \frac{1}{\lvert 3 f_1 - 2 f_2 \rvert}, \qquad f = \frac{1}{T(L, \theta_0)}`,
      symbols: [
        { tex: String.raw`t_\text{turn}`, key: "harm_turn", unit: "s" },
        { tex: "f_1, f_2", key: "harm_f12", unit: "Hz" },
        T_PERIOD,
        H_L,
        THETA0,
      ],
    },
    fades: {
      tex: String.raw`\theta_\text{max}(t) = \theta_0\,e^{-ct/2} \;\Rightarrow\; t_{1/10} = \frac{2 \ln 10}{c}`,
      symbols: [
        { tex: String.raw`\theta_\text{max}`, key: "harm_thetamax", unit: "°" },
        THETA0,
        { tex: "c", key: "harm_c", unit: "1/s" },
        TIME,
      ],
    },
  },
  overhang: {
    nine: {
      tex: String.raw`d = \ell\sum_{i=1}^{n}\frac{1}{2i} = \frac{H_n}{2}\,\ell`,
      symbols: [D_OVER, L_BLOCK, N_BLOCKS, { tex: "H_n", key: "H_n" }],
    },
    knife_edge: {
      tex: String.raw`\bar x_k = r_{k+1} \quad (k = 1, \ldots, n), \qquad r_{n+1} = 0`,
      symbols: [
        { tex: String.raw`\bar x_k`, key: "xbar_k", unit: "m" },
        { tex: String.raw`r_{k+1}`, key: "r_edge", unit: "m" },
        N_BLOCKS,
      ],
    },
    even: {
      tex: String.raw`s = \frac{1}{n + 1}, \qquad d = n\,s\,\ell = \frac{n}{n + 1}\,\ell`,
      symbols: [{ tex: "s", key: "s_step" }, N_BLOCKS, D_OVER, L_BLOCK],
    },
    four_lengths: {
      tex: String.raw`N = \min\Bigl\{\,n : \sum_{i=1}^{n}\frac{1}{2i} \ge 4\Bigr\}`,
      symbols: [{ tex: "N", key: "N_blocks" }, N_BLOCKS],
    },
  },
  galton: {
    eight_rows: {
      tex: String.raw`P(k) = \binom{n}{k}\,p^k\,(1-p)^{n-k}, \qquad P(4) = \binom{8}{4}\,\frac{1}{2^8} = \frac{70}{256}`,
      symbols: [GALTON_SHARE, GALTON_ROWS, GALTON_BIN, GALTON_P],
    },
    paths: {
      tex: String.raw`\binom{n}{k} = \frac{n!}{k!\,(n-k)!}, \qquad \binom{12}{6} = 924`,
      symbols: [{ tex: String.raw`\binom{n}{k}`, key: "galton_paths" }, GALTON_ROWS, GALTON_BIN],
    },
    tilted_mean: {
      tex: String.raw`\mu = \sum_{k=0}^{n} k\,P(k) = n\,p`,
      symbols: [GALTON_MEAN, GALTON_BIN, GALTON_SHARE, GALTON_ROWS, GALTON_P],
    },
    tilted_spread: {
      tex: String.raw`\sigma^2 = \sum_{k=0}^{n} (k-\mu)^2\,P(k) = n\,p\,(1-p)`,
      symbols: [
        { tex: String.raw`\sigma^2`, key: "galton_variance" },
        GALTON_MEAN,
        GALTON_BIN,
        GALTON_SHARE,
        GALTON_ROWS,
        GALTON_P,
      ],
    },
    seeded_run: {
      tex: String.raw`\bar k = \frac{1}{N}\sum_{i=1}^{N} k_i \approx n\,p, \qquad \sigma_{\bar k} = \frac{\sqrt{n\,p\,(1-p)}}{\sqrt{N}}`,
      symbols: [
        { tex: String.raw`\bar k`, key: "galton_run_mean" },
        { tex: "N", key: "galton_balls" },
        { tex: "k_i", key: "galton_ball_bin" },
        { tex: String.raw`\sigma_{\bar k}`, key: "galton_standard_error" },
        GALTON_ROWS,
        GALTON_P,
      ],
    },
    de_moivre: {
      tex: String.raw`\binom{n}{k}\,p^k q^{n-k} \simeq \frac{1}{\sqrt{2\pi\,n p q}}\,e^{-\frac{(k-np)^2}{2npq}}, \qquad \frac{1}{4^m}\binom{2m}{m} = \frac{1}{\sqrt{\pi m}}\left(1 - \frac{1}{8m} + \frac{1}{128m^2} + \dots\right)`,
      symbols: [GALTON_ROWS, GALTON_BIN, GALTON_P, { tex: "q", key: "galton_q" }, { tex: "m", key: "galton_half" }],
    },
  },
  film: {
    tear: {
      tex: String.raw`u = \coth u, \qquad \frac{h_\text{max}}{R} = \frac{2x_0}{y_0} = 2\,\operatorname{csch} u`,
      symbols: [
        { tex: "u", key: "film_u_tear" },
        { tex: String.raw`h_\text{max}`, key: "film_hmax", unit: "m" },
        { tex: "R", key: "film_R", unit: "m" },
        { tex: "x_0", key: "film_x0", unit: "m" },
        { tex: "y_0", key: "film_y0", unit: "m" },
      ],
    },
    critical_area: {
      tex: String.raw`\bar A = \frac{S}{2\pi R^2}, \qquad S = 2\pi a^2\left[\cosh^{-1}\frac{R}{a} + \tfrac12\sinh\!\left(2\cosh^{-1}\frac{R}{a}\right)\right], \qquad a = \frac{R}{\cosh u}`,
      symbols: [
        { tex: String.raw`\bar A`, key: "film_Abar" },
        { tex: "S", key: "film_S", unit: "m²" },
        { tex: "R", key: "film_R", unit: "m" },
        { tex: "a", key: "film_a", unit: "m" },
        { tex: "u", key: "film_u_tear" },
      ],
    },
    flat: {
      tex: String.raw`y_0 = a\cosh\frac{x_0}{a}, \qquad A = \pi a^2\left[\sinh\frac{2x_0}{a} + \frac{2x_0}{a}\right]`,
      symbols: [
        { tex: "y_0", key: "film_y0", unit: "m" },
        { tex: "a", key: "film_a", unit: "m" },
        { tex: "x_0", key: "film_x0", unit: "m" },
        { tex: "A", key: "film_A", unit: "m²" },
      ],
    },
    deep: {
      tex: String.raw`y_0 = a\cosh\frac{x_0}{a}, \qquad A = \pi a^2\left[\sinh\frac{2x_0}{a} + \frac{2x_0}{a}\right]`,
      symbols: [
        { tex: "y_0", key: "film_y0", unit: "m" },
        { tex: "a", key: "film_a", unit: "m" },
        { tex: "x_0", key: "film_x0", unit: "m" },
        { tex: "A", key: "film_A", unit: "m²" },
      ],
    },
    equal: {
      tex: String.raw`u\sqrt{u^2 - 1} + \cosh^{-1}u - u^2 = 0, \qquad \frac{h_0}{R} = \frac{2x_0}{y_0} = \frac{2\cosh^{-1}u}{u}`,
      symbols: [
        { tex: "u", key: "film_u_equal" },
        { tex: "h_0", key: "film_h0", unit: "m" },
        { tex: "R", key: "film_R", unit: "m" },
        { tex: "x_0", key: "film_x0", unit: "m" },
        { tex: "y_0", key: "film_y0", unit: "m" },
      ],
    },
  },
  elephant: {
    momentum_flux: {
      tex: String.raw`\dot M = \int_0^\infty 2\pi r\,\rho\,u^2\,dr = \rho\,U_0^2\,\frac{\pi D^2}{4}, \qquad u = u_c\,e^{-r^2/b^2}`,
      symbols: [
        { tex: String.raw`\dot M`, key: "m_flux", unit: "N" },
        { tex: "r", key: "r_jet", unit: "m" },
        RHO_AIR,
        { tex: "u", key: "u_jet", unit: "m/s" },
        U0_JET,
        OPENING,
        UC_JET,
        B_JET,
      ],
    },
    lift_off: {
      tex: String.raw`\tfrac12\rho\,c_d\,A\,\langle u^2\rangle = (m - \rho V)\,g, \qquad \langle u^2\rangle = u_c^2\,\frac{b^2}{2r^2}\left(1 - e^{-2r^2/b^2}\right), \qquad u_c = \frac{U_0 D}{\sqrt{2}\,b}, \qquad b = \frac{D}{\sqrt{2}} + \frac{s}{\sqrt{2}\,B}`,
      symbols: [
        RHO_AIR,
        CD,
        A_BALL,
        { tex: String.raw`\langle u^2\rangle`, key: "u2_mean", unit: "m²/s²" },
        M_BALL,
        V_BALL,
        G,
        UC_JET,
        B_JET,
        { tex: "r", key: "r", unit: "m" },
        U0_JET,
        OPENING,
        { tex: "s", key: "s_jet", unit: "m" },
        { tex: "B", key: "B_decay" },
      ],
    },
    float_balance: {
      tex: String.raw`\tfrac12\rho\,u^2\,c_d\,A = (m - \rho V)\,g \;\Rightarrow\; u = \sqrt{\frac{2\,(m - \rho V)\,g}{\rho\,c_d\,A}}`,
      symbols: [RHO_AIR, { tex: "u", key: "u_ball", unit: "m/s" }, CD, A_BALL, M_BALL, V_BALL, G],
    },
  },
  gyroscope: {
    steady_turn: {
      tex: String.raw`T = \frac{2\pi}{\Omega}, \qquad \Omega = \frac{m\,g\,d}{L_3}, \qquad L_3 = I_3\,\omega_3, \qquad I_3 = m\,r^2`,
      symbols: [
        { tex: "T", key: "round_time", unit: "s" },
        { tex: String.raw`\Omega`, key: "precession", unit: "1/s" },
        MASS,
        G,
        AXLE_GYROSCOPE,
        L3,
        { tex: "I_3", key: "i3_hoop", unit: "kg·m²" },
        SPIN_GYROSCOPE,
        HOOP_R,
      ],
    },
    dip: {
      tex: String.raw`\cos\alpha - \cos\beta = \frac{2\,m g d\,I_1}{L_3^2}\,\sin^2\beta, \qquad \alpha = 90^\circ, \qquad I_1 = \tfrac12\,m r^2 + m d^2`,
      symbols: [
        ALPHA_GYROSCOPE,
        { tex: String.raw`\beta`, key: "tilt_lowest", unit: "°" },
        MASS,
        G,
        AXLE_GYROSCOPE,
        I1,
        L3,
        HOOP_R,
      ],
    },
    nods: {
      tex: String.raw`\dot\theta^2 = B\,(\cos\alpha - \cos\theta) - \left[\frac{L_3\,(\cos\alpha - \cos\theta)}{I_1 \sin\theta}\right]^2 \approx B\,x - \left(\frac{L_3}{I_1}\right)^2 x^2, \qquad f = \frac{L_3}{2\pi\,I_1}`,
      symbols: [
        { tex: String.raw`\theta`, key: "axle_tilt", unit: "rad" },
        { tex: "B", key: "top_b", unit: "1/s²" },
        ALPHA_GYROSCOPE,
        L3,
        I1,
        { tex: "x", key: "below_level", unit: "rad" },
        { tex: "f", key: "f", unit: "1/s" },
      ],
    },
    suitcase: {
      tex: String.raw`\vec\tau = \vec\Omega \times \vec L, \qquad \tau = \Omega\,L_3, \qquad L_3 = m\,r^2\,\omega_3`,
      symbols: [
        { tex: String.raw`\tau`, key: "torque", unit: "N·m" },
        { tex: String.raw`\Omega`, key: "suitcase_turn", unit: "1/s" },
        L3,
        MASS,
        HOOP_R,
        SPIN_GYROSCOPE,
      ],
    },
  },
  spring: {
    fast_mode: {
      tex: String.raw`T_1 = \frac{2\pi}{\omega_1}, \qquad \omega_{1,2}^2 = \tfrac12\Bigl\{\omega_\theta^2 + \omega_z^2 \pm \bigl[(\omega_\theta^2 - \omega_z^2)^2 + \varepsilon^2/mI\bigr]^{1/2}\Bigr\}, \qquad z_0 = \frac{2I}{\varepsilon}\,(\omega_1^2 - \omega_\theta^2)\,\theta_0`,
      symbols: [
        { tex: "T_1", key: "spring_T1", unit: "s" },
        { tex: String.raw`\omega_1, \omega_2`, key: "spring_omega12", unit: "1/s" },
        { tex: String.raw`\omega_z^2 = k/m`, key: "spring_omega_z", unit: "1/s²" },
        { tex: String.raw`\omega_\theta^2 = \delta/I`, key: "spring_omega_theta", unit: "1/s²" },
        { tex: String.raw`\varepsilon`, key: "spring_epsilon", unit: "N" },
        MASS,
        INERTIA,
        { tex: "z_0", key: "spring_z0", unit: "m" },
        { tex: String.raw`\theta_0`, key: "spring_theta0", unit: "rad" },
      ],
    },
    slow_mode: {
      tex: String.raw`T_2 = \frac{2\pi}{\omega_2}, \qquad z_0 = \frac{2I}{\varepsilon}\,(\omega_2^2 - \omega_\theta^2)\,\theta_0`,
      symbols: [
        { tex: "T_2", key: "spring_T2", unit: "s" },
        { tex: String.raw`\omega_2`, key: "spring_omega2", unit: "1/s" },
        { tex: String.raw`\omega_\theta^2 = \delta/I`, key: "spring_omega_theta", unit: "1/s²" },
        { tex: String.raw`\varepsilon`, key: "spring_epsilon", unit: "N" },
        INERTIA,
        { tex: "z_0", key: "spring_z0", unit: "m" },
        { tex: String.raw`\theta_0`, key: "spring_theta0", unit: "rad" },
      ],
    },
    beat: {
      tex: String.raw`T_{\text{beat}} = \frac{2\pi}{\omega_B}, \qquad \omega_B = \omega_1 - \omega_2`,
      symbols: [
        { tex: String.raw`T_{\text{beat}}`, key: "spring_T_beat", unit: "s" },
        { tex: String.raw`\omega_B`, key: "spring_omega_B", unit: "1/s" },
        { tex: String.raw`\omega_1, \omega_2`, key: "spring_omega12", unit: "1/s" },
      ],
    },
    measured: {
      tex: String.raw`T_{\text{beat}} = \frac{2\pi}{\omega_B}, \qquad \omega_B = 0.232\ \text{rad/s}`,
      symbols: [
        { tex: String.raw`T_{\text{beat}}`, key: "spring_T_beat", unit: "s" },
        { tex: String.raw`\omega_B`, key: "spring_omega_B_measured", unit: "1/s" },
      ],
    },
    energy: {
      tex: String.raw`E = \tfrac12\,m\dot z^2 + \tfrac12\,I\dot\theta^2 + \tfrac12\,k z^2 + \tfrac12\,\delta\theta^2 + \tfrac12\,\varepsilon z\theta = \tfrac12\,k z_0^2`,
      symbols: [
        { tex: "E", key: "spring_E", unit: "J" },
        MASS,
        INERTIA,
        { tex: "z", key: "spring_z", unit: "m" },
        { tex: String.raw`\theta`, key: "spring_theta", unit: "rad" },
        { tex: "k", key: "spring_k", unit: "N/m" },
        { tex: String.raw`\delta`, key: "spring_delta", unit: "N·m" },
        { tex: String.raw`\varepsilon`, key: "spring_epsilon", unit: "N" },
        { tex: "z_0", key: "spring_pull", unit: "m" },
      ],
    },
  },
  metronomes: {
    lone: {
      tex: String.raw`\theta_{\max} = 2\,\theta_0`,
      symbols: [
        { tex: String.raw`\theta_{\max}`, key: "metronomes_amplitude", unit: "°" },
        { tex: String.raw`\theta_0`, key: "metronomes_theta0", unit: "rad" },
      ],
    },
    drift: {
      tex: String.raw`T = \frac{2\pi}{\omega\,\Delta\,\bigl(1 - \tfrac32\,\gamma\bigr)}, \qquad \gamma = \frac{\theta_0^2}{6}`,
      symbols: [
        { tex: "T", key: "metronomes_T_drift", unit: "s" },
        { tex: String.raw`\omega`, key: "metronomes_omega", unit: "1/s" },
        { tex: String.raw`\Delta`, key: "metronomes_delta" },
        { tex: String.raw`\gamma`, key: "metronomes_gamma" },
        { tex: String.raw`\theta_0`, key: "metronomes_theta0", unit: "rad" },
      ],
    },
    lag: {
      tex: String.raw`\psi^* = \arcsin\frac{\mu\,\Delta}{\beta\,(3\gamma + \beta)}, \qquad \beta = \frac{x_0\,\omega^2}{g}`,
      symbols: [
        { tex: String.raw`\psi^*`, key: "metronomes_psi", unit: "°" },
        { tex: String.raw`\mu`, key: "metronomes_mu" },
        { tex: String.raw`\Delta`, key: "metronomes_delta" },
        { tex: String.raw`\beta`, key: "metronomes_beta" },
        { tex: String.raw`\gamma`, key: "metronomes_gamma" },
        { tex: "x_0", key: "metronomes_x0", unit: "m" },
        { tex: String.raw`\omega`, key: "metronomes_omega", unit: "1/s" },
        G,
      ],
    },
    inphase: {
      tex: String.raw`\psi \to 0`,
      symbols: [{ tex: String.raw`\psi`, key: "metronomes_psi", unit: "°" }],
    },
    five: {
      tex: String.raw`R\,e^{i\psi} = \frac{1}{N}\sum_{j=1}^{N} e^{i\varphi_j} \;\to\; 1`,
      symbols: [
        { tex: "R", key: "metronomes_R" },
        { tex: String.raw`\varphi_j`, key: "metronomes_phi", unit: "rad" },
        { tex: "N", key: "metronomes_N" },
      ],
    },
  },
};
