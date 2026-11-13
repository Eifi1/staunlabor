import { Link } from "react-router";
import type { KitLinkComponent } from "@eifi1/ui-kit";

/** Every kit link — TextLink, Button href, a ListItem that navigates — goes
 *  through the router, set once on `UiKitProvider` rather than as a renderLink
 *  per component.
 *
 *  A module of its own because two providers hand it over: `main.tsx`'s, and
 *  the test harness's. While it lived in `main.tsx`, which renders the app as
 *  it is imported, the harness could not reach it and mounted no provider at
 *  all — so under test every kit link was a plain anchor, a click on one asked
 *  jsdom to load another document ("Not implemented: navigation"), and a test
 *  could not follow a link the way the app does. */
export const routerLink: KitLinkComponent = ({ href, ...props }) => <Link to={href} {...props} />;
