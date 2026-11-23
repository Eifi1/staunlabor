"""The Galton board's engine against the binomial distribution, and every
figure its page states.

The second computation is written here: the shares by factorials in exact
fractions, the paths by ``math.comb``, the generator against Mulberry32's
published first draw, a run's heap by counting its turns.
"""

from __future__ import annotations

import math
from fractions import Fraction

import pytest

from staunlabor.domain import checks
from staunlabor.domain.experiments import galton

pytestmark = pytest.mark.unit


def _binomial(n: int, k: int, p: Fraction) -> Fraction:
    return math.comb(n, k) * p**k * (1 - p) ** (n - k)


def test_the_shares_are_the_binomial_distribution_for_every_board_the_page_builds():
    for n in range(1, galton.MOST_ROWS + 1):
        for p in (Fraction(1, 2), Fraction(7, 10), Fraction(1, 8), Fraction(0), Fraction(1)):
            shares = galton.shares(n, float(p))
            assert len(shares) == n + 1
            for k, share in enumerate(shares):
                assert share == pytest.approx(float(_binomial(n, k, p)), rel=1e-12, abs=1e-300)
            assert sum(shares) == pytest.approx(1, rel=1e-12)


def test_the_paths_are_pascals_triangle_and_add_up_to_two_to_the_rows():
    for n in range(1, galton.MOST_ROWS + 1):
        assert galton.paths(n) == tuple(math.comb(n, k) for k in range(n + 1))
        assert sum(galton.paths(n)) == 2**n == galton.figures(n, 0.5).paths


def test_the_middle_and_spread_are_n_p_and_n_p_one_minus_p():
    for n, p in ((12, 0.5), (12, 0.7), (24, 0.13), (5, 0.999), (1, 0.5)):
        s = galton.shares(n, p)
        mean = sum(k * share for k, share in enumerate(s))
        f = galton.figures(n, p)
        assert mean == pytest.approx(n * p, rel=1e-12) == pytest.approx(f.mean, rel=1e-12)
        assert sum((k - mean) ** 2 * share for k, share in enumerate(s)) == pytest.approx(f.variance, rel=1e-9)
        assert f.spread == pytest.approx(math.sqrt(n * p * (1 - p)), rel=1e-12)


def test_the_likeliest_bin_is_the_middle_on_a_level_board_and_moves_with_the_tilt():
    assert galton.figures(12, 0.5).peak_bin == 6
    # The mode of B(n, p) is ⌊(n + 1)·p⌋ where that is no whole number.
    assert galton.figures(12, 0.7).peak_bin == math.floor(13 * 0.7) == 9
    # Two bins equally likely: the left one.
    assert galton.figures(1, 0.5).peak_bin == 0


def test_the_normal_curve_is_a_density_of_the_boards_middle_and_spread():
    n, p = 24, 0.5
    total = sum(galton.normal(n, p, k / 100) * 0.01 for k in range(-1000, 3400))
    assert total == pytest.approx(1, rel=1e-9)
    assert galton.normal(n, p, 12) == pytest.approx(1 / math.sqrt(math.pi * 12), rel=1e-12)


def test_the_generator_is_mulberry32():
    # mulberry32(1)'s first draw, as every JavaScript copy of it gives it.
    assert galton.uniforms(1, 1)[0] == 0.6270739405881613
    draws = galton.uniforms(galton.EXHIBIT_SEED, 10000)
    assert all(0 <= u < 1 for u in draws)
    assert sum(draws) / len(draws) == pytest.approx(0.5, abs=0.01)
    assert galton.uniforms(galton.EXHIBIT_SEED, 10) == draws[:10], "the same seed, the same draws"
    assert galton.uniforms(galton.EXHIBIT_SEED + 1, 10) != draws[:10]


def test_a_run_is_its_balls_turns_counted_and_the_same_every_time():
    run = galton.drop(12, 0.5, 500, galton.EXHIBIT_SEED)
    assert run == galton.drop(12, 0.5, 500, galton.EXHIBIT_SEED)
    paths = galton.turns(12, 0.5, 500, galton.EXHIBIT_SEED)
    assert run.bins == tuple(sum(t) for t in paths)
    assert run.counts == tuple(run.bins.count(k) for k in range(13))
    assert sum(run.counts) == 500
    u = galton.uniforms(galton.EXHIBIT_SEED, 24)
    assert paths[1] == tuple(x < 0.5 for x in u[12:24]), "ball i draws i·n to i·n + n − 1"
    assert run.mean == pytest.approx(sum(run.bins) / 500)
    assert all(galton.drop(6, 0.0, 20, 3).bins[i] == 0 for i in range(20))
    assert all(galton.drop(6, 1.0, 20, 3).bins[i] == 6 for i in range(20))


def test_a_long_run_piles_up_the_binomial_heap():
    run = galton.drop(12, 0.5, galton.MOST_BALLS, galton.EXHIBIT_SEED + 1)
    expected = galton.shares(12, 0.5)
    # Each bin within four standard deviations of its count, √(N·P·(1 − P)).
    for count, share in zip(run.counts, expected, strict=True):
        n_p = galton.MOST_BALLS * share
        assert abs(count - n_p) <= 4 * math.sqrt(n_p * (1 - share))


