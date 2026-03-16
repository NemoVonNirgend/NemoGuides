/**
 * Lorebook Manager
 * Creates and manages a dedicated NemosGuides lorebook with persistent "tracker" entries.
 * The lorebook is always loaded (global) and entries use `constant: true`.
 *
 * Each tracker entry embeds a metadata header with the chat ID it was written for.
 * This lets us detect stale entries from a different chat and tell the AI to refresh them.
 *
 * Metadata format (first line of entry content):
 *   <!-- NG:chatId=abc123:updated=1710500000000 -->
 *
 * STScript commands used:
 *   /createentry   — create a new WI entry
 *   /setentryfield — update entry fields
 *   /getentryfield — read entry fields
 */

import { getContext, extension_settings } from '../../../extensions.js';
import { EXTENSION_NAME } from './tool-registry.js';

const LOG_PREFIX = '[NemosGuides:Lorebook]';

/** Default name for the NemosGuides lorebook. */
const DEFAULT_BOOK_NAME = 'NemosGuides-Trackers';

/** Prefix for all NG-managed lorebook entries. */
const ENTRY_PREFIX = '[NG]';

/** Regex to extract metadata from entry content. */
const METADATA_REGEX = /^<!-- NG:chatId=([^:]*):updated=(\d+) -->\n?/;

/** Tracker definitions — which aspects get persistent lorebook entries. */
export const TRACKERS = {
    clothing: {
        key: `${ENTRY_PREFIX} Clothing`,
        comment: `${ENTRY_PREFIX} Character Clothing & Appearance`,
        label: 'Clothing & Appearance',
        position: 1,
        depth: 1,
    },
    positions: {
        key: `${ENTRY_PREFIX} Positions`,
        comment: `${ENTRY_PREFIX} Character Positions & States`,
        label: 'Positions & Physical States',
        position: 1,
        depth: 1,
    },
    situation: {
        key: `${ENTRY_PREFIX} Situation`,
        comment: `${ENTRY_PREFIX} Scene Situation`,
        label: 'Scene Situation',
        position: 1,
        depth: 2,
    },
    thinking: {
        key: `${ENTRY_PREFIX} Thinking`,
        comment: `${ENTRY_PREFIX} Character Thoughts`,
        label: 'Character Thoughts',
        position: 1,
        depth: 1,
    },
    rules: {
        key: `${ENTRY_PREFIX} Story Rules`,
        comment: `${ENTRY_PREFIX} Story Rules & Narrative Guidelines`,
        label: 'Story Rules',
        position: 1,
        depth: 4,
    },
    narrator: {
        key: `${ENTRY_PREFIX} Narrator`,
        comment: `${ENTRY_PREFIX} Narrator Personality & Voice`,
        label: 'Narrator Personality',
        position: 1,
        depth: 4, // foundational, same level as rules
    },
    dm_notes: {
        key: `${ENTRY_PREFIX} DM Notes`,
        comment: `${ENTRY_PREFIX} DM Notes — Narrative Scratchpad`,
        label: 'DM Notes',
        position: 1,
        depth: 3,
    },
};

/**
 * Cache of tracker UIDs.
 * @type {Object<string, string>}
 */
const uidCache = {};

/** Whether the lorebook has been initialized this session. */
let bookInitialized = false;

// ── Helpers ──

async function runScript(script) {
    const context = getContext();
    if (!context?.executeSlashCommandsWithOptions) return '';
    try {
        const result = await context.executeSlashCommandsWithOptions(script, {
            showOutput: false,
            handleExecutionErrors: true,
        });
        return result?.pipe || '';
    } catch (error) {
        console.error(`${LOG_PREFIX} Script failed:`, error);
        return '';
    }
}

function getCurrentChatId() {
    const context = getContext();
    return context?.chatId || null;
}

function buildMetadata(chatId) {
    return `<!-- NG:chatId=${chatId || 'unknown'}:updated=${Date.now()} -->`;
}

function parseMetadata(content) {
    if (!content) return null;
    const match = content.match(METADATA_REGEX);
    if (!match) return null;
    return {
        chatId: match[1],
        updated: parseInt(match[2], 10),
    };
}

function stripMetadata(content) {
    if (!content) return '';
    return content.replace(METADATA_REGEX, '');
}

// ── Public API ──

export function getBookName() {
    const settings = extension_settings[EXTENSION_NAME];
    return settings?.lorebookName || DEFAULT_BOOK_NAME;
}

/**
 * Ensure the NG lorebook exists. Creates it if needed.
 * @returns {Promise<boolean>}
 */
