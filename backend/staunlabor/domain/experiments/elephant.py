"""The Bernoulli elephant: a light ball held up, and held in, by a jet of air.

The exhibit is an elephant blowing straight up through its trunk; a visitor
sets an inflatable ball on the opening, and it floats a hand's breadth above
it and stays there (as seen at the exhibit: an opening of about 10 cm, a ball
of about 15 cm, floating 30 to 35 cm up). The page lets the reader do what the
exhibit does not: change the air, the ball and the opening, push the ball, and
tilt the trunk until the ball falls out.

**The jet.** A round turbulent free jet, as the textbooks have it (Pope,
*Turbulent Flows*, §5.1): a bell-shaped profile whose width grows linearly with
the distance and whose momentum flux stays what the opening put in. Here the
profile is a Gaussian, ``u = u_c·exp(−r²/b²)``, with the width
``b = D/√2 + k·s`` — at the opening the bell carries the opening's own
momentum at the opening's own speed — and ``k = 1/(√2·B)``, so that ``1/u_c``
grows with the distance at the rate Pope's decay constant ``B ≈ 6`` gives it.
Conserved momentum then fixes the centre speed everywhere:
``u_c = U₀·D/(√2·b) = B·U₀·D/(s + B·D)``.

What it leaves out is the first few diameters. A real jet keeps ``U₀`` on its
axis for about five of them (its potential core), and its decay starts from a
virtual origin a few diameters *ahead* of the opening; this one's lies ``B·D``
behind it, so near the opening its centre speed is lower than the real one —
at the ball, three to four diameters up, by about a third. What the ball feels
is ``u²`` summed over its cross-section: how much of the jet's momentum lies
within its radius, which is the jet's width, and that the model grows at the
textbook rate from the opening's own. The float height it states is the
model's; the page says the exhibit's real blower is not published.

**What the air does to the ball.**

* *Up, along the jet*: the drag of a sphere, ``½·ρ·C_d·A·|w|·w``, on the
  air's velocity relative to the ball, ``w``. The air's speed is the root mean
  square of ``u`` over the ball's cross-section, so a ball wider than the jet
  feels the part of the jet it covers; with ``C_d = 0.47``, a smooth sphere
  below the drag crisis. Higher up the jet is wider and the ball covers less
  of it, so the force falls with height: that is why the ball has a height,
  and why it comes back to it.
* *Sideways, into the jet*: off the axis, the air streams faster past the side
  of the ball nearer the axis, and faster air presses less (Bernoulli). The
  model's force is the first moment of ``½·ρ·u²`` over the cross-section, toward
  where it is larger, times one coefficient, :attr:`Elephant.coanda`. That
  coefficient is the model's only fitted number: about 1 is the order a sphere
  has (its surface sees up to 1.5 times the speed of the air that meets it, and
  the sideways share of the surface is about a half); the page offers it as a
  slider and says so.
* *Down*: the weight, less the buoyancy of the air the ball displaces — for an
  inflatable ball of 15 cm and 30 g a fourteenth of its weight.

The ball's inertia includes half the displaced air's mass (a sphere's added
mass). It sits on the opening, which it is wider than, until the air lifts it;
it has fallen once its centre is below the opening and beside it.

**The time simulation** steps ``(x, y, vx, vy)`` by fourth-order Runge–Kutta at
2 ms, the integral over the cross-section a fixed rule of 288 points (twelve
rings of equal area, 24 spokes): the figures and the browser's port run the same
sums, so the height the page settles at is the height it states.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

G = 9.80665
#: Air at about 20 °C, kg/m³, and its kinematic viscosity, m²/s.
RHO = 1.2
NU = 1.5e-5
#: A smooth sphere's drag coefficient below the drag crisis.
DRAG = 0.47
#: The round jet's decay constant: far up, ``u_c = DECAY·U₀·D/s`` (Pope's 5.8 to 6.1).
DECAY = 6.0
#: How fast the Gaussian's width grows with the distance, ``k = 1/(√2·B)``.
SPREAD = 1 / (math.sqrt(2) * DECAY)

#: The integration rule over the ball's cross-section: rings of equal area, spokes.
RINGS = 12
SPOKES = 24

STEP_S = 2e-3
SAMPLES_PER_S = 50
MAX_DURATION_S = 60.0
#: The steepest the trunk tilts.
MAX_TILT_DEG = 80.0


@dataclass(frozen=True)
class Jet:
    #: The trunk's opening, a diameter.
    opening_m: float = 0.10
    #: The air's speed leaving it.
    speed_m_s: float = 14.5

    def __post_init__(self) -> None:
        if self.opening_m <= 0:
            raise ValueError("an opening needs a size")
        if self.speed_m_s < 0:
            raise ValueError("the air cannot blow backwards")


@dataclass(frozen=True)
class FloatingBall:
    diameter_m: float = 0.15
    mass_kg: float = 0.030

    def __post_init__(self) -> None:
        if self.diameter_m <= 0 or self.mass_kg <= 0:
            raise ValueError("a ball needs a size and a mass")
        if self.mass_kg <= self.displaced_kg:
            raise ValueError("a ball lighter than the air it displaces rises on its own")

    @property
    def radius_m(self) -> float:
        return self.diameter_m / 2

    @property
    def area_m2(self) -> float:
        return math.pi * self.radius_m**2

    @property
    def displaced_kg(self) -> float:
        return RHO * 4 / 3 * math.pi * self.radius_m**3


@dataclass(frozen=True)
class Elephant:
    jet: Jet = Jet()
    ball: FloatingBall = FloatingBall()
    #: How much of the Bernoulli suction acts sideways: the model's one fitted number.
    coanda: float = 1.0

    def __post_init__(self) -> None:
        if self.ball.diameter_m <= self.jet.opening_m:
            raise ValueError("the ball has to be wider than the opening it sits on")
        if self.coanda < 0:
            raise ValueError("the air does not push the ball out of the jet")


# ── the jet ──────────────────────────────────────────────────────────────────


def width(jet: Jet, s: float) -> float:
    """The Gaussian's width ``b`` at ``s`` metres along the axis."""
    return jet.opening_m / math.sqrt(2) + SPREAD * s


