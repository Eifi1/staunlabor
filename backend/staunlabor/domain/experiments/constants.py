"""The numbers several exhibits share and none of them owns: standard gravity,
the moments of inertia of a solid ball and a thin shell, the speed below which
rolling resistance fades in.

This module is meant never to change. An exhibit's check holds for the code of
every engine module it imports (``domain/checks``, the fingerprint), so a
module every rolling or falling exhibit imports must not be the place where
anything is tuned: a change here would uncheck them all at once. Numbers an
exhibit may want to tune (its step, its lamp, its material) stay in its own
module, and the stepping helpers live apart in ``numerics.py``.

What it deliberately does not hold: anything computed, anything one exhibit
alone uses, and the checks' own copy of gravity (``checks/_hand.py``), which
stays apart so a check never takes the engine's word for it.
"""

from __future__ import annotations

#: Standard gravity, m/s² (CGPM 1901, exact by definition).
G = 9.80665

#: I/(m·r²) of a solid ball.
SOLID_BALL_INERTIA = 2 / 5

#: I/(m·r²) of a thin spherical shell (a hollow ball).
HOLLOW_BALL_INERTIA = 2 / 3

#: The speed below which rolling resistance fades in rather than switching
#: sign: a ball at rest has no direction to resist, and a hard switch would
#: chatter. One millimetre a second is far below anything a page draws.
RESISTANCE_FADE_M_S = 1e-3
