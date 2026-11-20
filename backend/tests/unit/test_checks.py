"""The exhibits' checks: every limiting case within its tolerance, every source
one a reader can open, and a fingerprint that moves with the code and only
with it."""

from __future__ import annotations

import pytest

from staunlabor.domain import checks
from staunlabor.domain.checks import _code

CASES = [(exhibit, case.key) for exhibit in checks.exhibits() for case in checks.cases(exhibit)]


@pytest.fixture(scope="module")
def results() -> dict[tuple[str, str], checks.Result]:
    return {(r.exhibit, r.key): r for exhibit in checks.exhibits() for r in checks.results(exhibit)}


@pytest.mark.parametrize(("exhibit", "key"), CASES)
def test_the_engine_meets_every_limiting_case_within_its_tolerance(
    results: dict[tuple[str, str], checks.Result], exhibit: str, key: str
) -> None:
    result = results[(exhibit, key)]
    assert result.deviation <= result.tolerance, (
        f"{exhibit}.{key}: {result.measured} against {result.expected}, off by {result.deviation:.2e}"
    )


def test_the_exhibits_with_checks_are_these() -> None:
    assert checks.exhibits() == ("chair", "coil", "coriolis", "cradle", "sky", "sphere", "waterwheel", "wave")
    assert [c.key for c in checks.cases("sphere")][:3] == ["small_swing", "hollow_ball", "wide_swing"]


def test_every_case_names_at_least_one_source_a_reader_can_open() -> None:
    for exhibit in checks.exhibits():
        keys = [case.key for case in checks.cases(exhibit)]
        assert len(keys) == len(set(keys)), exhibit
        for case in checks.cases(exhibit):
            assert case.sources, case.key
            for source in case.sources:
                assert source.url.startswith("https://"), source.url
                assert source.cite and source.quote, case.key


def test_a_rolling_ball_swings_at_5_7_of_gravity_not_as_a_sliding_one(
    results: dict[tuple[str, str], checks.Result],
) -> None:
    # Sliding, the default sphere's bob would swing at √(g/ρ)/2π = 1.175 Hz.
    assert results[("sphere", "small_swing")].measured == pytest.approx(0.9928, abs=1e-4)


def test_wheelers_formula_as_printed_lies_0_28_percent_under_the_engines_si_form(
    results: dict[tuple[str, str], checks.Result],
) -> None:
    result = results[("coil", "wheeler")]
    assert result.measured == pytest.approx(118.13, abs=0.01)
    assert result.expected == pytest.approx(117.80, abs=0.01)


def test_the_small_angle_rule_overshoots_the_second_eyes_gap_by_1_7_percent(
    results: dict[tuple[str, str], checks.Result],
) -> None:
    result = results[("chair", "second_eye")]
    assert result.measured == pytest.approx(6.56, abs=0.01)
    assert result.deviation == pytest.approx(0.017, abs=0.001)


def test_any_wheel_with_the_same_tap_and_brake_turns_at_the_same_rate() -> None:
    """The waterwheel's case says so: its equations hold σ, ρ and K, nothing else."""
    from staunlabor.domain.checks import waterwheel
    from staunlabor.domain.experiments import waterwheel as engine

    w = engine.WaterWheel()
    assert waterwheel._wheel_hand_rpm(w, 12.0, radius_m=1.3, brake_nms=0.2) == pytest.approx(
        waterwheel._wheel_hand_rpm(w, 12.0), rel=1e-12
    )


def test_the_wave_at_a_third_of_its_cycle_is_farther_out_than_a_cosine_would_put_it(
    results: dict[tuple[str, str], checks.Result],
) -> None:
    # The case's words: a cosine would give half of 15° there, cos(2π/3)·15° = −7.5°.
    assert -7.6 < results[("wave", "third")].measured < -7.5


def test_unknown_exhibits_have_no_checks() -> None:
    with pytest.raises(ValueError, match="no checks"):
        checks.cases("cannon")
    with pytest.raises(ValueError, match="no checks"):
        checks.fingerprint("cannon")


def test_a_fingerprint_is_the_same_twice_and_differs_between_exhibits() -> None:
    prints = {exhibit: checks.fingerprint(exhibit) for exhibit in checks.exhibits()}
    assert prints == {exhibit: checks.fingerprint(exhibit) for exhibit in checks.exhibits()}
    assert len(set(prints.values())) == len(prints)
    assert all(len(p) == 64 for p in prints.values())


def test_a_reworded_docstring_or_comment_keeps_the_fingerprint_a_changed_number_does_not() -> None:
    source = 'def f(x):\n    """Twice x."""\n    return 2 * x  # doubled\n'
    reworded = 'def f(x):\n    """Two times x, said otherwise."""\n    # a new comment\n    return 2 * x\n'
    changed = 'def f(x):\n    """Twice x."""\n    return 3 * x\n'
    assert _code(source) == _code(reworded)
    assert _code(source) != _code(changed)
