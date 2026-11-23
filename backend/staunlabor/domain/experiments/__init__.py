"""Hands-on experiments, computed: the engine behind every exhibit's page.

Exhibits a visitor plays with — inspired by exhibits at the Swiss Science
Center Technorama in Winterthur — each modelled so that a page can let the
reader play the visitor and then show the computation behind what they felt.
Pure functions over floats and frozen dataclasses, the standard library only;
every number a page states is asserted in
``tests/unit/test_experiments.py``, and each model was checked independently
with SciPy before it was written (``docs/experiments.md``).

* :mod:`sphere` — a ball in a hanging sphere, pumped round the equator: a
  spherical pendulum under 5/7 of gravity, and a resonance that moves as the
  ball climbs.
* :mod:`coil` — a magnet car through a coil between two ramps: one curve,
  ``dΨ/dx``, is both the voltage it induces and the force it feels.
* :mod:`perspective` — a chair, a skewed chair and scattered rods that are one
  picture through a peephole: lines of sight, and the depth one eye cannot see.
* :mod:`platform` — a spinning platform a visitor stands on: ``L = I·ω`` kept,
  so pulling in spins faster — and the arms pay for the energy that gains.
* :mod:`race` — balls let go together on six tracks: the cycloid is the
  fastest (the brachistochrone) and, as a valley, the tautochrone.
* :mod:`pit` — the bowl the race's balls fly into past the finish, where they
  bounce, roll and knock into each other until all of them lie still.
* :mod:`elephant` — a light ball floating on a jet of air: held up where the
  widening jet's push equals its weight, and held in by the faster air on the
  side nearer the axis (Bernoulli), up to a tilt it can no longer hold.
* :mod:`smoke` — a press on a drum's skin and the ring of smoke it makes:
  the slug model's circulation, and a window between too turbulent and too
  slow for the room.
* :mod:`cannon` — balls stacked and dropped: Hertz contacts hand momentum up
  the stack in a few milliseconds, and the small ball on top leaves several
  times as fast as the stack arrived.
* :mod:`pendulum` — the block the swinging exhibits stand on: a plane
  pendulum exactly (Jacobi's elliptic functions) and stepped (Runge–Kutta),
  each the other's check.
* :mod:`coriolis` — the Coriolis carousel: a thrown puck goes straight and a
  rolled ball in a circle, seen from outside; both curve away for the riders.
* :mod:`cradle` — Newton's cradle with Hertz contacts: one in, one out, clean
  with a hair's gap between the balls and nearly so when they touch.
* :mod:`arch` — a stone arch stands while a thrust line fits in its stones;
  the hanging chain, upside down, is the shape where it fits best.
* :mod:`chladni` — the free square plate's modes by Ritz and Legendre: where
  a plate shaken at its middle stands still, the sand lies.
* :mod:`circuit` — the slow LC circuit: a capacitor discharged through a big
  coil swings like a damped spring, its current with the coil's inertia.
* :mod:`vessel` — the draining vessel: a tube of water empties through holes
  in its side ever more slowly, Torricelli's ``√(2gh)``, and its jets shorten.
* :mod:`plates` — metal plates fall slowly between magnets they are not
  drawn to: eddy currents brake them, and slots cut most of the brake away.
* :mod:`bounce` — a ball bouncing on a plate: infinitely many bounces, ever
  lower and quicker, add up to a finite time.
* :mod:`overhang` — identical blocks stacked over an edge reach beyond it as
  far as one likes: half the harmonic series, slowly.
* :mod:`galton` — the Galton board: balls turned left or right at every pin
  pile up into a bell, the binomial distribution, from a seeded generator.
* :mod:`film` — the soap film between two rings: drawn apart, its waist
  narrows, and past ``h/R ≈ 1.3255`` no catenoid fits and it snaps into discs.
* :mod:`diver` — a Cartesian diver: squeezed, its bubble shrinks and it sinks;
  it hovers at one depth only, and there unstably.
* :mod:`ship` — the ship that rights itself: tilted, its centre of buoyancy
  moves to the low side, and it comes back while the metacentre is above its
  centre of gravity, ``GM = KB + BM − KG``.
* :mod:`colour` — a spectrum as the eye sees it and a screen shows it: the
  light exhibits' one step from wavelengths to red, green and blue.
* :mod:`rainbow` — glass beads make a rainbow round the shadow of one's head,
  half the size of the sky's: the angle one reflection inside turns light by.
* :mod:`sky` — white light through a cloudy tube is blue from the side and
  orange at the end: Rayleigh's ``1/λ⁴``, the blue sky and the red sunset, and
  the ozone that keeps the sky overhead blue at sunset.
* :mod:`slits` — the double slit: two slits make stripes, and where they make
  it dark, one slit alone would light the wall.
* :mod:`polarizer` — the third polarising filter: two crossed filters are dark,
  and a third slanted between them lets an eighth of the lamp's light through.
* :mod:`jet` — the light in the water jet: a laser's light stays inside a jet
  of water round its bend, reflected wholly beyond the critical angle.
* :mod:`beats` — two tuning forks a little apart swell and fade together:
  ``|f₁ − f₂|`` beats a second, and a rider on a prong sets them.
* :mod:`string` — the standing string: a cord on a vibrator stands still in
  one, two, three loops at ``fₙ = n/(2L)·√(T/μ)``, and only there.
* :mod:`levitation` — a spinning top hovers over a ring magnet only in a
  window a few millimetres high and three per cent wide in weight.
* :mod:`gyroscope` — a spinning wheel on a string turns round it instead of
  falling; the suitcase that tips when turned.
* :mod:`resonance` — six rods on a trembling table: only the one in step
  swings, and it takes its time.
* :mod:`well` — the gravity well: a ball rolling round a funnel ``z = −k/r``
  keeps Kepler's third law on every circle and spirals into the hole.
* :mod:`foucault` — Foucault's pendulum in Winterthur: its plane turns 11.1°
  an hour against the floor, the Earth's turn about the local vertical.
* :mod:`harmonograph` — a pen on one pendulum and a board on another: the
  picture two damped swings draw, closed at a simple ratio, turning near one.
* :mod:`cone` — a double cone on rails that spread and rise: it rolls up them
  because its centre falls, and the exact contact says by how much.
* :mod:`parabola` — water in a spinning vessel: a paraboloid whose middle
  sinks as far as its rim rises, dry in the middle past a rate, a mirror whose
  focus the rate sets, and water that follows the vessel over Ekman's time.
* :mod:`coupled` — two pendulums and a spring: two modes, and a swing that
  wanders from one to the other at their beat, all of it only when they match.
* :mod:`peg` — Galileo's pendulum caught by a peg: the bob rises to the height
  it fell from, or swings over the peg, or its string goes slack.
* :mod:`maxwell` — Maxwell's wheel: a slow fall because nearly all its energy
  goes into its spin, a jerk at the bottom the strings' stretch sets, a climb
  nearly back.
* :mod:`metronomes` — metronomes on a board on two cans tick in step within a
  minute, pushed together by the board they push; on a held board, never.
* :mod:`chaos` — the double pendulum: two that start a thousandth of a degree
  apart part company, and the Lyapunov exponent measured Benettin's way.
* :mod:`kapitza` — Kapitza's pendulum: shaken fast enough, a rod stands upside
  down; Floquet's multipliers say from which drive on, Kapitza's bound nearly.
* :mod:`waterwheel` — Malkus's leaking waterwheel, which is Lorenz's equations:
  still, steady, or turning back and forth without ever repeating.
* :mod:`wave` — a row of pendulums tuned to swing ``N``, ``N + 1``, … times a
  cycle: waves, groups, and all together again — at the swing it was tuned for.

What it is not: a physics engine for games. Each model is the exhibit's, with
the assumptions its module states.
"""

