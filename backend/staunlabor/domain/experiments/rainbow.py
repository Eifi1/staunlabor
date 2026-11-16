"""The glass-bead rainbow: a wall of tiny glass beads lit from behind shows a ring round the shadow of one's head.

The exhibit is a wall covered in glass beads, a fraction of a millimetre each,
and a lamp beside one's head. Round the shadow of one's head a coloured ring
appears, red outside, blue inside: a rainbow, but half the size of the one in
the sky.

**Why a ring.** Light enters a bead, is reflected once at its back and leaves
towards where it came from, turned away from the straight way back by
``θ = 4r − 2i`` (``i`` the angle it meets the surface at, ``r`` the angle it
goes on at inside, ``sin i = n·sin r``). Rays at the bead's centre come
straight back; rays further out leave at a larger angle, up to a largest one,
the rainbow angle, ``cos² i = (n² − 1)/3``; rays further out still turn back
in. Near the largest angle the angle hardly changes as the ray moves out, so
light from a wide band of the bead leaves there together: the bright ring.
Every bead sends it at the same angle, so one sees it in every bead that lies
at that angle from the shadow of one's head — a circle round it.

**Why coloured, and why smaller.** The rainbow angle depends only on the
index ``n``: 42° for water, 21° for glass, and 0° at ``n = 2``, where every ray
near the centre comes straight back. ``n`` is a little larger for blue light
than for red (``n(λ) = n_D + B·(1/λ² − 1/λ_D²)``, Cauchy's form, ``n_D`` at the
sodium line), so each colour has its ring; red's is the largest.

**The ring as the eye sees it.** The bead's face is cut into rings of equal
area, each followed through by its ray at every wavelength; its light, less
what the three surfaces let through or reflect (Fresnel's formulas, both
polarisations, averaged), spreads over the angles between its two edges. The
light per angle is that over the cone's solid angle, blurred by the lamp's
size; the colour per angle is ``colour.seen`` of the lamp's spectrum by it.

**What it leaves out.** The bead's size (with geometric optics it does not
enter; in beads under a tenth of a millimetre or so, the waves widen the ring
and add faint ones inside it); light reflected twice or more inside (a second
ring, for glass far out of sight) or not at all (the beads' white sheen);
the wall behind the beads; beads touching each other; and the fact that a
screen shows these colours only roughly (``colour``).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.colour import WAVELENGTHS_NM, lamp, on_screen, seen

#: The wavelength an index is stated at (the sodium line, ``n_D``), nm.
SODIUM_NM = 589.3
#: The ends of the visible range the figures give the ring's edges at, nm.
RED_NM = 700.0
VIOLET_NM = 400.0
#: The profile: the angle from the shadow of one's head in bins of this, up to
#: the last one's edge — past every ring an index from 1.3 makes.
PROFILE_STEP_DEG = 0.1
PROFILE_BINS = 600
#: The bead's face is cut into this many rings of equal area.
RINGS = 2000
#: The lamp's angular radius, seen from the wall — the sun's from the earth.
LAMP_RADIUS_DEG = 0.25
#: The lamp's temperature: only its colour enters, and the eye takes it as white.
LAMP_K = 3000.0
#: The figures' "near the rainbow angle": within this of it.
NEAR_DEG = 1.0


@dataclass(frozen=True)
class Bead:
    #: ``n_D``, the index at the sodium line: soda-lime glass by default.
    index: float = 1.52
    #: Cauchy's ``B``, how much more the index is for blue, nm².
    dispersion_nm2: float = 4200.0

    def __post_init__(self) -> None:
        if not 1.3 <= self.index <= 1.95:
            raise ValueError("a bead's index is 1.3 to 1.95: a ring from 49° down to a few degrees")
        if not 0 <= self.dispersion_nm2 <= 10000:
            raise ValueError("a bead's dispersion is 0 to 10 000 nm²")


GLASS = Bead()
#: A raindrop: water's index and dispersion.
WATER = Bead(index=1.333, dispersion_nm2=3140.0)


def index_at(bead: Bead, nm: float) -> float:
    """The bead's index at ``nm`` (Cauchy's form)."""
    return bead.index + bead.dispersion_nm2 * (1 / nm**2 - 1 / SODIUM_NM**2)


def _angles(n: float, b: float) -> tuple[float, float]:
    """``i`` and ``r`` of the ray that meets the bead ``b`` of its radius off
    its centre."""
    return math.asin(b), math.asin(b / n)


def exit_angle(n: float, b: float) -> float:
    """``θ = 4r − 2i``, rad: how far the ray that meets the bead ``b`` of its
    radius off centre leaves from the straight way back; below zero, it leaves
    across that way, to the other side."""
    i, r = _angles(n, b)
    return 4 * r - 2 * i


def rainbow_impact(n: float) -> float:
    """``b`` of the ray that leaves at the rainbow angle: ``cos² i = (n² − 1)/3``."""
    if not 1 < n < 2:
        raise ValueError("a bead makes a rainbow for an index above 1 and below 2")
    return math.sqrt((4 - n * n) / 3)


def rainbow_angle(n: float) -> float:
    """The largest ``θ``, rad: the ring's radius."""
    return exit_angle(n, rainbow_impact(n))


