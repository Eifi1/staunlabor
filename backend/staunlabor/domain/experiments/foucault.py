"""Foucault's pendulum in Winterthur: the Earth turns under it.

The exhibit is a long pendulum that swings for hours; the plane it swings in
turns slowly against the floor, knocking over a ring of pins one after
another. Nothing turns the pendulum: the floor turns under it, because the
Earth does.

**The model.** Seen on the turning Earth, the bob — swinging little, so the
plane problem is linear — feels gravity's pull back, ``−ω₀²·(x, y)`` with
``ω₀ = √(g/L)``, and the Coriolis force of the Earth's turn about the local
vertical, ``Ω_z = Ω·sin φ`` at the latitude ``φ``:

    x'' = −ω₀²·x + 2·Ω_z·y',   y'' = −ω₀²·y − 2·Ω_z·x'.

With ``ζ = x + i·y`` that is ``ζ'' + 2iΩ_z·ζ' + ω₀²·ζ = 0``, and a bob let go
from rest at ``ζ = A`` moves exactly as

    ζ(t) = A·e^(−iΩ_z t)·(cos ω′t + i·(Ω_z/ω′)·sin ω′t),   ω′ = √(ω₀² + Ω_z²):

a swing whose plane turns at ``−Ω_z``, clockwise in the north. Closed, so the
page can show any hour without stepping to it; the tests hold it to a stepped
solution. ``Ω`` is the Earth's turn against the stars, once a sidereal day.

**What it shows.** In Winterthur (47.5° north) the plane turns by 11.1° an
hour, once round in 32.5 hours; at the pole once a sidereal day, at the
equator not at all; in the south the other way.

**What it leaves out.** Air, which in a real hall stops the swing within hours
unless it is kept going; the slight ellipse a careless release starts; the
small extra turn of a wide swing (Airy's precession).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from staunlabor.domain.experiments.constants import G

#: The Earth's turn against the stars, rad/s: once in a sidereal day.
EARTH_RATE = 7.2921150e-5

#: Winterthur's latitude, degrees north.
WINTERTHUR_DEG = 47.5


@dataclass(frozen=True)
class FoucaultPendulum:
    length_m: float = 12.0
    #: How far the bob is let go from the middle.
    amplitude_m: float = 0.5
    latitude_deg: float = WINTERTHUR_DEG

    def __post_init__(self) -> None:
        if not 1 <= self.length_m <= 100:
            raise ValueError("the pendulum is between 1 and 100 m long")
        if not 0 < self.amplitude_m <= 0.1 * self.length_m:
            raise ValueError("the swing is small: at most a tenth of the length")
        if not -90 <= self.latitude_deg <= 90:
            raise ValueError("a latitude lies between −90° and 90°")


def vertical_rate(p: FoucaultPendulum) -> float:
    """``Ω_z = Ω·sin φ``: how fast the floor turns under the pendulum, rad/s,
    anticlockwise seen from above."""
    return EARTH_RATE * math.sin(math.radians(p.latitude_deg))


def degrees_per_hour(p: FoucaultPendulum) -> float:
    """How far the swing's plane turns against the floor in an hour, clockwise
    positive (as it does in the north)."""
    return math.degrees(vertical_rate(p)) * 3600


def full_turn_h(p: FoucaultPendulum) -> float | None:
    """Hours for the plane to turn once round; ``None`` at the equator."""
    rate = abs(vertical_rate(p))
    return 2 * math.pi / rate / 3600 if rate > 1e-15 else None


def period_s(p: FoucaultPendulum) -> float:
    """One swing there and back."""
    return 2 * math.pi / math.sqrt(G / p.length_m)


def position(p: FoucaultPendulum, t: float) -> tuple[float, float]:
    """The bob's place above the floor ``t`` seconds after it was let go from
    rest at ``(A, 0)``, exactly (the linear swing)."""
    w0 = math.sqrt(G / p.length_m)
    wz = vertical_rate(p)
    wp = math.sqrt(w0 * w0 + wz * wz)
    re = math.cos(wp * t)
    im = (wz / wp) * math.sin(wp * t)
    c, s = math.cos(wz * t), math.sin(wz * t)
    # A·e^(−iΩt)·(re + i·im)
    return p.amplitude_m * (re * c + im * s), p.amplitude_m * (im * c - re * s)


def plane_deg(p: FoucaultPendulum, t: float) -> float:
    """The swing's plane against the floor after ``t``, degrees, anticlockwise
    from where it was let go: ``−Ω_z·t``."""
    return -math.degrees(vertical_rate(p) * t)


@dataclass(frozen=True)
class LatitudePoint:
    latitude_deg: float
    degrees_per_hour: float


def latitude_curve(p: FoucaultPendulum) -> tuple[LatitudePoint, ...]:
    """The turn an hour from the south pole to the north, every 5°."""
    return tuple(
        LatitudePoint(float(lat), degrees_per_hour(FoucaultPendulum(p.length_m, p.amplitude_m, float(lat))))
        for lat in range(-90, 91, 5)
    )
