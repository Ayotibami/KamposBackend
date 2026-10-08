/** Kappy's voice — one bank of pre-written line variants per trigger type,
 * picked randomly at send time so the same trigger never says the exact
 * same thing twice in a row. This is a FIRST DRAFT, written to get the
 * system working end to end — the actual wording was agreed to be a
 * collaborative pass, not something to lock in unilaterally. Treat every
 * line here as "good enough to test with," not final copy.
 *
 * Two rules that hold regardless of which line fires (enforced by the
 * CALLERS in notification.service.ts, not here — this file only ever sees
 * safe-to-use text, never raw anonymous/sensitive content):
 *  - An anonymous gist's author is never named in its own notification.
 *  - A reported/flagged post never gets a line from this file at all —
 *    the service falls back to a flat, non-joking line instead.
 */

export type LineVars = Record<string, string | number>;

function pick(lines: ((v: LineVars) => string)[], vars: LineVars): string {
  const fn = lines[Math.floor(Math.random() * lines.length)];
  return fn(vars);
}

// COMMENT — v.name, v.commentSnippet
const COMMENT_LINES: ((v: LineVars) => string)[] = [
  (v) => `Ayo, ${v.name} just left comment for your gist o, come see wetin dem talk`,
  (v) => `Omo your gist don dey get comments — ${v.name} no fit hold`,
  (v) => `Ayo, ${v.name} commented: "${v.commentSnippet}" — no leave am hanging`,
  (v) => `${v.name} just replied your gist, come defend yourself na`,
  (v) => `Ayo somebody just said "${v.commentSnippet}" under your gist — go see wetin dem talk`,
];

// REPOST — v.name
const REPOST_LINES: ((v: LineVars) => string)[] = [
  (v) => `Ayo, ${v.name} just reposted your gist, everywhere good go check wetin dem talk`,
  (v) => `${v.name} don co-sign your gist — e dey spread now`,
  (v) => `Omo ${v.name} reposted you, you don blow small`,
  (v) => `Ayo your gist just moved — ${v.name} put am for their own page too`,
];

// HOT_EXPIRING — v.name
const HOT_EXPIRING_LINES: ((v: LineVars) => string)[] = [
  (v) => `Omo, ${v.name}'s hot post go soon disappear o, go check am now before e cold`,
  (v) => `Ayo ${v.name} posted something hot and e dey about to vanish — catch am quick`,
  (v) => `Last chance o, ${v.name}'s "as e dey hot" dey about to gone forever`,
  (v) => `${v.name} go soon take down their hot moment — you go miss am if you no hurry`,
];

// DIGEST intro lines — v.count (number of items bundled)
const DIGEST_LINES: ((v: LineVars) => string)[] = [
  (v) => `Ayo see wetin dey sup for your kampos na — ${v.count} things happened`,
  (v) => `Omo plenty gist dey ground, make we catch you up (${v.count} updates)`,
  (v) => `Ayo your kampos no dey rest o, come see the ${v.count} things wey happen`,
  (v) => `${v.count} things don happen since last you checked, oya come see`,
];

// COURSEMATE_GIST item line (inside a digest) — v.name
const COURSEMATE_ITEM_LINES: ((v: LineVars) => string)[] = [
  (v) => `${v.name} posted a gist`,
  (v) => `${v.name} don drop gist`,
  (v) => `${v.name} wrote something for the timeline`,
];

// REACTION_MILESTONE item line — v.count
const MILESTONE_ITEM_LINES: ((v: LineVars) => string)[] = [
  (v) => `your gist don get ${v.count} reactions now`,
  (v) => `your gist blow — ${v.count} reactions and counting`,
  (v) => `${v.count} people don react to your gist`,
];

// TRENDING_GIST / TRENDING_AMEBO item line — v.name, v.campusLabel (either "for your kampos" or "from another school")
const TRENDING_ITEM_LINES: ((v: LineVars) => string)[] = [
  (v) => `${v.name}'s gist dey trend ${v.campusLabel}`,
  (v) => `everybody dey talk about ${v.name}'s gist ${v.campusLabel}`,
  (v) => `${v.name}'s gist blowing up ${v.campusLabel}`,
];

// SPOT_LIKES item line — v.name
const SPOT_ITEM_LINES: ((v: LineVars) => string)[] = [
  (v) => `${v.name}'s spot video dey get plenty likes`,
  (v) => `${v.name}'s spot blowing up right now`,
];

// INACTIVITY_NUDGE — v.name
const INACTIVITY_LINES: ((v: LineVars) => string)[] = [
  (v) => `${v.name}, e don tey o, e no good — hop in and catch the vibe na`,
  (v) => `Oga ${v.name} where you dey na, kampos don miss you`,
  (v) => `${v.name} abeg come back, plenty things dey happen wey you never see`,
  (v) => `We no wan disturb you but ${v.name}... na 3 days now o`,
];

// ACTIVATION_NUDGE — v.name
const ACTIVATION_LINES: ((v: LineVars) => string)[] = [
  (v) => `${v.name}, you never post anything today o, wetin dey happen for your side?`,
  (v) => `Oya ${v.name}, drop a gist or make something hot, no be only to dey read`,
  (v) => `${v.name} abeg talk to us na, post something, we dey wait`,
  (v) => `Na only lurking you sabi, ${v.name}? Drop a gist abeg`,
];

export function commentLine(name: string, commentSnippet: string): string {
  return pick(COMMENT_LINES, { name, commentSnippet });
}
export function repostLine(name: string): string {
  return pick(REPOST_LINES, { name });
}
export function hotExpiringLine(name: string): string {
  return pick(HOT_EXPIRING_LINES, { name });
}
export function digestIntroLine(count: number): string {
  return pick(DIGEST_LINES, { count });
}
export function coursemateItemLine(name: string): string {
  return pick(COURSEMATE_ITEM_LINES, { name });
}
export function milestoneItemLine(count: number): string {
  return pick(MILESTONE_ITEM_LINES, { count });
}
export function trendingItemLine(name: string, sameSchool: boolean): string {
  return pick(TRENDING_ITEM_LINES, { name, campusLabel: sameSchool ? 'for your kampos' : 'from another school' });
}
export function spotItemLine(name: string): string {
  return pick(SPOT_ITEM_LINES, { name });
}
export function inactivityLine(name: string): string {
  return pick(INACTIVITY_LINES, { name });
}
export function activationLine(name: string): string {
  return pick(ACTIVATION_LINES, { name });
}