def centre_speed(jet: Jet, s: float) -> float:
    """The speed on the axis, from the momentum the opening puts in."""
    return jet.speed_m_s * jet.opening_m / (math.sqrt(2) * width(jet, s))


def momentum_flux_n(jet: Jet) -> float:
    """What the jet carries up, and keeps: ``ρ·U₀²·π·D²/4``."""
    return RHO * jet.speed_m_s**2 * math.pi * jet.opening_m**2 / 4


#: The rule's nodes as (radius share, cos, sin): rings of equal area, so every
#: node stands for the same share of the cross-section, and half the spokes —
#: each node is summed with the one opposite it, so a ball on the axis feels
#: exactly no sideways pull, not a rounding error's worth that a run would
#: carry along.
NODES: tuple[tuple[float, float, float], ...] = tuple(
    (
        math.sqrt((i + 0.5) / RINGS),
        math.cos(2 * math.pi * (j + 0.5) / SPOKES),
        math.sin(2 * math.pi * (j + 0.5) / SPOKES),
    )
    for i in range(RINGS)
    for j in range(SPOKES // 2)
)


@dataclass(frozen=True)
class Cover:
    """What the jet does over the ball's cross-section at ``(s, e)``: the mean
    of ``u²`` over it, and the first moment of ``u²`` toward ``+e``, both per
    square metre of cross-section (m²/s²)."""

    mean_square: float
    moment: float


def cover(el: Elephant, s: float, e: float) -> Cover:
    """The cross-section ``e`` off the axis at ``s`` along it, summed node by node."""
    if s <= 0:
        return Cover(0.0, 0.0)
    jet = el.jet
    r_ball = el.ball.radius_m
    b = width(jet, s)
    u_c = centre_speed(jet, s)
    peak = u_c * u_c
    total = 0.0
    moment = 0.0
    for share, c, sn in NODES:
        rho = r_ball * share
        near = e + rho * c
        far = e - rho * c
        y2 = (rho * sn) ** 2
        u2_near = peak * math.exp(-2 * (near * near + y2) / (b * b))
        u2_far = peak * math.exp(-2 * (far * far + y2) / (b * b))
        total += u2_near + u2_far
        moment += (u2_near - u2_far) * c
    n = 2 * len(NODES)
    return Cover(total / n, moment / n)


# ── the forces and a step ────────────────────────────────────────────────────


def axes(tilt_deg: float) -> tuple[tuple[float, float], tuple[float, float]]:
    """The jet's axis and the direction across it, in the plane: the trunk
    tilted ``tilt_deg`` from straight up toward ``+x``; across points to the
    lower side, where a tilted jet's ball sags."""
    a = math.radians(tilt_deg)
    return (math.sin(a), math.cos(a)), (math.cos(a), -math.sin(a))


def rest_height(el: Elephant) -> float:
    """The ball's centre above the opening while it sits on the rim."""
    r = el.ball.radius_m
    half = el.jet.opening_m / 2
    return math.sqrt(r * r - half * half)


def net_weight_n(el: Elephant) -> float:
    return (el.ball.mass_kg - el.ball.displaced_kg) * G


def acceleration(el: Elephant, tilt_deg: float, state: tuple[float, float, float, float]) -> tuple[float, float]:
    """``(ax, ay)`` of the ball at ``(x, y, vx, vy)``: the drag on the air's
    speed relative to the ball, the sideways suction, the weight less the
    buoyancy, over the mass with half the displaced air's."""
    x, y, vx, vy = state
    (ax_, ay_), (nx, ny) = axes(tilt_deg)
    s = x * ax_ + y * ay_
    e = x * nx + y * ny
    c = cover(el, s, e)
    ball = el.ball
    mean = math.sqrt(c.mean_square)
    wx = mean * ax_ - vx
    wy = mean * ay_ - vy
    w = math.sqrt(wx * wx + wy * wy)
    drag = 0.5 * RHO * DRAG * ball.area_m2 * w
    side = el.coanda * 0.5 * RHO * ball.area_m2 * c.moment
    inertia = ball.mass_kg + 0.5 * ball.displaced_kg
    fx = drag * wx + side * nx
    fy = drag * wy + side * ny - net_weight_n(el)
    return fx / inertia, fy / inertia


def seat(el: Elephant, tilt_deg: float, state: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """The opening holds the ball: a centre that came closer along the axis
    than :func:`rest_height`, while over the opening, is set back on the rim,
    and its speed into the trunk taken away (the ball does not bounce)."""
    x, y, vx, vy = state
    (ax_, ay_), (nx, ny) = axes(tilt_deg)
    s = x * ax_ + y * ay_
    e = x * nx + y * ny
    floor = rest_height(el)
    if s >= floor or abs(e) > el.jet.opening_m / 2:
        return state
    x, y = floor * ax_ + e * nx, floor * ay_ + e * ny
    into = vx * ax_ + vy * ay_
    if into < 0:
        vx, vy = vx - into * ax_, vy - into * ay_
    return x, y, vx, vy


def step(
    el: Elephant, tilt_deg: float, state: tuple[float, float, float, float], h: float = STEP_S
) -> tuple[float, float, float, float]:
    """One Runge–Kutta step, then the rim."""

    def f(st: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
        ax_, ay_ = acceleration(el, tilt_deg, st)
        return st[2], st[3], ax_, ay_

    def add(st: tuple[float, ...], k: tuple[float, ...], scale: float) -> tuple[float, float, float, float]:
        return (st[0] + scale * k[0], st[1] + scale * k[1], st[2] + scale * k[2], st[3] + scale * k[3])

    k1 = f(state)
    k2 = f(add(state, k1, h / 2))
    k3 = f(add(state, k2, h / 2))
    k4 = f(add(state, k3, h))
    nxt = tuple(state[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) for i in range(4))
    return seat(el, tilt_deg, (nxt[0], nxt[1], nxt[2], nxt[3]))


def fallen(el: Elephant, state: tuple[float, float, float, float]) -> bool:
    """Out of the jet for good: the centre below the opening and beside it."""
    x, y, _, _ = state
    return y < 0 and abs(x) > el.jet.opening_m / 2 + el.ball.radius_m


def start_state(el: Elephant, tilt_deg: float = 0.0) -> tuple[float, float, float, float]:
    """The ball set on the opening, at rest."""
    (ax_, ay_), _ = axes(tilt_deg)
    h = rest_height(el)
    return h * ax_, h * ay_, 0.0, 0.0


# ── a run ────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Move:
    """From ``at_s`` on, the trunk turns linearly to ``tilt_deg`` over
    ``over_s`` seconds; a push sideways of ``nudge_m_s`` at ``at_s``."""

    at_s: float
    tilt_deg: float
    over_s: float = 1.0
    nudge_m_s: float = 0.0


def tilt_at(moves: tuple[Move, ...], t: float) -> float:
    """The tilt at ``t``: each move blends from where the last left off."""
    tilt = 0.0
    for move in moves:
        if t <= move.at_s:
            break
        f = 1.0 if move.over_s <= 0 else min(1.0, (t - move.at_s) / move.over_s)
        tilt += (move.tilt_deg - tilt) * f
    return tilt


@dataclass(frozen=True)
class ElephantRun:
    t: tuple[float, ...]
    x_m: tuple[float, ...]
    y_m: tuple[float, ...]
    tilt_deg: tuple[float, ...]
    #: The air's speed at the ball, the root mean square over its cross-section.
    air_m_s: tuple[float, ...]
    #: When the ball fell out of the jet, if it did.
    fell_at_s: float | None


def run(el: Elephant, moves: tuple[Move, ...], duration_s: float) -> ElephantRun:
    """The ball from the opening, under a sequence of tilts and pushes, sampled
    :data:`SAMPLES_PER_S` times a second; it stops when the ball has fallen."""
    if not 0 < duration_s <= MAX_DURATION_S:
        raise ValueError(f"a run lasts between 0 and {MAX_DURATION_S:g} s")
    for move in moves:
        if abs(move.tilt_deg) > MAX_TILT_DEG:
            raise ValueError(f"the trunk tilts at most {MAX_TILT_DEG:g}°")
    steps = round(duration_s / STEP_S)
    every = round(1 / (SAMPLES_PER_S * STEP_S))
    nudges = sorted((m.at_s, m.nudge_m_s) for m in moves if m.nudge_m_s)
    state = start_state(el, tilt_at(moves, 0.0))
    out: dict[str, list[float]] = {k: [] for k in ("t", "x", "y", "tilt", "air")}
    fell: float | None = None
    pushed = 0
    for n in range(steps + 1):
        t = n * STEP_S
        tilt = tilt_at(moves, t)
        while pushed < len(nudges) and nudges[pushed][0] <= t:
            _, (nx, ny) = axes(tilt)
            push = nudges[pushed][1]
            state = (state[0], state[1], state[2] + push * nx, state[3] + push * ny)
            pushed += 1
        if n % every == 0:
            (ax_, ay_), (nx, ny) = axes(tilt)
            s = state[0] * ax_ + state[1] * ay_
            e = state[0] * nx + state[1] * ny
            out["t"].append(t)
            out["x"].append(state[0])
            out["y"].append(state[1])
            out["tilt"].append(tilt)
            out["air"].append(math.sqrt(cover(el, s, e).mean_square))
        if fallen(el, state):
            fell = t
            break
        if n < steps:
            state = step(el, tilt, state)
    return ElephantRun(
        t=tuple(out["t"]),
        x_m=tuple(out["x"]),
        y_m=tuple(out["y"]),
        tilt_deg=tuple(out["tilt"]),
        air_m_s=tuple(out["air"]),
        fell_at_s=fell,
    )


# ── the figures ──────────────────────────────────────────────────────────────


def lift_n(el: Elephant, s: float, e: float = 0.0) -> float:
    """The jet's push along its axis on a ball at rest at ``(s, e)``."""
    return 0.5 * RHO * DRAG * el.ball.area_m2 * cover(el, s, e).mean_square


def side_n(el: Elephant, s: float, e: float) -> float:
    """The sideways suction on a ball at ``(s, e)``, positive toward ``+e``."""
    return el.coanda * 0.5 * RHO * el.ball.area_m2 * cover(el, s, e).moment


def float_height(el: Elephant) -> float | None:
    """Where the straight jet holds the ball: the height whose lift is its net
    weight, found by halving; none while the air cannot lift it off the rim."""
    weight = net_weight_n(el)
    lo = rest_height(el)
    if lift_n(el, lo) <= weight:
        return None
    hi = lo + 0.5
    while lift_n(el, hi) > weight:
        hi += 0.5
    for _ in range(60):
        mid = (lo + hi) / 2
        if lift_n(el, mid) > weight:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def balance(el: Elephant, tilt_deg: float, guess: tuple[float, float]) -> tuple[float, float] | None:
    """Where a ball at rest stays in the jet tilted ``tilt_deg``: ``(s, e)`` with
    the lift equal to the weight's share along the axis and the suction to its
    share across, by Newton's method from ``guess``; none if it does not meet
    one — past the tilt the jet can hold."""
    weight = net_weight_n(el)
    a = math.radians(tilt_deg)
    along = weight * math.cos(a)
    across = weight * math.sin(a)

    def residual(s: float, e: float) -> tuple[float, float]:
        return lift_n(el, s, e) - along, side_n(el, s, e) + across

    s, e = guess
    scale = el.ball.diameter_m
    for _ in range(40):
        f1, f2 = residual(s, e)
        if abs(f1) < 1e-9 * weight and abs(f2) < 1e-9 * weight:
            return s, e
        d = 1e-6 * scale
        a11 = (residual(s + d, e)[0] - f1) / d
        a21 = (residual(s + d, e)[1] - f2) / d
        a12 = (residual(s, e + d)[0] - f1) / d
        a22 = (residual(s, e + d)[1] - f2) / d
        det = a11 * a22 - a12 * a21
        if det == 0:
            return None
        ds = (f1 * a22 - f2 * a12) / det
        de = (a11 * f2 - a21 * f1) / det
        # A step no longer than a tenth of the ball: Newton near the fold
        # otherwise jumps to the unstable branch beyond it.
        reach = math.hypot(ds, de)
        if reach > 0.1 * scale:
            ds, de = ds * 0.1 * scale / reach, de * 0.1 * scale / reach
        s, e = s - ds, e - de
        if s < rest_height(el) or e < 0:
            return None
    return None


def stable(el: Elephant, s: float, e: float) -> bool:
    """Whether a nudge brings the ball back: the lift falls with height and the
    suction pulls harder the farther the ball strays (both slopes negative)."""
    d = 1e-5 * el.ball.diameter_m
    lift_slope = (lift_n(el, s + d, e) - lift_n(el, s - d, e)) / (2 * d)
    side_slope = (side_n(el, s, e + d) - side_n(el, s, e - d)) / (2 * d)
    return lift_slope < 0 and side_slope < 0


@dataclass(frozen=True)
class TiltPoint:
    tilt_deg: float
    #: Along the axis, and across it toward the lower side.
    height_m: float
    offset_m: float


def tilt_curve(el: Elephant, start: float) -> tuple[tuple[TiltPoint, ...], float]:
    """The ball's place as the trunk tilts, from straight up by degrees, until
    no stable place is left; and that tilt, to a tenth of a degree."""
    points = [TiltPoint(0.0, start, 0.0)]
    guess = (start, 0.0)
    tilt = 0.0
    while tilt < MAX_TILT_DEG:
        found = balance(el, tilt + 1.0, guess)
        if found is None or not stable(el, *found):
            break
        tilt += 1.0
        guess = found
        points.append(TiltPoint(tilt, found[0], found[1]))
    lo, hi = tilt, min(tilt + 1.0, MAX_TILT_DEG)
    best = guess
    while hi - lo > 0.1 + 1e-9:
        mid = (lo + hi) / 2
        found = balance(el, mid, best)
        if found is not None and stable(el, *found):
            lo, best = mid, found
        else:
            hi = mid
    return tuple(points), lo


@dataclass(frozen=True)
class LiftPoint:
    height_m: float
    lift_n: float


@dataclass(frozen=True)
class SidePoint:
    offset_m: float
    side_n: float
    lift_n: float


@dataclass(frozen=True)
class ElephantFigures:
    weight_n: float
    buoyancy_n: float
    #: The ball's centre above the opening while it sits on the rim, and the lift there.
    rest_height_m: float
    rest_lift_n: float
    #: The least air speed that lifts the ball off the rim.
    lift_off_m_s: float
    #: The jet's momentum flux, and the air it moves.
    jet_thrust_n: float
    flow_m3_s: float
    #: Where the straight jet holds the ball (its centre above the opening), and
    #: what it meets there; none while the ball sits on the rim.
    float_height_m: float | None
    air_m_s: float | None
    centre_m_s: float | None
    reynolds: float | None
    #: How fast it bobs up and down and sways, small and undamped.
    bob_hz: float | None
    sway_hz: float | None
    #: The steepest tilt the jet still holds the ball at.
    tilt_limit_deg: float | None
    lift_curve: tuple[LiftPoint, ...]
    side_curve: tuple[SidePoint, ...]
    tilt_curve: tuple[TiltPoint, ...]


def figures(el: Elephant) -> ElephantFigures:
    weight = el.ball.mass_kg * G
    buoyancy = el.ball.displaced_kg * G
    rest = rest_height(el)
    rest_lift = lift_n(el, rest)
    net = net_weight_n(el)
    # The lift grows with the square of the air speed at every height.
    lift_off = el.jet.speed_m_s * math.sqrt(net / rest_lift) if rest_lift > 0 else math.inf
    height = float_height(el)
    top = max(1.0, 1.5 * height) if height is not None else 1.0
    lift_curve = tuple(
        LiftPoint(rest + (top - rest) * i / 40, lift_n(el, rest + (top - rest) * i / 40)) for i in range(41)
    )
    if height is None:
        return ElephantFigures(
            weight_n=weight,
            buoyancy_n=buoyancy,
            rest_height_m=rest,
            rest_lift_n=rest_lift,
            lift_off_m_s=lift_off,
            jet_thrust_n=momentum_flux_n(el.jet),
            flow_m3_s=el.jet.speed_m_s * math.pi * el.jet.opening_m**2 / 4,
            float_height_m=None,
            air_m_s=None,
            centre_m_s=None,
            reynolds=None,
            bob_hz=None,
            sway_hz=None,
            tilt_limit_deg=None,
            lift_curve=lift_curve,
            side_curve=(),
            tilt_curve=(),
        )
    air = math.sqrt(cover(el, height, 0.0).mean_square)
    inertia = el.ball.mass_kg + 0.5 * el.ball.displaced_kg
    d = 1e-5 * el.ball.diameter_m
    lift_slope = (lift_n(el, height + d) - lift_n(el, height - d)) / (2 * d)
    side_slope = (side_n(el, height, d) - side_n(el, height, -d)) / (2 * d)
    reach = 2 * width(el.jet, height) + el.ball.radius_m
    side_curve = tuple(
        SidePoint(reach * i / 40, -side_n(el, height, reach * i / 40), lift_n(el, height, reach * i / 40))
        for i in range(41)
    )
    tilts, limit = tilt_curve(el, height)
    return ElephantFigures(
        weight_n=weight,
        buoyancy_n=buoyancy,
        rest_height_m=rest,
        rest_lift_n=rest_lift,
        lift_off_m_s=lift_off,
        jet_thrust_n=momentum_flux_n(el.jet),
        flow_m3_s=el.jet.speed_m_s * math.pi * el.jet.opening_m**2 / 4,
        float_height_m=height,
        air_m_s=air,
        centre_m_s=centre_speed(el.jet, height),
        reynolds=air * el.ball.diameter_m / NU,
        bob_hz=math.sqrt(-lift_slope / inertia) / (2 * math.pi) if lift_slope < 0 else None,
        sway_hz=math.sqrt(-side_slope / inertia) / (2 * math.pi) if side_slope < 0 else None,
        tilt_limit_deg=limit,
        lift_curve=lift_curve,
        side_curve=side_curve,
        tilt_curve=tilts,
    )
