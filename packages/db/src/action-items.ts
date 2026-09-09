import { and, eq } from "drizzle-orm";
import { actionItems, type NewActionItem } from "./schema";
import type { Database } from "./index";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const MAX_ACTION_ITEM_TEXT_LENGTH = 2_000;

/** A caller supplied a calendar day or task value that cannot be persisted. */
export class ActionItemValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionItemValidationError";
  }
}

/**
 * Accept a literal calendar date only. Relative language belongs in a review
 * proposal; it never becomes an invented date by passing through this helper.
 */
export function isCalendarDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1]!;
}

function nonEmpty(value: string, field: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new ActionItemValidationError(`${field} is required`);
  if (trimmed.length > MAX_ACTION_ITEM_TEXT_LENGTH) {
    throw new ActionItemValidationError(`${field} is too long`);
  }
  return trimmed;
}

export interface CreateActionItemProposal {
  roomId: string;
  sourceLineId: string;
  text: string;
  origin?: "manual" | "llm";
  /** Already resolved by server code from retained transcript evidence. */
  assigneeIdentity?: string;
  /** Optional for a proposal; it is mandatory before opening. */
  dueOn?: string;
}

/**
 * Build the deliberately small insert surface shared by server routes.
 *
 * The evidence columns are non-null in Postgres but intentionally absent here:
 * the database trigger derives them from `sourceLineId` before constraints run.
 */
export function actionItemProposalValues(input: CreateActionItemProposal): NewActionItem {
  const text = nonEmpty(input.text, "Action item text");
  const assigneeIdentity = input.assigneeIdentity
    ? nonEmpty(input.assigneeIdentity, "Assignee identity")
    : undefined;
  if (input.dueOn !== undefined && !isCalendarDate(input.dueOn)) {
    throw new ActionItemValidationError("Due date must use YYYY-MM-DD");
  }

  return {
    roomId: input.roomId,
    sourceLineId: input.sourceLineId,
    text,
    origin: input.origin ?? "manual",
    ...(assigneeIdentity ? { assigneeIdentity } : {}),
    ...(input.dueOn ? { dueOn: input.dueOn } : {}),
  } as NewActionItem;
}

/**
 * Create a review-only proposal without accepting a quote, speaker, timestamp,
 * sequence, or assignee display name from the caller. The database trigger
 * derives those fields from the matched transcript row before constraints run.
 */
export async function createActionItemProposal(
  db: Database,
  input: CreateActionItemProposal,
) {
  return db
    .insert(actionItems)
    .values(actionItemProposalValues(input))
    .onConflictDoNothing()
    .returning({ id: actionItems.id, status: actionItems.status });
}

export interface OpenActionItem {
  roomId: string;
  id: string;
  /** Already resolved by server code from retained transcript evidence. */
  assigneeIdentity: string;
  dueOn: string;
  /** The host may finalise a proposal's wording as it opens. */
  text?: string;
}

/** Open a proposal only with a retained participant and an explicit calendar day. */
export async function openActionItem(db: Database, input: OpenActionItem) {
  const assigneeIdentity = nonEmpty(input.assigneeIdentity, "Assignee identity");
  const text = input.text === undefined
    ? undefined
    : nonEmpty(input.text, "Action item text");
  if (!isCalendarDate(input.dueOn)) {
    throw new ActionItemValidationError("Due date must use YYYY-MM-DD");
  }

  return db
    .update(actionItems)
    .set({
      status: "open",
      assigneeIdentity,
      dueOn: input.dueOn,
      ...(text ? { text } : {}),
    })
    .where(
      and(
        eq(actionItems.id, input.id),
        eq(actionItems.roomId, input.roomId),
        eq(actionItems.status, "proposed"),
      ),
    )
    .returning({ id: actionItems.id, status: actionItems.status });
}

/** A current host may put completed work back into the open meeting record. */
export async function reopenActionItem(
  db: Database,
  input: Pick<OpenActionItem, "roomId" | "id">,
) {
  return db
    .update(actionItems)
    .set({ status: "open" })
    .where(
      and(
        eq(actionItems.id, input.id),
        eq(actionItems.roomId, input.roomId),
        eq(actionItems.status, "completed"),
      ),
    )
    .returning({ id: actionItems.id, status: actionItems.status });
}

export interface CompleteActionItem {
  roomId: string;
  id: string;
  /** Present only for a non-host completing their own anonymous session's task. */
  assigneeIdentity?: string;
}

/** Completion is intentionally conditional: proposed work can never skip open. */
export async function completeActionItem(
  db: Database,
  input: CompleteActionItem,
) {
  return db
    .update(actionItems)
    .set({ status: "completed" })
    .where(
      and(
        eq(actionItems.id, input.id),
        eq(actionItems.roomId, input.roomId),
        eq(actionItems.status, "open"),
        ...(input.assigneeIdentity
          ? [eq(actionItems.assigneeIdentity, input.assigneeIdentity)]
          : []),
      ),
    )
    .returning({ id: actionItems.id, status: actionItems.status });
}