# ── the page's figures ───────────────────────────────────────────────────────


def test_the_exhibit_is_twelve_rows_thirteen_bins_and_500_balls():
    assert (galton.EXHIBIT_ROWS, galton.LEVEL, galton.EXHIBIT_BALLS) == (12, 0.5, 500)
    assert len(galton.shares(galton.EXHIBIT_ROWS, galton.LEVEL)) == 13


def test_twelve_rows_have_4096_paths_924_to_the_middle_one_to_each_edge():
    p = galton.paths(12)
    assert (sum(p), p[6], p[0], p[12]) == (4096, 924, 1, 1)
    s = galton.shares(12, 0.5)
    assert round(s[6] * 100, 1) == 22.6
    assert s[0] == 1 / 4096
    # "fast ein Viertel": under a quarter, over a fifth.
    assert 0.2 < s[6] < 0.25


def test_the_three_middle_bins_take_61_percent_the_three_at_each_edge_together_3_9():
    s = galton.shares(12, 0.5)
    assert round(sum(s[5:8]) * 100) == 61
    assert round((sum(s[:3]) + sum(s[10:])) * 100, 1) == 3.9


def test_the_level_board_of_twelve_has_its_middle_at_6_and_a_spread_of_1_73():
    f = galton.figures(12, 0.5)
    assert f.mean == 6
    assert round(f.spread, 2) == 1.73


def test_twice_the_rows_make_the_heap_only_1_41_times_as_wide():
    assert round(galton.figures(24, 0.5).spread / galton.figures(12, 0.5).spread, 2) == 1.41
    assert round(galton.figures(24, 0.5).spread, 2) == 2.45


def test_the_middle_of_24_rows_lies_1_0_percent_under_the_normal_curve():
    share, curve = galton.shares(24, 0.5)[12], galton.normal(24, 0.5, 12)
    assert round((1 - share / curve) * 100, 1) == 1.0
    assert round((1 - share / curve) * 100, 3) == 1.036
    assert round(share, 5) == 0.16118 and round(curve, 5) == 0.16287


def test_the_tilted_board_of_the_checks_has_its_middle_at_8_4_and_a_spread_of_1_59():
    f = galton.figures(12, 0.7)
    assert f.mean == pytest.approx(8.4)
    assert f.variance == pytest.approx(2.52)
    assert round(f.spread, 2) == 1.59


def test_the_exhibits_run_lands_1_6_standard_errors_left_of_the_middle():
    run = galton.drop(galton.EXHIBIT_ROWS, galton.LEVEL, galton.EXHIBIT_BALLS, galton.EXHIBIT_SEED)
    assert run.mean == pytest.approx(5.876)
    error = math.sqrt(3) / math.sqrt(500)
    assert round(error, 3) == 0.077
    assert round((6 - run.mean) / error, 1) == 1.6


# ── the checks ───────────────────────────────────────────────────────────────


def test_every_galton_case_holds_and_the_figures_its_words_name_are_these():
    results = {r.key: r for r in checks.results("galton")}
    assert set(results) == {"eight_rows", "paths", "tilted_mean", "tilted_spread", "seeded_run", "de_moivre"}
    for r in results.values():
        assert r.deviation <= r.tolerance, r.key
    assert results["eight_rows"].measured == 70 / 256 == 0.2734375
    assert results["paths"].measured == 924
    assert round(results["seeded_run"].tolerance * 100, 2) == 3.87
    assert round(results["de_moivre"].expected, 5) == 0.16287
    assert round(results["de_moivre"].tolerance * 100, 3) == 1.042
    assert round(results["de_moivre"].deviation * 100, 3) == 1.036


def test_the_central_binomial_series_puts_the_middle_where_the_engine_has_it():
    # The source's bracket, three terms, at m = 12: the next term is O(m⁻⁴).
    m = 12
    series = (1 - 1 / (8 * m) + 1 / (128 * m**2) + 5 / (1024 * m**3)) / math.sqrt(math.pi * m)
    assert galton.shares(2 * m, 0.5)[m] == pytest.approx(series, rel=1e-7)


# ── the refusals ─────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "call",
    [
        lambda: galton.shares(0, 0.5),
        lambda: galton.shares(galton.MOST_ROWS + 1, 0.5),
        lambda: galton.shares(12, -0.1),
        lambda: galton.shares(12, 1.1),
        lambda: galton.paths(0),
        lambda: galton.normal(12, 0.0, 6),
        lambda: galton.normal(12, 1.0, 6),
        lambda: galton.uniforms(-1, 1),
        lambda: galton.uniforms(2**32, 1),
        lambda: galton.uniforms(0, -1),
        lambda: galton.turns(12, 0.5, 0, 1),
        lambda: galton.drop(12, 0.5, galton.MOST_BALLS + 1, 1),
    ],
)
def test_the_board_refuses_what_it_cannot_be(call):
    with pytest.raises(ValueError):
        call()
