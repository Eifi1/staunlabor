import type { AccountPageFrameProps } from "@eifi1/ui-kit/accounts";

/** The signed-out pages inside the site's own frame (its header and footer): a narrow
 *  column with the page's title, as the site's other pages read. */
export function AccountFrame({ title, children }: AccountPageFrameProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{title}</h1>
      {children}
    </div>
  );
}