from staunlabor.domain.experiments.arch import Arch as StoneArch
from staunlabor.domain.experiments.arch import Load as ArchLoad
from staunlabor.domain.experiments.arch import Shape as ArchShape
from staunlabor.domain.experiments.arch import thrust as arch_thrust
from staunlabor.domain.experiments.beats import MODE_ROOT, Fork, Rider
from staunlabor.domain.experiments.beats import figures as beats_figures
from staunlabor.domain.experiments.beats import frequency_hz as fork_frequency_hz
from staunlabor.domain.experiments.beats import loudness as beats_loudness
from staunlabor.domain.experiments.beats import mode_shape as prong_mode_shape
from staunlabor.domain.experiments.beats import sound as beats_sound
from staunlabor.domain.experiments.bounce import EXHIBIT_HEIGHT_M, STEEL, TABLE_TENNIS, BouncingBall
from staunlabor.domain.experiments.bounce import bounces as ball_bounces
from staunlabor.domain.experiments.bounce import figures as bounce_figures
from staunlabor.domain.experiments.bounce import state as ball_state
from staunlabor.domain.experiments.cannon import Ball, BallStack
from staunlabor.domain.experiments.cannon import drop as cannon_drop
from staunlabor.domain.experiments.cannon import figures as cannon_figures
from staunlabor.domain.experiments.cannon import launch as cannon_launch
from staunlabor.domain.experiments.chaos import DoublePendulum, lyapunov
from staunlabor.domain.experiments.chaos import mode_rates as double_mode_rates
from staunlabor.domain.experiments.chaos import run as run_chaos
from staunlabor.domain.experiments.chladni import Plate as ChladniPlate
from staunlabor.domain.experiments.chladni import driven_modes as chladni_driven_modes
from staunlabor.domain.experiments.circuit import Circuit
from staunlabor.domain.experiments.circuit import energies as circuit_energies
from staunlabor.domain.experiments.circuit import figures as circuit_figures
from staunlabor.domain.experiments.circuit import state as circuit_state
from staunlabor.domain.experiments.coil import (
    METER_RANGE_A,
    Coil,
    CoilExhibit,
    Idle,
    Magnet,
    PressRule,
    Scripted,
    Track,
    coupling,
    figures,
    flux_linkage,
    timing_curve,
)
from staunlabor.domain.experiments.coil import analysis as coil_analysis
from staunlabor.domain.experiments.coil import run as run_coil
from staunlabor.domain.experiments.colour import WAVELENGTHS_NM
from staunlabor.domain.experiments.colour import lamp as colour_lamp
from staunlabor.domain.experiments.colour import matching as colour_matching
from staunlabor.domain.experiments.colour import on_screen as colour_on_screen
from staunlabor.domain.experiments.colour import seen as colour_seen
from staunlabor.domain.experiments.colour import tristimulus as colour_tristimulus
from staunlabor.domain.experiments.cone import (
    ConeExhibit,
    DoubleCone,
    Rails,
    axis_height_m,
    axis_slope,
    contact_factor,
    contact_radius_m,
    rail_height_m,
    roll,
    start_for,
    threshold_deg,
)
from staunlabor.domain.experiments.coriolis import Body as ThrownBody
from staunlabor.domain.experiments.coriolis import Carousel, Throw, lead_deg, miss_deg, outside, turning
from staunlabor.domain.experiments.coupled import (
    Bob,
    CoupledPendulums,
    Start,
    beat_s,
    couplings,
    exchange_share,
    mode_rates,
)
from staunlabor.domain.experiments.coupled import swing as coupled_swing
from staunlabor.domain.experiments.cradle import Cradle, Pull
from staunlabor.domain.experiments.cradle import impact as cradle_impact
from staunlabor.domain.experiments.cradle import run as run_cradle
from staunlabor.domain.experiments.diver import Bottle, Diver
from staunlabor.domain.experiments.diver import bubble_m3 as diver_bubble_m3
from staunlabor.domain.experiments.diver import figures as diver_figures
from staunlabor.domain.experiments.diver import hover_depth_m as diver_hover_depth_m
from staunlabor.domain.experiments.diver import lift_n as diver_lift_n
from staunlabor.domain.experiments.diver import run as diver_run
from staunlabor.domain.experiments.diver import step as diver_step
from staunlabor.domain.experiments.elephant import Elephant, ElephantRun, FloatingBall, Jet
from staunlabor.domain.experiments.elephant import Move as ElephantMove
from staunlabor.domain.experiments.elephant import figures as elephant_figures
from staunlabor.domain.experiments.elephant import run as run_elephant
from staunlabor.domain.experiments.film import Rings as FilmRings
from staunlabor.domain.experiments.foucault import (
    FoucaultPendulum,
    degrees_per_hour,
    full_turn_h,
    latitude_curve,
    plane_deg,
    vertical_rate,
)
from staunlabor.domain.experiments.foucault import period_s as foucault_period_s
from staunlabor.domain.experiments.foucault import position as foucault_position
from staunlabor.domain.experiments.galton import EXHIBIT_BALLS as GALTON_BALLS
from staunlabor.domain.experiments.galton import EXHIBIT_ROWS as GALTON_ROWS
from staunlabor.domain.experiments.galton import EXHIBIT_SEED as GALTON_SEED
from staunlabor.domain.experiments.galton import LEVEL as GALTON_LEVEL
from staunlabor.domain.experiments.gyroscope import Release as GyroRelease
from staunlabor.domain.experiments.gyroscope import Wheel as GyroWheel
from staunlabor.domain.experiments.gyroscope import nutation_rad_s as gyro_nutation
from staunlabor.domain.experiments.gyroscope import precession_rad_s as gyro_precession
from staunlabor.domain.experiments.gyroscope import run as run_gyroscope
from staunlabor.domain.experiments.gyroscope import suitcase_torque_n_m as gyro_suitcase_torque
from staunlabor.domain.experiments.harmonograph import Harmonograph, HarmonographPendulum, nearest_ratio
from staunlabor.domain.experiments.harmonograph import draw as harmonograph_draw
from staunlabor.domain.experiments.harmonograph import figures as harmonograph_figures
from staunlabor.domain.experiments.levitation import Base as LevitationBase
from staunlabor.domain.experiments.levitation import Top as LevitationTop
from staunlabor.domain.experiments.levitation import hover as levitation_hover
from staunlabor.domain.experiments.maxwell import (
    MaxwellWheel,
    Shape,
    bounces,
    fall_acceleration,
    inertia_ratio,
    rotation_share,
    state_at,
)
from staunlabor.domain.experiments.maxwell import bounce as wheel_bounce
from staunlabor.domain.experiments.metronomes import Metronomes
from staunlabor.domain.experiments.metronomes import Start as MetronomeStart
from staunlabor.domain.experiments.metronomes import run as run_metronomes
from staunlabor.domain.experiments.overhang import BLOCK_HEIGHT_M, BLOCK_LENGTH_M, EXHIBIT_BLOCKS
from staunlabor.domain.experiments.overhang import blocks_for as blocks_for_reach
from staunlabor.domain.experiments.overhang import even as even_stack
from staunlabor.domain.experiments.overhang import harmonic as harmonic_stack
from staunlabor.domain.experiments.overhang import holds as stack_holds
from staunlabor.domain.experiments.overhang import layers as stack_layers
from staunlabor.domain.experiments.overhang import overhang as stack_overhang
from staunlabor.domain.experiments.parabola import Vessel, dry_rate, height_at, spill_rate, spin_up_time_s, surface
from staunlabor.domain.experiments.parabola import spin as water_spin
from staunlabor.domain.experiments.peg import (
    Mode,
    PegPendulum,
    PegState,
    outcome,
    position,
    slack_height_m,
    start_height_m,
)
from staunlabor.domain.experiments.peg import run as run_peg
from staunlabor.domain.experiments.peg import step as peg_step
from staunlabor.domain.experiments.pendulum import (
    angle_deg,
    ellipk,
    jacobi,
    length_for,
    period_factor,
    period_s,
    small_period_s,
    swing,
)
from staunlabor.domain.experiments.perspective import (
    ACUITY_RAD,
    EYE,
    FigureKind,
    binocular_gap,
    exhibit,
    image,
    joints,
    slide,
    tolerance,
    widest_gap,
)
from staunlabor.domain.experiments.perspective import analysis as chair_analysis
from staunlabor.domain.experiments.plates import EXHIBIT_PLATES, MagnetColumn, Plate
from staunlabor.domain.experiments.plates import figures as plate_figures
from staunlabor.domain.experiments.plates import motion as plate_motion
from staunlabor.domain.experiments.platform import Body, Move, Platform, Posture, inertia, spin
from staunlabor.domain.experiments.platform import figures as platform_figures
from staunlabor.domain.experiments.platform import run as run_platform
from staunlabor.domain.experiments.race import CurveKind, Race, RaceBall, cycloid_through
from staunlabor.domain.experiments.race import entries as race_entries
from staunlabor.domain.experiments.race import race as run_race
from staunlabor.domain.experiments.race import settle as settle_race
from staunlabor.domain.experiments.race import valley as race_valley
from staunlabor.domain.experiments.rainbow import GLASS as GLASS_BEAD
from staunlabor.domain.experiments.rainbow import WATER as WATER_DROP
from staunlabor.domain.experiments.rainbow import Bead, rainbow_angle, rainbow_impact
from staunlabor.domain.experiments.rainbow import exit_angle as rainbow_exit_angle
from staunlabor.domain.experiments.rainbow import figures as rainbow_figures
from staunlabor.domain.experiments.rainbow import index_at as rainbow_index_at
from staunlabor.domain.experiments.rainbow import profile as rainbow_profile
from staunlabor.domain.experiments.rainbow import ray_share as rainbow_ray_share
from staunlabor.domain.experiments.rainbow import ring as rainbow_ring
from staunlabor.domain.experiments.rainbow import trace as rainbow_trace
from staunlabor.domain.experiments.resonance import Rack as ResonanceRack
from staunlabor.domain.experiments.resonance import natural_hz as rod_hz
from staunlabor.domain.experiments.resonance import run as run_resonance
from staunlabor.domain.experiments.resonance import steady_m as rod_steady_m
from staunlabor.domain.experiments.sky import Tube as SkyTube
from staunlabor.domain.experiments.sky import air_mass as sky_air_mass
from staunlabor.domain.experiments.sky import brightness as sky_brightness
from staunlabor.domain.experiments.sky import end_light as sky_end_light
from staunlabor.domain.experiments.sky import figures as sky_figures
from staunlabor.domain.experiments.sky import hue as sky_hue
from staunlabor.domain.experiments.sky import ozone_air_mass as sky_ozone_air_mass
from staunlabor.domain.experiments.sky import ozone_depth as sky_ozone_depth
from staunlabor.domain.experiments.sky import ozone_light as sky_ozone_light
from staunlabor.domain.experiments.sky import scattered_down as sky_scattered_down
from staunlabor.domain.experiments.sky import scattering as sky_scattering
from staunlabor.domain.experiments.sky import side_at as sky_side_at
from staunlabor.domain.experiments.sky import side_light as sky_side_light
from staunlabor.domain.experiments.sky import sky_light as sky_overhead_light
from staunlabor.domain.experiments.sky import sun_light as sky_sun_light
from staunlabor.domain.experiments.slits import LASER_NM, Slits, laser_colour, laser_pattern, white_pattern
from staunlabor.domain.experiments.slits import bright_m as slits_bright_m
from staunlabor.domain.experiments.slits import dark_m as slits_dark_m
from staunlabor.domain.experiments.slits import figures as slits_figures
from staunlabor.domain.experiments.slits import intensity as slits_intensity
from staunlabor.domain.experiments.smoke import Drum, Push, Room, SmokeExhibit, Verdict, ring_from_push
from staunlabor.domain.experiments.smoke import figures as smoke_figures
from staunlabor.domain.experiments.smoke import flight as smoke_flight
from staunlabor.domain.experiments.sphere import BallKind, Drive, Sphere, lowest_orbit_hz, orbit, orbit_at, swing_hz
from staunlabor.domain.experiments.sphere import figures as sphere_figures
from staunlabor.domain.experiments.sphere import run as run_sphere
from staunlabor.domain.experiments.string import Cord as StringCord
from staunlabor.domain.experiments.string import figures as string_figures
from staunlabor.domain.experiments.string import half_waves as string_half_waves
from staunlabor.domain.experiments.string import strobe_m as string_strobe_m
from staunlabor.domain.experiments.vessel import DrainingVessel
from staunlabor.domain.experiments.waterwheel import WaterWheel, WheelTurns, cup_level, hopf_rho, regime, steady_x
from staunlabor.domain.experiments.waterwheel import behaviour as waterwheel_behaviour
from staunlabor.domain.experiments.waterwheel import run as run_waterwheel
from staunlabor.domain.experiments.wave import PendulumWave, groups_at, lag_deg, lengths_m
from staunlabor.domain.experiments.wave import figures as wave_figures
from staunlabor.domain.experiments.well import Funnel
from staunlabor.domain.experiments.well import Launch as WellLaunch
from staunlabor.domain.experiments.well import circular_period_s as well_circular_period
from staunlabor.domain.experiments.well import circular_speed_m_s as well_circular_speed
from staunlabor.domain.experiments.well import energy_per_kg as well_energy
from staunlabor.domain.experiments.well import run as run_well

