import { vi } from "vitest";
import { api } from "@/shared/api/client";
import { STORAGE } from "@/shared/lib/storage-keys";
import { useCourseProgress } from "@/features/course/progress";
import fixtures from "@/features/course/test-fixtures.json";
import { mockApi } from "./api-mock";

/** The engine's answers (`features/course/test-fixtures.json`, written from the
 *  engine by `scripts/write-course-fixtures.py`), at the routes the backend
 *  serves them on. One table for every test of the course, so a new route is
 *  one line here and no test file answers it with a 404. */
const COURSE_ROUTES = {
  "GET /course/defaults": fixtures.defaults,
  "POST /course/tank": fixtures.tank,
  "POST /course/first-order": fixtures.first_order,
  "POST /course/first-order/measurement": fixtures.measurement,
  "POST /course/second-order": fixtures.second_order,
  "POST /course/second-order/decay": fixtures.decay,
  "POST /course/eigen/scalar": fixtures.scalar,
  "POST /course/eigen/poles": fixtures.poles,
  "POST /course/eigen/matrix": fixtures.matrix,
  "POST /course/laplace": fixtures.laplace,
  "POST /course/laplace/chain": fixtures.chain,
  "POST /course/laplace/filter-loop": fixtures.filter_loop,
  "POST /course/numerics/sensor": fixtures.sensor,
  "POST /course/numerics/oscillator": fixtures.oscillator,
  "POST /course/numerics/stiff": fixtures.stiff,
  "POST /course/two-mass": fixtures.two_mass,
  "POST /course/two-mass/compensation": fixtures.compensation,
};

/** A course test's start: the engine mocked, and a reader who has done
 *  nothing yet (no progress stored, none in the store). */
export function mockCourse() {
  mockApi(COURSE_ROUTES);
  localStorage.removeItem(STORAGE.courseProgress);
  useCourseProgress.getState().forget();
}

const postCalls = () => (api.post as ReturnType<typeof vi.fn>).mock.calls as [string, Record<string, unknown>][];

/** How many requests the page has posted to the engine. */
export const postCount = () => postCalls().length;

/** The bodies the page posted to one of the engine's routes, in order. */
export const posted = (path: string) =>
  postCalls()
    .filter(([url]) => url === path)
    .map(([, body]) => body);
