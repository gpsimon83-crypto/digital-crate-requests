/**
 * Admin View / DJ View, for staff whose login is linked to a DJ profile
 * ("This DJ is me"). It only changes what the /dj-dashboard pages look like
 * (the DJ menu and the DJ home with their own records); permissions are
 * still checked on the server against the account, so it can't open
 * anything the account couldn't already. Ordinary DJs never get the switch,
 * and for them the cookie means nothing.
 */
export const VIEW_MODE_COOKIE = "dcdj_view_mode";
export type ViewMode = "admin" | "dj";