__all__ = [
    "ACUITY_RAD",
    "BLOCK_HEIGHT_M",
    "BLOCK_LENGTH_M",
    "EXHIBIT_BLOCKS",
    "EXHIBIT_HEIGHT_M",
    "EXHIBIT_PLATES",
    "EYE",
    "GALTON_BALLS",
    "GALTON_LEVEL",
    "GALTON_ROWS",
    "GALTON_SEED",
    "GLASS_BEAD",
    "LASER_NM",
    "METER_RANGE_A",
    "MODE_ROOT",
    "STEEL",
    "TABLE_TENNIS",
    "WATER_DROP",
    "WAVELENGTHS_NM",
    "ArchLoad",
    "ArchShape",
    "Ball",
    "BallKind",
    "BallStack",
    "Bead",
    "Bob",
    "Body",
    "Bottle",
    "BouncingBall",
    "Carousel",
    "ChladniPlate",
    "Circuit",
    "Coil",
    "CoilExhibit",
    "ConeExhibit",
    "CoupledPendulums",
    "Cradle",
    "CurveKind",
    "Diver",
    "DoubleCone",
    "DoublePendulum",
    "DrainingVessel",
    "Drive",
    "Drum",
    "Elephant",
    "ElephantMove",
    "ElephantRun",
    "FigureKind",
    "FilmRings",
    "FloatingBall",
    "Fork",
    "FoucaultPendulum",
    "Funnel",
    "GyroRelease",
    "GyroWheel",
    "Harmonograph",
    "HarmonographPendulum",
    "Idle",
    "Jet",
    "LevitationBase",
    "LevitationTop",
    "Magnet",
    "MagnetColumn",
    "MaxwellWheel",
    "MetronomeStart",
    "Metronomes",
    "Mode",
    "Move",
    "PegPendulum",
    "PegState",
    "PendulumWave",
    "Plate",
    "Platform",
    "Posture",
    "PressRule",
    "Pull",
    "Push",
    "Race",
    "RaceBall",
    "Rails",
    "ResonanceRack",
    "Rider",
    "Room",
    "Scripted",
    "Shape",
    "SkyTube",
    "Slits",
    "SmokeExhibit",
    "Sphere",
    "Start",
    "StoneArch",
    "StringCord",
    "Throw",
    "ThrownBody",
    "Track",
    "Verdict",
    "Vessel",
    "WaterWheel",
    "WellLaunch",
    "WheelTurns",
    "angle_deg",
    "arch_thrust",
    "axis_height_m",
    "axis_slope",
    "ball_bounces",
    "ball_state",
    "beat_s",
    "beats_figures",
    "beats_loudness",
    "beats_sound",
    "binocular_gap",
    "blocks_for_reach",
    "bounce_figures",
    "bounces",
    "cannon_drop",
    "cannon_figures",
    "cannon_launch",
    "chair_analysis",
    "chladni_driven_modes",
    "circuit_energies",
    "circuit_figures",
    "circuit_state",
    "coil_analysis",
    "colour_lamp",
    "colour_matching",
    "colour_on_screen",
    "colour_seen",
    "colour_tristimulus",
    "contact_factor",
    "contact_radius_m",
    "coupled_swing",
    "coupling",
    "couplings",
    "cradle_impact",
    "cup_level",
    "cycloid_through",
    "degrees_per_hour",
    "diver_bubble_m3",
    "diver_figures",
    "diver_hover_depth_m",
    "diver_lift_n",
    "diver_run",
    "diver_step",
    "double_mode_rates",
    "dry_rate",
    "elephant_figures",
    "ellipk",
    "even_stack",
    "exchange_share",
    "exhibit",
    "fall_acceleration",
    "figures",
    "flux_linkage",
    "fork_frequency_hz",
    "foucault_period_s",
    "foucault_position",
    "full_turn_h",
    "groups_at",
    "gyro_nutation",
    "gyro_precession",
    "gyro_suitcase_torque",
    "harmonic_stack",
    "harmonograph_draw",
    "harmonograph_figures",
    "height_at",
    "hopf_rho",
    "image",
    "inertia",
    "inertia_ratio",
    "jacobi",
    "joints",
    "lag_deg",
    "laser_colour",
    "laser_pattern",
    "latitude_curve",
    "lead_deg",
    "length_for",
    "lengths_m",
    "levitation_hover",
    "lowest_orbit_hz",
    "lyapunov",
    "miss_deg",
    "mode_rates",
    "nearest_ratio",
    "orbit",
    "orbit_at",
    "outcome",
    "outside",
    "peg_step",
    "period_factor",
    "period_s",
    "plane_deg",
    "plate_figures",
    "plate_motion",
    "platform_figures",
    "position",
    "prong_mode_shape",
    "race_entries",
    "race_valley",
    "rail_height_m",
    "rainbow_angle",
    "rainbow_exit_angle",
    "rainbow_figures",
    "rainbow_impact",
    "rainbow_index_at",
    "rainbow_profile",
    "rainbow_ray_share",
    "rainbow_ring",
    "rainbow_trace",
    "regime",
    "ring_from_push",
    "rod_hz",
    "rod_steady_m",
    "roll",
    "rotation_share",
    "run_chaos",
    "run_coil",
    "run_cradle",
    "run_elephant",
    "run_gyroscope",
    "run_metronomes",
    "run_peg",
    "run_platform",
    "run_race",
    "run_resonance",
    "run_sphere",
    "run_waterwheel",
    "run_well",
    "settle_race",
    "sky_air_mass",
    "sky_brightness",
    "sky_end_light",
    "sky_figures",
    "sky_hue",
    "sky_overhead_light",
    "sky_ozone_air_mass",
    "sky_ozone_depth",
    "sky_ozone_light",
    "sky_scattered_down",
    "sky_scattering",
    "sky_side_at",
    "sky_side_light",
    "sky_sun_light",
    "slack_height_m",
    "slide",
    "slits_bright_m",
    "slits_dark_m",
    "slits_figures",
    "slits_intensity",
    "small_period_s",
    "smoke_figures",
    "smoke_flight",
    "sphere_figures",
    "spill_rate",
    "spin",
    "spin_up_time_s",
    "stack_holds",
    "stack_layers",
    "stack_overhang",
    "start_for",
    "start_height_m",
    "state_at",
    "steady_x",
    "string_figures",
    "string_half_waves",
    "string_strobe_m",
    "surface",
    "swing",
    "swing_hz",
    "threshold_deg",
    "timing_curve",
    "tolerance",
    "turning",
    "vertical_rate",
    "water_spin",
    "waterwheel_behaviour",
    "wave_figures",
    "well_circular_period",
    "well_circular_speed",
    "well_energy",
    "wheel_bounce",
    "white_pattern",
    "widest_gap",
]