export async function ensureBookExists() {
    if (bookInitialized) return true;

    const bookName = getBookName();

    // Test if book exists by trying to create an entry
    const testUid = await runScript(`/createentry file=${JSON.stringify(bookName)} key="[NG] _init_test"`);

    if (testUid && testUid !== '') {
        await runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${testUid} field=disable true`);
        await runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${testUid} field=content (NG initialization marker — can be deleted)`);
        bookInitialized = true;
        console.log(`${LOG_PREFIX} Lorebook "${bookName}" verified and ready.`);
        return true;
    }

    // Try to create the book via API
    try {
        console.log(`${LOG_PREFIX} Lorebook "${bookName}" not found. Creating...`);
        const response = await fetch('/api/worldinfo/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: bookName }),
        });

        if (response.ok) {
            bookInitialized = true;
            console.log(`${LOG_PREFIX} Created lorebook "${bookName}". Add it to your global World Info selection.`);
            if (typeof toastr !== 'undefined') {
                toastr.info(
                    `Created lorebook "${bookName}". Add it to your global World Info selection for it to work.`,
                    "Nemo's Guides",
                    { timeOut: 10000 },
                );
            }
            return true;
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Failed to create lorebook:`, error);
    }

    console.error(`${LOG_PREFIX} Could not find or create lorebook "${bookName}".`);
    return false;
}

async function findTrackerEntry(trackerType) {
    const bookName = getBookName();

    if (uidCache[trackerType]) {
        const content = await runScript(`/getentryfield file=${JSON.stringify(bookName)} uid=${uidCache[trackerType]} field=comment`);
        if (content.includes(ENTRY_PREFIX)) {
            return uidCache[trackerType];
        }
        delete uidCache[trackerType];
    }

    // Cache miss (e.g. after page reload) — try to find the entry by searching
    // the lorebook DOM for entries with our key prefix, or by using the createentry
    // result we stored previously. We avoid probing sequential UIDs as that triggers
    // "Valid UID is required" warnings from SillyTavern's /getentryfield.
    //
    // Entries are found when updateTracker creates them and caches the UID.
    // If the cache is empty after a reload, entries will be recreated on next update.
    return null;
}

/**
 * Create or update a tracker entry, stamped with the current chat ID.
 * @param {string} trackerType
 * @param {string} content
 * @returns {Promise<boolean>}
 */
export async function updateTracker(trackerType, content) {
    if (!TRACKERS[trackerType]) {
        console.error(`${LOG_PREFIX} Unknown tracker type: ${trackerType}`);
        return false;
    }

    const bookReady = await ensureBookExists();
    if (!bookReady) return false;

    const bookName = getBookName();
    const tracker = TRACKERS[trackerType];
    const chatId = getCurrentChatId();
    const stampedContent = `${buildMetadata(chatId)}\n${content}`;

    let uid = await findTrackerEntry(trackerType);

    if (!uid) {
        uid = await runScript(`/createentry file=${JSON.stringify(bookName)} key=${JSON.stringify(tracker.key)} ${JSON.stringify(stampedContent)}`);

        if (!uid || uid === '') {
            console.error(`${LOG_PREFIX} Failed to create tracker for ${trackerType}`);
            return false;
        }

        await Promise.all([
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=constant true`),
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=comment ${JSON.stringify(tracker.comment)}`),
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=addMemo true`),
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=position ${tracker.position}`),
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=depth ${tracker.depth}`),
        ]);

        uidCache[trackerType] = uid;
        console.log(`${LOG_PREFIX} Created tracker "${tracker.key}" (UID: ${uid})`);
    } else {
        await Promise.all([
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=content ${JSON.stringify(stampedContent)}`),
            runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=disable false`),
        ]);
        console.log(`${LOG_PREFIX} Updated tracker "${tracker.key}" (UID: ${uid})`);
    }

    return true;
}

/**
 * Get the current content of a tracker entry (without metadata).
 * @param {string} trackerType
 * @returns {Promise<string>}
 */
export async function getTrackerContent(trackerType) {
    const bookReady = await ensureBookExists();
    if (!bookReady) return '';

    const uid = await findTrackerEntry(trackerType);
    if (!uid) return '';

    const bookName = getBookName();
    const raw = await runScript(`/getentryfield file=${JSON.stringify(bookName)} uid=${uid} field=content`);
    return stripMetadata(raw);
}

/**
 * Wipe all NG tracker entries for a fresh start.
 * @returns {Promise<void>}
 */
export async function clearAllTrackers() {
    const bookReady = await ensureBookExists();
    if (!bookReady) return;

    const bookName = getBookName();

    await Promise.allSettled(
        Object.keys(TRACKERS).map(async (trackerType) => {
            const uid = await findTrackerEntry(trackerType);
            if (uid) {
                await Promise.all([
                    runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=disable true`),
                    runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=content ${JSON.stringify(buildMetadata('cleared') + '\n(Awaiting scene assessment)')}`),
                ]);
            }
        })
    );

    console.log(`${LOG_PREFIX} All trackers wiped.`);
}