def ray_share(n: float, b: float) -> float:
    """The share of the ray's light that leaves after one reflection inside:
    let in, reflected and let out (Fresnel), each polarisation on its own and
    the two averaged. Inside, the ray meets the surface at ``r``, where it
    reflects as much as at ``i`` outside (Stokes), so one reflectance does."""
    i, r = _angles(n, b)
    ci, cr = math.cos(i), math.cos(r)
    across = ((ci - n * cr) / (ci + n * cr)) ** 2
    along = ((n * ci - cr) / (n * ci + cr)) ** 2
    return 0.5 * ((1 - across) ** 2 * across + (1 - along) ** 2 * along)


@dataclass(frozen=True)
class RayPath:
    """A ray through a bead of radius 1 at the origin, the lamp's light coming
    from the left (``-x``) and meeting it ``b`` above its centre."""

    entry: tuple[float, float]
    back: tuple[float, float]
    exit: tuple[float, float]
    #: The way it leaves, a unit vector.
    out: tuple[float, float]


def _refract(d: tuple[float, float], normal: tuple[float, float], eta: float) -> tuple[float, float]:
    """Snell's law for vectors: ``d`` crossing a surface whose unit ``normal``
    points back against it, ``eta`` the index it leaves over the one it enters."""
    cos_i = -(d[0] * normal[0] + d[1] * normal[1])
    cos_t = math.sqrt(max(0.0, 1 - eta * eta * (1 - cos_i * cos_i)))
    k = eta * cos_i - cos_t
    return eta * d[0] + k * normal[0], eta * d[1] + k * normal[1]


def _across(p: tuple[float, float], d: tuple[float, float]) -> tuple[float, float]:
    """Where the ray from ``p`` on the circle along ``d`` meets it again."""
    t = -2 * (p[0] * d[0] + p[1] * d[1])
    return p[0] + t * d[0], p[1] + t * d[1]


def trace(n: float, b: float) -> RayPath:
    """The ray's way in, across, back and out, by Snell's law and the law of
    reflection with vectors — the drawing's, and the angle formula's check."""
    if not 0 <= b < 1:
        raise ValueError("a ray meets the bead from its centre to just short of its rim")
    entry = (-math.sqrt(1 - b * b), b)
    inside = _refract((1.0, 0.0), entry, 1 / n)
    back = _across(entry, inside)
    along = inside[0] * back[0] + inside[1] * back[1]
    reflected = (inside[0] - 2 * along * back[0], inside[1] - 2 * along * back[1])
    leave = _across(back, reflected)
    out = _refract(reflected, (-leave[0], -leave[1]), n)
    return RayPath(entry=entry, back=back, exit=leave, out=out)


def _blur(power: list[float]) -> list[float]:
    """The light per bin as a lamp of ``LAMP_RADIUS_DEG`` spreads it: each
    bin's over its neighbours, weighted as the lamp's disc is wide there. Light
    spread below zero is folded back: the angle is one from the axis."""
    reach = int(LAMP_RADIUS_DEG / PROFILE_STEP_DEG)
    weights = [math.sqrt(1 - (k * PROFILE_STEP_DEG / LAMP_RADIUS_DEG) ** 2) for k in range(-reach, reach + 1)]
    total = sum(weights)
    out = [0.0] * len(power)
    for j, p in enumerate(power):
        for k, w in zip(range(-reach, reach + 1), weights, strict=True):
            at = j + k
            at = -at - 1 if at < 0 else at
            if at < len(out):
                out[at] += p * w / total
    return out


