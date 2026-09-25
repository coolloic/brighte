import { Fragment } from "react";

export type EmailAddressProps = { email: string };

/**
 * An email address that wraps at sensible points in narrow spaces: after the "@" and before each
 * ".", e.g. "grace.hopper@" / "example" / ".com.au", instead of mid-word. <wbr> marks the points,
 * so copying and screen readers still get the plain address. Put it in an element with
 * `break-words`, so a part too long for the space can still break.
 */
export function EmailAddress({ email }: EmailAddressProps) {
  const parts = email.split(/(?=\.)|(?<=@)/);
  return parts.map((part, index) => (
    // Parts can repeat (".com"), so the index is the key; the list never reorders.
    <Fragment key={index}>
      {index > 0 && <wbr />}
      {part}
    </Fragment>
  ));
}