/**
 * Assess the state of all tracker entries relative to the current chat.
 * Returns a status object the system instruction can use to tell the AI
 * what needs updating.
 *
 * @returns {Promise<TrackerStatusReport>}
 *
 * @typedef {Object} TrackerStatusReport
 * @property {string[]} fresh - Tracker types that are up-to-date for this chat
 * @property {string[]} stale - Tracker types from a different chat (need refresh)
 * @property {string[]} empty - Tracker types that don't exist yet (need creation)
 * @property {string[]} disabled - Tracker types that are disabled (wiped)
 * @property {boolean} isNewChat - Whether this appears to be a new/empty chat
 */
export async function assessTrackerState() {
    const chatId = getCurrentChatId();
    const bookReady = await ensureBookExists();

    const report = {
        fresh: [],
        stale: [],
        empty: [],
        disabled: [],
        isNewChat: false,
    };

    if (!bookReady) {
        report.empty = Object.keys(TRACKERS);
        return report;
    }

    // Check if this is a new chat (0-1 non-system messages)
    const context = getContext();
    const msgCount = context.chat?.filter(m => !m.is_system)?.length || 0;
    report.isNewChat = msgCount <= 1;

    const bookName = getBookName();

    for (const trackerType of Object.keys(TRACKERS)) {
        const uid = await findTrackerEntry(trackerType);

        if (!uid) {
            report.empty.push(trackerType);
            continue;
        }

        // Check if disabled
        const disabledStr = await runScript(`/getentryfield file=${JSON.stringify(bookName)} uid=${uid} field=disable`);
        if (disabledStr === 'true') {
            report.disabled.push(trackerType);
            continue;
        }

        // Check metadata for chat ID match
        const raw = await runScript(`/getentryfield file=${JSON.stringify(bookName)} uid=${uid} field=content`);
        const meta = parseMetadata(raw);

        if (!meta || meta.chatId === 'cleared' || meta.chatId === 'unknown') {
            report.stale.push(trackerType);
        } else if (meta.chatId !== chatId) {
            report.stale.push(trackerType);
        } else {
            report.fresh.push(trackerType);
        }
    }

    return report;
}

/**
 * Build a dynamic status message about tracker state for the system instruction.
 * @returns {Promise<string>} Status text to append to the system instruction, or empty string
 */
export async function buildTrackerStatusMessage() {
    const report = await assessTrackerState();
    const lines = [];

    if (report.isNewChat) {
        lines.push(`\n[NG STATUS: FRESH CHAT — This is the very first exchange. You MUST call these tools before writing your response:
1. Call Rule Setup to generate story rules, authorial voice, and narrator personality for this chat.
2. Call Scene Assessment with aspects: ["all"] to establish the full scene state (thinking, clothing, positions, situation).
3. Call DM Notes with action: "append" to initialize plot threads and narrative direction based on the opening scene.
Call all three tools, then write your response informed by the results. Do NOT skip these on a fresh chat.]`);
        return lines.join('');
    }

    const needsUpdate = [...report.stale, ...report.empty, ...report.disabled];

    if (needsUpdate.length === 0 && report.fresh.length > 0) {
        // Everything is current — no special message needed
        return '';
    }

    if (needsUpdate.length > 0) {
        const labels = needsUpdate.map(t => TRACKERS[t]?.label || t);
        if (needsUpdate.length === Object.keys(TRACKERS).length) {
            lines.push(`\n[NG STATUS: All scene trackers are outdated or empty. Use Scene Assessment to populate: ${labels.join(', ')}.]`);
        } else {
            lines.push(`\n[NG STATUS: The following trackers need updating: ${labels.join(', ')}. Use Scene Assessment with the relevant aspects to refresh them.]`);
        }
    }

    if (report.fresh.length > 0) {
        const freshLabels = report.fresh.map(t => TRACKERS[t]?.label || t);
        lines.push(`\n[NG STATUS: Current trackers (up-to-date): ${freshLabels.join(', ')}. Only update these if the scene state has changed.]`);
    }

    return lines.join('');
}

/**
 * Enable or disable a tracker entry.
 */
export async function setTrackerEnabled(trackerType, enabled) {
    const uid = await findTrackerEntry(trackerType);
    if (!uid) return false;
    const bookName = getBookName();
    await runScript(`/setentryfield file=${JSON.stringify(bookName)} uid=${uid} field=disable ${!enabled}`);
    return true;
}