def _spread(n: float) -> list[float]:
    """The light per bin that leaves after one reflection, as a share of the
    light that meets the bead, at index ``n``: each ring's spread evenly over
    the angles between its edges."""
    step = math.radians(PROFILE_STEP_DEG)
    power = [0.0] * PROFILE_BINS
    edges = [exit_angle(n, math.sqrt(k / RINGS)) for k in range(RINGS)] + [exit_angle(n, 1.0)]
    for k in range(RINGS):
        light = ray_share(n, math.sqrt((k + 0.5) / RINGS)) / RINGS
        a, c = edges[k], edges[k + 1]
        if a * c < 0:
            # A ring whose rays cross the way back: the part on each side of it.
            first = abs(a) / (abs(a) + abs(c))
            pieces = [(0.0, abs(a), light * first), (0.0, abs(c), light * (1 - first))]
        else:
            lo, hi = sorted((abs(a), abs(c)))
            pieces = [(lo, hi, light)]
        for lo, hi, p in pieces:
            first_bin = int(lo / step)
            if hi - lo <= 1e-15 * step:
                if first_bin < PROFILE_BINS:
                    power[first_bin] += p
                continue
            for j in range(first_bin, min(int(hi / step), PROFILE_BINS - 1) + 1):
                overlap = min(hi, (j + 1) * step) - max(lo, j * step)
                if overlap > 0:
                    power[j] += p * overlap / (hi - lo)
    return power


def profile(bead: Bead, nm: float) -> list[float]:
    """The light per solid angle, per bin of ``PROFILE_STEP_DEG`` from the
    shadow of one's head, at ``nm``: a share of the light that meets the bead,
    per steradian (a white wall would be ``1/π``)."""
    step = math.radians(PROFILE_STEP_DEG)
    power = _blur(_spread(index_at(bead, nm)))
    return [p / (2 * math.pi * (math.cos(j * step) - math.cos((j + 1) * step))) for j, p in enumerate(power)]


def ring(bead: Bead) -> list[tuple[float, float, float]]:
    """The colour on the screen per bin of the profile: the lamp's light by
    each wavelength's profile, seen relative to the lamp's white, and exposed
    so that the brightest bin of the ring is the screen's brightest."""
    source = lamp(LAMP_K)
    profiles = [profile(bead, nm) for nm in WAVELENGTHS_NM]
    linear = [seen(source, [p[j] for p in profiles]) for j in range(PROFILE_BINS)]
    lo = math.degrees(rainbow_angle(index_at(bead, VIOLET_NM))) - NEAR_DEG
    hi = math.degrees(rainbow_angle(index_at(bead, RED_NM))) + NEAR_DEG
    band = range(max(0, int(lo / PROFILE_STEP_DEG)), min(PROFILE_BINS, int(hi / PROFILE_STEP_DEG) + 1))
    brightest = max(0.2126 * linear[j][0] + 0.7152 * linear[j][1] + 0.0722 * linear[j][2] for j in band)
    return [on_screen([c / brightest for c in rgb]) for rgb in linear]


@dataclass(frozen=True)
class RainbowFigures:
    #: The ring's radius at the sodium line, and its red and violet edges, in degrees.
    angle_deg: float
    red_deg: float
    violet_deg: float
    #: From violet to red, in degrees.
    width_deg: float
    #: How far off the bead's centre the rainbow ray meets it, in its radius.
    impact: float
    #: The share of the light meeting a bead that leaves after one reflection.
    reflected: float
    #: Of that, the share leaving within ``NEAR_DEG`` of the rainbow angle.
    near: float


def figures(bead: Bead) -> RainbowFigures:
    n = index_at(bead, SODIUM_NM)
    angle = math.degrees(rainbow_angle(n))
    red = math.degrees(rainbow_angle(index_at(bead, RED_NM)))
    violet = math.degrees(rainbow_angle(index_at(bead, VIOLET_NM)))
    near = math.radians(angle - NEAR_DEG)
    total = close = 0.0
    for k in range(RINGS):
        b = math.sqrt((k + 0.5) / RINGS)
        light = ray_share(n, b) / RINGS
        total += light
        if exit_angle(n, b) >= near:
            close += light
    return RainbowFigures(
        angle_deg=angle,
        red_deg=red,
        violet_deg=violet,
        width_deg=red - violet,
        impact=rainbow_impact(n),
        reflected=total,
        near=close / total,
    )
