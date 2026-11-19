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
      tex: String.raw`\Delta E = \frac{v}{R}\int k(x)^2\,dx, \qquad k = \frac{d\Psi}{dx}`,
      symbols: [
        { tex: String.raw`\Delta E`, key: "dE", unit: "J" },
        { tex: "v", key: "v", unit: "m/s" },
        R_COIL,
        { tex: "k", key: "coupling", unit: "V·s/m" },
        { tex: "x", key: "x", unit: "m" },
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
};
