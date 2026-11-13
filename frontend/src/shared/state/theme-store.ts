import { createThemeStore } from "@eifi1/ui-kit";
import { STORAGE } from "@/shared/lib/storage-keys";

/** The light or dark theme: the kit's store on this site's key, which the
 *  pre-paint call in `main.tsx` reads too. */
export const { useTheme, useApplyTheme } = createThemeStore(STORAGE.theme);
